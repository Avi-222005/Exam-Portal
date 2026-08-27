<script setup lang="ts">
import {
  provide,
  onMounted,
  onUnmounted,
  ref,
  computed,
  watch,
  nextTick,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppHeader from '../components/layout/AppHeader.vue';
import Toast from '../components/shared/Toast.vue';
import SuccessModal from '../components/shared/SuccessModal.vue';
import ExamWorkspace from '../components/student/ExamWorkspace.vue';
import { useUiStore } from '../stores/ui';
import { useExamStore } from '../stores/exam';
import { useRunSubmitStore } from '../stores/runSubmit';
import { useEditorStore } from '../stores/editor';
import { useProblemsStore } from '../stores/problems';
import { useAuthStore } from '../stores/auth';
import { useAutosave } from '../composables/useAutosave';
import { useTimer } from '../composables/useTimer';
import { useCelebration } from '../composables/useCelebration';
import api from '../services/api';
import type { Problem } from '../types';

const route = useRoute();
const router = useRouter();
const uiStore = useUiStore();
const examStore = useExamStore();
const runSubmit = useRunSubmitStore();
const editorStore = useEditorStore();
const problemsStore = useProblemsStore();
const authStore = useAuthStore();

const successModal = ref<{
  mode: 'submit' | 'run';
  problemTitle: string;
  score: number;
  passedTests: number;
  totalTests: number;
  language: string;
} | null>(null);

watch(
  () => runSubmit.submission,
  (s) => {
    if (
      s?.verdict === 'accepted' &&
      editorStore.activeProblem?.questionType !== 'mcq'
    ) {
      successModal.value = {
        mode: 'submit',
        problemTitle: editorStore.activeProblem?.title ?? '',
        score: s.score,
        passedTests: s.passedTests,
        totalTests: s.totalTests,
        language: editorStore.language.name,
      };
    }
  },
);

watch(
  () => runSubmit.runResult,
  (r) => {
    if (
      r &&
      !runSubmit.lastRunHadCustomInput &&
      r.results.length > 0 &&
      r.results.every((x) => x.passed)
    ) {
      successModal.value = {
        mode: 'run',
        problemTitle: editorStore.activeProblem?.title ?? '',
        score: 0,
        passedTests: r.results.length,
        totalTests: r.results.length,
        language: editorStore.language.name,
      };
    }
  },
);

const {
  start: startAutosave,
  stop: stopAutosave,
  forceSave,
  saveStatus,
} = useAutosave();
provide('saveStatus', saveStatus);
provide('forceSave', forceSave);

const {
  remaining,
  isWarning,
  isCritical,
  isExpired,
  start: startTimer,
} = useTimer();
provide('timerState', { remaining, isWarning, isCritical, isExpired });

const celebration = useCelebration();

const loading = ref(true);

onMounted(async () => {
  // 1. Verify authentication
  if (!authStore.isAuthenticated) {
    void route;
    return;
  }

  // 2. Fetch exam info
  await examStore.fetchActiveExam();

  const routeExamId = Number(route.params.id);
  if (routeExamId && examStore.selectedExam?.id !== routeExamId) {
    const match = examStore.activeExams.find((e) => e.id === routeExamId);
    if (match) examStore.selectExam(match);
  }

  const examId = routeExamId || examStore.activeExam?.id;

  if (examId) {
    // 3. Fetch available languages
    void editorStore.fetchLanguages();

    // 4. Auto-fetch problems for the exam
    try {
      const { data } = await api.get<Problem[]>(`/exams/${examId}/problems`);
      if (Array.isArray(data) && data.length > 0) {
        problemsStore.setProblems(data);
        data.forEach((p) => problemsStore.cacheProblemDetail(p));

        if (!editorStore.activeProblemId) {
          const first = data.find((p) => p.questionType !== 'mcq') || data[0];
          editorStore.setActiveProblem(first.id, first);
        }
      }
    } catch (e: unknown) {
      console.warn('[workspace] Could not load problems automatically', e);
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        void router.replace({ name: 'student-dashboard' });
        return;
      }
    }
  }

  // Default to code editor tab if not set or on api-docs
  if (uiStore.activeTab === 'api-docs') {
    uiStore.setActiveTab('code-editor');
  }

  await examStore.fetchMyProgress();
  loading.value = false;
  void startAutosave();
  void startTimer();

  // Auto-launch the guided tour once per exam
  const currentExamId = examStore.activeExam?.id;
  const tourKey = `tourShown:${currentExamId}`;
  if (currentExamId && !localStorage.getItem(tourKey)) {
    await nextTick();
    const { startTour } = await import('../composables/useTour');
    void startTour();
    localStorage.setItem(tourKey, '1');
  }
});

watch(isExpired, (expired) => {
  if (expired) stopAutosave();
});

onUnmounted(() => {
  celebration.stop();
});

watch(
  () => examStore.myProgress?.allSolved,
  (allSolved) => {
    if (allSolved) celebration.start();
  },
);

const examState = computed(() => {
  if (loading.value) return 'loading';
  if (!examStore.activeExam) return 'no-exam';
  if (examStore.myProgress?.allSolved) return 'completed';
  if (isExpired.value) return 'ended';
  return 'active';
});

function goDashboard() {
  if (document.fullscreenElement) {
    try {
      void document.exitFullscreen();
    } catch {
      // ignore
    }
  }
  void router.push('/dashboard');
}
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden bg-white dark:bg-bg-primary">
    <!-- Header -->
    <AppHeader />

    <!-- Loading state -->
    <div
      v-if="examState === 'loading'"
      class="flex flex-1 items-center justify-center"
    >
      <span
        class="material-symbols-outlined text-4xl text-slate-400 animate-spin"
        >progress_activity</span
      >
    </div>

    <!-- No active exam -->
    <div
      v-else-if="examState === 'no-exam'"
      class="flex flex-1 items-center justify-center state-screen-enter"
    >
      <div class="text-center max-w-sm px-6 flex flex-col items-center">
        <span
          class="material-symbols-outlined text-5xl text-slate-400 mb-4 block"
          >event_busy</span
        >
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          No active exam right now
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Check back when an exam is scheduled. You'll be notified when it goes
          live.
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 active:scale-95 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer"
          @click="goDashboard"
        >
          <span class="material-symbols-outlined text-[18px]">dashboard</span>
          <span>Back to Dashboard</span>
        </button>
      </div>
    </div>

    <!-- All problems solved -->
    <div
      v-else-if="examState === 'completed'"
      class="flex flex-1 items-center justify-center state-screen-enter"
    >
      <div class="text-center max-w-sm px-6 flex flex-col items-center">
        <span
          class="material-symbols-outlined text-5xl text-emerald-400 mb-4 block trophy-bounce"
          >emoji_events</span
        >
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          You've completed the exam!
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {{ examStore.myProgress?.solvedProblems }} /
          {{ examStore.myProgress?.totalProblems }} problems solved
        </p>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Sit tight, results will be announced after the exam closes.
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 active:scale-95 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer"
          @click="goDashboard"
        >
          <span class="material-symbols-outlined text-[18px]">dashboard</span>
          <span>Back to Dashboard</span>
        </button>
      </div>
      <!-- Celebration toggle button -->
      <button
        class="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 dark:bg-slate-800 border border-white/[0.10] text-white text-sm font-semibold shadow-xl hover:bg-slate-700 transition-colors z-50"
        :title="`Current: ${celebration.mode.value} - click to change`"
        @click="celebration.toggleMode()"
      >
        <span v-if="celebration.mode.value === 'snow'">❄️ Snow</span>
        <span v-else-if="celebration.mode.value === 'fireworks'"
          >🎆 Fireworks</span
        >
        <span v-else-if="celebration.mode.value === 'realistic'"
          >🎊 Realistic</span
        >
        <span v-else-if="celebration.mode.value === 'stars'">⭐ Stars</span>
        <span v-else-if="celebration.mode.value === 'cannon'">🎯 Cannon</span>
        <span v-else-if="celebration.mode.value === 'continuous'"
          >🎉 Continuous</span
        >
        <span v-else-if="celebration.mode.value === 'emoji'">😄 Emoji</span>
      </button>
    </div>

    <!-- Exam ended (timer expired) -->
    <div
      v-else-if="examState === 'ended'"
      class="flex flex-1 items-center justify-center state-screen-enter"
    >
      <div class="text-center max-w-sm px-6 flex flex-col items-center">
        <span class="material-symbols-outlined text-5xl text-primary mb-4 block"
          >timer_off</span
        >
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Exam has ended
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-2">
          Time's up - no more submissions are accepted.
        </p>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Your submissions have been recorded. Results coming soon.
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 active:scale-95 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer"
          @click="goDashboard"
        >
          <span class="material-symbols-outlined text-[18px]">dashboard</span>
          <span>Back to Dashboard</span>
        </button>
      </div>
    </div>

    <!-- Active exam workspace -->
    <template v-else>
      <ExamWorkspace />
    </template>

    <SuccessModal
      v-if="successModal"
      v-bind="successModal"
      @close="successModal = null"
      @go-submit="
        successModal = null;
        runSubmit.submit();
      "
    />

    <Toast />
  </div>
</template>

<style scoped>
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.state-screen-enter {
  animation: fade-up 0.25s ease-out both;
}

@keyframes trophy-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-4px);
  }
}
.trophy-bounce {
  animation: trophy-bounce 0.7s ease-out 0.15s both;
}
</style>
