<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ExamHeader from './ExamHeader.vue';
import QuestionPalette, { type QuestionStatus } from './QuestionPalette.vue';
import CodingProblemView from './CodingProblemView.vue';
import CodingEditorView from './CodingEditorView.vue';
import McqProblemView from './McqProblemView.vue';
import SubmitTestModal from './SubmitTestModal.vue';
import FullscreenGuardModal from './FullscreenGuardModal.vue';
import ExamSectionDetailsModal from './ExamSectionDetailsModal.vue';
import CandidateWatermarkOverlay from './CandidateWatermarkOverlay.vue';
import { useProblemsStore } from '../../stores/problems';
import { useEditorStore } from '../../stores/editor';
import { useExamStore } from '../../stores/exam';
import { useMcqStore } from '../../stores/mcq';
import { useRunSubmitStore } from '../../stores/runSubmit';
import { useToastStore } from '../../stores/toast';
import { useResizable } from '../../composables/useResizable';
import { useTimer } from '../../composables/useTimer';
import { useFullscreenGuard } from '../../composables/useFullscreenGuard';
import { submitMcqSection, submitExam } from '../../services/api';
import type { Problem } from '../../types';

const router = useRouter();
const problemsStore = useProblemsStore();
const editorStore = useEditorStore();
const examStore = useExamStore();
const mcqStore = useMcqStore();
const runSubmit = useRunSubmitStore();
const toastStore = useToastStore();

// Fullscreen Proctoring Guard
const {
  isFullscreen,
  showGuardModal,
  violationCount,
  currentViolationReason,
  isSidePanelOpen,
  isLockedOut,
  maxViolations,
  isQuestionContentHidden,
  isStarted,
  enterFullscreen,
  exitFullscreen,
  clearSession,
} = useFullscreenGuard(
  computed(() => examStore.activeExam?.id),
  computed(() => examStore.activeExam?.maxViolations),
);

// Lockout safety trigger (if not manually submitted within 15 seconds)
watch(isLockedOut, (locked) => {
  if (locked) {
    toastStore.add(
      'error',
      'Maximum proctoring violations exceeded. Assessment session locked.',
    );
  }
});

// Section & Marks Metrics for Overview Modal
const mcqProblems = computed(() =>
  problemsStore.problems.filter((p) => p.questionType === 'mcq'),
);
const codingProblems = computed(() =>
  problemsStore.problems.filter((p) => p.questionType !== 'mcq'),
);

const mcqCount = computed(() => mcqProblems.value.length);
const mcqMarksEach = computed(() => {
  if (mcqProblems.value.length === 0) return 0;
  return mcqProblems.value[0]?.maxScore ?? 1;
});

const codingCount = computed(() => codingProblems.value.length);
const codingMarksEach = computed(() => {
  if (codingProblems.value.length === 0) return 0;
  return codingProblems.value[0]?.maxScore ?? 10;
});

const totalQuestions = computed(() => problemsStore.problems.length);
const totalMarks = computed(() =>
  problemsStore.problems.reduce((sum, p) => sum + (p.maxScore ?? 0), 0),
);

// Pre-test section overview modal
const showSectionDetailsModal = ref(true);

function handleUnderstoodSectionDetails() {
  showSectionDetailsModal.value = false;
}

// Timer
const { remaining, isWarning, isCritical, start: startTimer } = useTimer();
onMounted(() => {
  void startTimer();
  if (examStore.activeExam?.id) {
    mcqStore.init(examStore.activeExam.id);
  }
});

// Section state: 'mcq' | 'coding'
const activeSection = ref<'mcq' | 'coding'>('mcq');

// Initialize section based on available problem types
watch(
  () => problemsStore.problems,
  (probs) => {
    if (probs.length > 0) {
      const hasMcq = probs.some((p) => p.questionType === 'mcq');
      const hasCoding = probs.some((p) => p.questionType !== 'mcq');
      if (hasMcq) {
        activeSection.value = 'mcq';
      } else if (hasCoding) {
        activeSection.value = 'coding';
      }
    }
  },
  { immediate: true },
);

// Filtered problem list based on active section
const filteredProblems = computed(() => {
  const all = [...problemsStore.problems].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  if (activeSection.value === 'mcq') {
    return all.filter((p) => p.questionType === 'mcq');
  }
  return all.filter((p) => p.questionType !== 'mcq');
});

// Active question index in filtered list
const currentIndex = ref(0);

const currentProblem = computed<Problem | null>(() => {
  if (filteredProblems.value.length === 0) return null;
  const idx = Math.min(currentIndex.value, filteredProblems.value.length - 1);
  return filteredProblems.value[idx] || null;
});

// Sync editorStore's active problem whenever currentProblem changes
watch(
  currentProblem,
  (p) => {
    if (p) {
      if (p.questionType === 'mcq') {
        editorStore.setActiveProblem(p.id, p);
      } else {
        editorStore.setActiveProblem(p.id, p);
      }
      // Mark as viewed
      markViewed(p.id);
    }
  },
  { immediate: true },
);

// Question Statuses map
const statuses = ref<Record<number, QuestionStatus>>({});

function initStatuses() {
  problemsStore.problems.forEach((p, idx) => {
    if (!statuses.value[p.id]) {
      const isMcqAnswered =
        p.questionType === 'mcq' &&
        (mcqStore.mcqDrafts[p.id]?.length ?? 0) > 0;
      statuses.value[p.id] = {
        isAnswered: isMcqAnswered,
        isBookmarked: false,
        isViewed: idx === 0,
        isSavedInServer: isMcqAnswered,
      };
    }
  });
}

onMounted(() => {
  initStatuses();
});

watch(
  () => problemsStore.problems,
  () => {
    initStatuses();
  },
  { deep: true },
);

function markViewed(problemId: number) {
  if (!statuses.value[problemId]) {
    statuses.value[problemId] = {
      isAnswered: false,
      isBookmarked: false,
      isViewed: true,
      isSavedInServer: false,
    };
  } else {
    statuses.value[problemId].isViewed = true;
  }
}

function toggleBookmark(problemId: number) {
  if (!statuses.value[problemId]) {
    statuses.value[problemId] = {
      isAnswered: false,
      isBookmarked: true,
      isViewed: true,
      isSavedInServer: false,
    };
  } else {
    statuses.value[problemId].isBookmarked =
      !statuses.value[problemId].isBookmarked;
  }
}

function handleSelectQuestion(index: number) {
  if (index >= 0 && index < filteredProblems.value.length) {
    currentIndex.value = index;
  }
}

function handleNextQuestion() {
  if (currentIndex.value < filteredProblems.value.length - 1) {
    currentIndex.value++;
  } else {
    const hasCoding = problemsStore.problems.some(
      (p) => p.questionType !== 'mcq',
    );
    if (activeSection.value === 'mcq' && hasCoding) {
      activeSection.value = 'coding';
      currentIndex.value = 0;
      toastStore.add('info', 'Proceeding to Section 2: Coding.');
    } else {
      toastStore.add(
        'info',
        'You have reached the last question in this section.',
      );
    }
  }
}

// MCQ Actions
function toggleMcqOption(problemId: number, optionId: string) {
  const current = mcqStore.mcqDrafts[problemId] ?? [];
  const next = current.includes(optionId) ? [] : [optionId];
  mcqStore.setDraft(problemId, next);

  if (!statuses.value[problemId]) {
    statuses.value[problemId] = {
      isAnswered: next.length > 0,
      isBookmarked: false,
      isViewed: true,
      isSavedInServer: false,
    };
  } else {
    statuses.value[problemId].isAnswered = next.length > 0;
  }
}

function clearMcqSelection(problemId: number) {
  mcqStore.setDraft(problemId, []);
  if (statuses.value[problemId]) {
    statuses.value[problemId].isAnswered = false;
  }
}

// Watch coding submissions to update answered status
watch(
  () => runSubmit.submission,
  (sub) => {
    if (sub && currentProblem.value && currentProblem.value.questionType !== 'mcq') {
      const pId = currentProblem.value.id;
      if (!statuses.value[pId]) {
        statuses.value[pId] = {
          isAnswered: sub.verdict === 'accepted',
          isBookmarked: false,
          isViewed: true,
          isSavedInServer: true,
        };
      } else {
        statuses.value[pId].isAnswered = sub.verdict === 'accepted';
        statuses.value[pId].isSavedInServer = true;
      }
    }
  },
);

// Resizable Split Pane between Left Problem Panel & Right Solution Panel
const leftPanelWidthPercent = ref(50);
const { onMouseDown: onDividerDrag } = useResizable('vertical', (delta) => {
  const containerWidth = window.innerWidth - 144; // Minus question palette width
  if (containerWidth > 0) {
    const deltaPercent = (delta / containerWidth) * 100;
    const next = leftPanelWidthPercent.value + deltaPercent;
    if (next >= 25 && next <= 75) {
      leftPanelWidthPercent.value = next;
    }
  }
});

// Submit Test Modal
const showSubmitModal = ref(false);
const isSubmittingTest = ref(false);

const summaryCounts = computed(() => {
  let answered = 0;
  let bookmarked = 0;
  let skipped = 0;
  let notViewed = 0;

  problemsStore.problems.forEach((p, idx) => {
    const s = statuses.value[p.id] || {
      isAnswered: false,
      isBookmarked: false,
      isViewed: idx === 0,
      isSavedInServer: false,
    };
    if (s.isAnswered) answered++;
    if (s.isBookmarked) bookmarked++;
    if (!s.isViewed) notViewed++;
    else if (!s.isAnswered) skipped++;
  });

  return {
    total: problemsStore.problems.length,
    answered,
    bookmarked,
    skipped,
    notViewed,
  };
});

async function handleConfirmSubmitTest() {
  isSubmittingTest.value = true;
  try {
    // 1. Submit any pending MCQ answers
    const mcqs = problemsStore.problems.filter((p) => p.questionType === 'mcq');
    if (mcqs.length > 0 && examStore.activeExam?.id) {
      const answers = mcqs.map((p) => ({
        problemId: p.id,
        selectedOptionIds: mcqStore.mcqDrafts[p.id] ?? [],
      }));
      try {
        await submitMcqSection({
          examId: examStore.activeExam.id,
          answers,
        });
      } catch {
        // Continue
      }
    }

    // 2. Finalize and submit the entire exam on backend
    if (examStore.activeExam?.id) {
      try {
        await submitExam(examStore.activeExam.id);
        if (examStore.myProgress) {
          examStore.myProgress.isCompleted = true;
        }
      } catch (err) {
        console.warn('[workspace] Finalize exam error:', err);
      }
    }

    toastStore.add('success', 'Exam submitted successfully!');
    showSubmitModal.value = false;
    clearSession();
    await exitFullscreen();
    await router.push('/dashboard');
  } catch (e: any) {
    toastStore.add('error', e.message || 'Failed to submit test');
  } finally {
    isSubmittingTest.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-[#0f172a] select-none">
    <!-- ── Exam Header ────────────────────────────────────────────── -->
    <ExamHeader
      :active-section="activeSection"
      :remaining-time="remaining"
      :is-timer-warning="isWarning"
      :is-timer-critical="isCritical"
      @select-section="activeSection = $event; currentIndex = 0"
      @submit-test="showSubmitModal = true"
    />

    <!-- ── Workspace Body ─────────────────────────────────────────── -->
    <div class="flex flex-1 min-h-0 overflow-hidden relative">
      <!-- ── Left Column: Question Palette ──────────────────────────── -->
      <QuestionPalette
        :problems="filteredProblems"
        :current-index="currentIndex"
        :statuses="statuses"
        @select-question="handleSelectQuestion"
      />

      <!-- ── Center Split Area: Problem & Answer ────────────────────── -->
      <div class="flex-1 flex min-w-0 h-full overflow-hidden relative">
        <!-- If paused / focus lost / side panel open, UNMOUNT question content completely from DOM -->
        <div
          v-if="isQuestionContentHidden"
          class="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-3 p-8 text-center select-none"
          aria-hidden="true"
        >
          <div
            class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs"
          >
            <span class="material-symbols-outlined text-2xl text-slate-500">lock</span>
          </div>
          <div class="flex flex-col gap-1 max-w-xs">
            <p class="text-xs font-bold text-slate-700 dark:text-slate-300">
              Assessment Content Protected
            </p>
            <p class="text-[11px] text-slate-500 leading-normal">
              Question statement is hidden while proctoring guard or side panel is active.
            </p>
          </div>
        </div>

        <template v-else-if="currentProblem">
          <!-- MCQ Question Layout -->
          <div
            v-if="currentProblem.questionType === 'mcq'"
            class="flex-1 h-full overflow-hidden"
          >
            <McqProblemView
              :problem="currentProblem"
              :question-number="currentIndex + 1"
              :total-questions="filteredProblems.length"
              :is-bookmarked="Boolean(statuses[currentProblem.id]?.isBookmarked)"
              :selected-option-ids="mcqStore.mcqDrafts[currentProblem.id] || []"
              @toggle-bookmark="toggleBookmark(currentProblem.id)"
              @toggle-option="toggleMcqOption(currentProblem.id, $event)"
              @clear-selection="clearMcqSelection(currentProblem.id)"
              @next-question="handleNextQuestion"
            />
          </div>

          <!-- Coding Question Layout -->
          <div
            v-else
            class="flex-1 flex h-full min-w-0 overflow-hidden"
          >
            <!-- Left Problem Statement Panel -->
            <div
              class="flex-shrink-0 h-full overflow-hidden border-r border-slate-200 dark:border-slate-800"
              :style="{ width: `${leftPanelWidthPercent}%` }"
            >
              <CodingProblemView
                :problem="currentProblem"
                :question-number="currentIndex + 1"
                :total-questions="filteredProblems.length"
                :is-bookmarked="Boolean(statuses[currentProblem.id]?.isBookmarked)"
                @toggle-bookmark="toggleBookmark(currentProblem.id)"
              />
            </div>

            <!-- Resizable Divider Handle -->
            <div
              class="w-2 flex-shrink-0 flex items-center justify-center cursor-col-resize group bg-slate-100 dark:bg-slate-800/80 hover:bg-blue-500/20 transition-colors z-20"
              @mousedown="onDividerDrag"
            >
              <div
                class="w-1 h-8 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-blue-500 transition-colors flex items-center justify-center"
              >
                <div class="flex flex-col gap-1 items-center">
                  <span class="w-0.5 h-0.5 rounded-full bg-slate-400 dark:bg-slate-400" />
                  <span class="w-0.5 h-0.5 rounded-full bg-slate-400 dark:bg-slate-400" />
                  <span class="w-0.5 h-0.5 rounded-full bg-slate-400 dark:bg-slate-400" />
                </div>
              </div>
            </div>

            <!-- Right Solution / Editor Panel -->
            <div class="flex-1 h-full min-w-0 overflow-hidden">
              <CodingEditorView
                :problem="currentProblem"
                @next-question="handleNextQuestion"
              />
            </div>
          </div>
        </template>

        <!-- Empty state if no problems -->
        <div
          v-else
          class="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3"
        >
          <span class="material-symbols-outlined text-4xl">quiz</span>
          <p class="text-xs">No questions found for this exam.</p>
        </div>
      </div>
    </div>

    <!-- ── Submit Test Confirmation Modal ──────────────────────────── -->
    <SubmitTestModal
      v-if="showSubmitModal"
      :total-questions="summaryCounts.total"
      :answered-count="summaryCounts.answered"
      :bookmarked-count="summaryCounts.bookmarked"
      :skipped-count="summaryCounts.skipped"
      :not-viewed-count="summaryCounts.notViewed"
      :is-submitting="isSubmittingTest"
      @close="showSubmitModal = false"
      @confirm="handleConfirmSubmitTest"
    />

    <!-- ── Dynamic Candidate Watermark Overlay ────────────────────── -->
    <CandidateWatermarkOverlay />

    <!-- ── Test Section Details Modal ──────────────────────────────── -->
    <ExamSectionDetailsModal
      v-if="showSectionDetailsModal"
      :exam-title="examStore.activeExam?.title || 'Coding Assessment'"
      :duration-minutes="examStore.activeExam?.durationMinutes || 60"
      :mcq-count="mcqCount"
      :mcq-marks-each="mcqMarksEach"
      :coding-count="codingCount"
      :coding-marks-each="codingMarksEach"
      :total-questions="totalQuestions"
      :total-marks="totalMarks"
      @understood="handleUnderstoodSectionDetails"
    />

    <!-- ── Fullscreen Proctoring Guard Modal ───────────────────────── -->
    <FullscreenGuardModal
      v-else-if="!isStarted || showGuardModal || !isFullscreen || isLockedOut"
      :is-initial-prompt="!isStarted"
      :violation-count="violationCount"
      :violation-reason="currentViolationReason"
      :is-side-panel-open="isSidePanelOpen"
      :is-locked-out="isLockedOut"
      :max-violations="maxViolations"
      :is-submitting-lockout="isSubmittingTest"
      @enter-fullscreen="enterFullscreen"
      @submit-lockout="handleConfirmSubmitTest"
    />
  </div>
</template>
