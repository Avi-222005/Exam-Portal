<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getExam,
  createExam,
  updateExam,
  deleteExam,
  invalidateCachedExams,
  listExamProblems,
  unassignProblemFromExam,
  createProblemsBulk,
  batchAssignProblems,
  reorderExamProblems,
} from '../../services/adminApi';
import type { ProblemWithTestCases, CreateProblemPayload } from '../../types/admin';
import ConfirmModal from '../../components/shared/ConfirmModal.vue';
import LinkProblemModal from './LinkProblemModal.vue';
import BulkImportModal from './BulkImportModal.vue';
import QuickEditProblemModal from './QuickEditProblemModal.vue';
import ExamCandidateModal from './ExamCandidateModal.vue';
import RegalDateTimePicker from '../../components/admin/RegalDateTimePicker.vue';
import { LANGUAGE_NAMES } from '../../data/languages';

const route = useRoute();
const router = useRouter();

const examId = computed(() => {
  const id = route.params.id;
  return id ? parseInt(String(id), 10) : null;
});
const isEdit = computed(() => examId.value !== null);

// ── Active Step in Studio ─────────────────────────────────────────────────────
const currentStep = ref<1 | 2 | 3>(1);

// ── Step 1: Exam Settings ─────────────────────────────────────────────────────
const title = ref('');
const startTime = ref('');
const endTime = ref('');
const durationMinutes = ref(120);
const isActive = ref(false);
const accessType = ref<'open' | 'passcode' | 'whitelist'>('open');
const passcode = ref('');
const maxViolations = ref(5);
const showCandidateModal = ref(false);
const selectedLanguages = ref<number[]>([71, 62, 63, 54, 50]); // Python, Java, NodeJS, C++, C default

const ALL_LANGUAGES = Object.entries(LANGUAGE_NAMES).map(([id, label]) => ({
  id: Number(id),
  label,
}));

// ── Step 2 & 3: Problems & Draft Studio ──────────────────────────────────────
const existingProblems = ref<ProblemWithTestCases[]>([]);
const draftProblems = ref<CreateProblemPayload[]>([]);
const pendingLinkedProblemIds = ref<number[]>([]);
const pendingLinkedProblems = ref<
  {
    id: number;
    title: string;
    difficulty: string | null;
    testCaseCount: number;
  }[]
>([]);

const showBulkImportModal = ref(false);
const showLinkModal = ref(false);
const inlineComposerMode = ref<'none' | 'mcq' | 'coding'>('none');

// ── Quick Edit Modal State ───────────────────────────────────────────────────
const showQuickEditModal = ref(false);
const editingProblemId = ref<number | null>(null);
const editingDraftProblem = ref<CreateProblemPayload | null>(null);
const editingDraftIndex = ref<number | null>(null);

function openEditExisting(problem: ProblemWithTestCases) {
  editingProblemId.value = problem.id;
  editingDraftProblem.value = null;
  editingDraftIndex.value = null;
  showQuickEditModal.value = true;
}

function openEditDraft(draft: CreateProblemPayload, index: number) {
  editingProblemId.value = null;
  editingDraftProblem.value = draft;
  editingDraftIndex.value = index;
  showQuickEditModal.value = true;
}

function onQuickProblemSaved(payload: {
  isDraft: boolean;
  problem: ProblemWithTestCases | CreateProblemPayload;
  draftIndex?: number | null;
}) {
  if (payload.isDraft && payload.draftIndex !== null && payload.draftIndex !== undefined) {
    draftProblems.value[payload.draftIndex] = payload.problem as CreateProblemPayload;
  } else if (!payload.isDraft) {
    const updated = payload.problem as ProblemWithTestCases;
    const idx = existingProblems.value.findIndex((p) => p.id === updated.id);
    if (idx >= 0) {
      existingProblems.value[idx] = updated;
    }
  }
}

// ── Quick MCQ Form state ──────────────────────────────────────────────────────
const quickMcqStem = ref('');
const quickMcqImageData = ref<string | null>(null);
const quickMcqOptions = ref<Array<{ text: string; isCorrect: boolean }>>([
  { text: '', isCorrect: true },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
]);
const quickMcqMarks = ref(1);
const quickMcqIsMulti = ref(false);

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const b64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function onQuickMcqImageUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return;
  quickMcqImageData.value = await readFileAsBase64(file);
  target.value = '';
}

function removeQuickMcqImage() {
  quickMcqImageData.value = null;
}

// ── Quick Coding Form state ───────────────────────────────────────────────────
const quickCodeTitle = ref('');
const quickCodeDescription = ref('');
const quickCodeInputFormat = ref('');
const quickCodeOutputFormat = ref('');
const quickCodeMarks = ref(10);
const quickCodeSampleInput = ref('');
const quickCodeSampleOutput = ref('');

// ── UI state ──────────────────────────────────────────────────────────────────
const loading = ref(false);
const loadError = ref('');
const saving = ref(false);
const errors = ref<Record<string, string>>({});
const showDeleteConfirm = ref(false);
const deleting = ref(false);
const problemsLoading = ref(false);

// ── Helpers ───────────────────────────────────────────────────────────────────
function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function setStartNow() {
  const now = new Date();
  startTime.value = toLocalInput(now.toISOString());
  const end = new Date(now.getTime() + durationMinutes.value * 60 * 1000);
  endTime.value = toLocalInput(end.toISOString());
}

function setDurationPreset(mins: number) {
  durationMinutes.value = mins;
  if (startTime.value) {
    const start = new Date(startTime.value);
    const end = new Date(start.getTime() + mins * 60 * 1000);
    endTime.value = toLocalInput(end.toISOString());
  }
}

function selectLanguagePreset(type: 'all' | 'popular' | 'python' | 'web') {
  if (type === 'all') {
    selectedLanguages.value = ALL_LANGUAGES.map((l) => l.id);
  } else if (type === 'popular') {
    selectedLanguages.value = [71, 62, 63, 54, 50]; // Python, Java, Node, C++, C
  } else if (type === 'python') {
    selectedLanguages.value = [71];
  } else if (type === 'web') {
    selectedLanguages.value = [63, 74]; // Node, TS
  }
}

function toggleLanguage(id: number) {
  const idx = selectedLanguages.value.indexOf(id);
  if (idx >= 0) selectedLanguages.value.splice(idx, 1);
  else selectedLanguages.value.push(id);
}

// ── Load Exam (edit mode) ─────────────────────────────────────────────────────
async function loadExamData() {
  if (!examId.value) {
    setStartNow();
    return;
  }
  loading.value = true;
  loadError.value = '';
  try {
    const exam = await getExam(examId.value);
    title.value = exam.title;
    startTime.value = toLocalInput(exam.startTime);
    endTime.value = toLocalInput(exam.endTime);
    durationMinutes.value = exam.durationMinutes;
    isActive.value = exam.isActive;
    accessType.value = (exam.accessType as 'open' | 'passcode' | 'whitelist') || 'open';
    passcode.value = exam.passcode || '';
    maxViolations.value = exam.maxViolations ?? 5;
    selectedLanguages.value = [...(exam.allowedLanguages || [])];

    // Populate from getExam if available
    if (exam.problems && Array.isArray(exam.problems)) {
      existingProblems.value = exam.problems;
    }

    problemsLoading.value = true;
    try {
      const result = await listExamProblems(examId.value, { page: 1, limit: 150 });
      if (result && Array.isArray(result.data) && result.data.length > 0) {
        existingProblems.value = result.data;
      }
    } catch {
      // non-critical
    } finally {
      problemsLoading.value = false;
    }
  } catch (err) {
    console.error('Failed to load exam:', err);
    loadError.value = 'Failed to load exam. Please go back and try again.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadExamData();
});

watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      void loadExamData();
    }
  },
);

// ── Quick Add Methods ─────────────────────────────────────────────────────────
function resetQuickMcq() {
  quickMcqStem.value = '';
  quickMcqImageData.value = null;
  quickMcqOptions.value = [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ];
  quickMcqMarks.value = 1;
  quickMcqIsMulti.value = false;
}

function setMcqCorrect(index: number) {
  if (!quickMcqIsMulti.value) {
    quickMcqOptions.value.forEach((o, i) => {
      o.isCorrect = i === index;
    });
  } else {
    quickMcqOptions.value[index].isCorrect = !quickMcqOptions.value[index].isCorrect;
  }
}

function addQuickMcq() {
  if (!quickMcqStem.value.trim()) return;
  const validOpts = quickMcqOptions.value.filter((o) => o.text.trim().length > 0);
  if (validOpts.length < 2) return;

  if (!validOpts.some((o) => o.isCorrect)) {
    validOpts[0].isCorrect = true;
  }

  const payload: CreateProblemPayload = {
    title: quickMcqStem.value.trim().split('\n')[0].slice(0, 100),
    description: quickMcqStem.value.trim(),
    questionType: 'mcq',
    questionImageData: quickMcqImageData.value ?? undefined,
    isMultiSelect: quickMcqIsMulti.value,
    difficulty: 'easy',
    maxScore: quickMcqMarks.value || 1,
    displayOrder: totalQuestionsCount.value + 1,
    examId: examId.value ?? undefined,
    mcqOptions: validOpts.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
  };

  draftProblems.value.push(payload);
  resetQuickMcq();
}

function resetQuickCoding() {
  quickCodeTitle.value = '';
  quickCodeDescription.value = '';
  quickCodeInputFormat.value = '';
  quickCodeOutputFormat.value = '';
  quickCodeMarks.value = 10;
  quickCodeSampleInput.value = '';
  quickCodeSampleOutput.value = '';
}

function addQuickCoding() {
  if (!quickCodeTitle.value.trim()) return;

  const testCases = [];
  if (quickCodeSampleInput.value || quickCodeSampleOutput.value) {
    testCases.push({
      input: quickCodeSampleInput.value,
      expectedOutput: quickCodeSampleOutput.value,
      isVisible: true,
      displayOrder: 1,
    });
  }

  const payload: CreateProblemPayload = {
    title: quickCodeTitle.value.trim(),
    description: quickCodeDescription.value.trim(),
    inputFormat: quickCodeInputFormat.value.trim() || undefined,
    outputFormat: quickCodeOutputFormat.value.trim() || undefined,
    questionType: 'coding',
    difficulty: 'medium',
    maxScore: quickCodeMarks.value || 10,
    displayOrder: totalQuestionsCount.value + 1,
    examId: examId.value ?? undefined,
    testCases,
  };

  draftProblems.value.push(payload);
  resetQuickCoding();
}

function handleBulkImported(importedList: CreateProblemPayload[]) {
  draftProblems.value.push(...importedList);
  showBulkImportModal.value = false;
}

function onProblemSelected(problem: {
  id: number;
  title: string;
  difficulty: string | null;
  testCases?: unknown[];
}) {
  if (isEdit.value) {
    pendingLinkedProblemIds.value.push(problem.id);
  } else {
    pendingLinkedProblems.value.push({
      id: problem.id,
      title: problem.title,
      difficulty: problem.difficulty,
      testCaseCount: problem.testCases?.length || 0,
    });
  }
}

// ── Reordering & Removal ──────────────────────────────────────────────────────
function moveDraftProblem(index: number, direction: 'up' | 'down') {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= draftProblems.value.length) return;
  const item = draftProblems.value.splice(index, 1)[0];
  draftProblems.value.splice(target, 0, item);
}

function removeDraftProblem(index: number) {
  draftProblems.value.splice(index, 1);
}

async function moveExistingProblem(index: number, direction: 'up' | 'down') {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= existingProblems.value.length) return;
  const item = existingProblems.value.splice(index, 1)[0];
  existingProblems.value.splice(target, 0, item);

  if (isEdit.value && examId.value) {
    const orders = existingProblems.value.map((p, i) => ({
      problemId: p.id,
      displayOrder: i + 1,
    }));
    try {
      await reorderExamProblems(examId.value, orders);
    } catch {
      // ignore
    }
  }
}

async function unlinkExistingProblem(problemId: number) {
  if (!examId.value) return;
  try {
    await unassignProblemFromExam(examId.value, problemId);
    existingProblems.value = existingProblems.value.filter((p) => p.id !== problemId);
  } catch {
    errors.value.submit = 'Failed to unlink problem.';
  }
}

// ── Calculated Overview ───────────────────────────────────────────────────────
const totalQuestionsCount = computed(() => {
  return (
    existingProblems.value.length +
    draftProblems.value.length +
    pendingLinkedProblems.value.length
  );
});

const mcqCount = computed(() => {
  const existing = existingProblems.value.filter((p) => p.questionType === 'mcq').length;
  const draft = draftProblems.value.filter((p) => p.questionType === 'mcq').length;
  return existing + draft;
});

const codingCount = computed(() => {
  const existing = existingProblems.value.filter((p) => p.questionType !== 'mcq').length;
  const draft = draftProblems.value.filter((p) => p.questionType !== 'mcq').length;
  const pending = pendingLinkedProblems.value.length;
  return existing + draft + pending;
});

const totalMarks = computed(() => {
  const existing = existingProblems.value.reduce(
    (sum, p) => sum + (p.maxScore ?? (p.questionType === 'mcq' ? 1 : 10)),
    0,
  );
  const draft = draftProblems.value.reduce((sum, p) => sum + (p.maxScore || 10), 0);
  const pending = pendingLinkedProblems.value.reduce((sum) => sum + 10, 0);
  return existing + draft + pending;
});

// ── Validation ────────────────────────────────────────────────────────────────
function validate(): boolean {
  errors.value = {};
  if (!title.value.trim()) errors.value.title = 'Title is required.';
  if (!startTime.value) errors.value.startTime = 'Start time is required.';
  if (!endTime.value) errors.value.endTime = 'End time is required.';
  if (startTime.value && endTime.value) {
    const start = new Date(startTime.value);
    const end = new Date(endTime.value);
    if (end <= start) errors.value.endTime = 'End time must be after start time.';
  }
  if (!durationMinutes.value || durationMinutes.value < 1) {
    errors.value.durationMinutes = 'Duration must be at least 1 minute.';
  }
  if (selectedLanguages.value.length === 0) {
    errors.value.languages = 'At least one programming language must be allowed.';
  }
  if (accessType.value === 'passcode' && !passcode.value.trim()) {
    errors.value.passcode = 'Passcode is required when exam is passcode-protected.';
  }
  return Object.keys(errors.value).length === 0;
}

// ── Save/Publish ──────────────────────────────────────────────────────────────
async function save() {
  if (!validate()) {
    currentStep.value = 1;
    return;
  }

  saving.value = true;
  errors.value = {};

  try {
    const payload = {
      title: title.value.trim(),
      startTime: new Date(startTime.value).toISOString(),
      endTime: new Date(endTime.value).toISOString(),
      durationMinutes: durationMinutes.value,
      isActive: isActive.value,
      accessType: accessType.value,
      passcode: accessType.value === 'passcode' ? passcode.value.trim() : null,
      maxViolations: Number(maxViolations.value) >= 1 ? Number(maxViolations.value) : 5,
      allowedLanguages: selectedLanguages.value,
    };

    let targetExamId = examId.value;

    if (isEdit.value && targetExamId) {
      await updateExam(targetExamId, payload);
    } else {
      const created = await createExam(payload);
      targetExamId = created.id;
    }

    // Bulk create draft problems
    if (draftProblems.value.length > 0 && targetExamId) {
      await createProblemsBulk(draftProblems.value, targetExamId);
    }

    // Link pending existing problems
    if (pendingLinkedProblems.value.length > 0 && targetExamId) {
      await batchAssignProblems(
        targetExamId,
        pendingLinkedProblems.value.map((p) => p.id),
      );
    }

    invalidateCachedExams();
    void router.push({ name: 'admin-exams' });
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })
      ?.response?.data?.message;
    errors.value.submit = msg ?? 'Save failed. Please try again.';
  } finally {
    saving.value = false;
  }
}

async function onDelete() {
  deleting.value = true;
  try {
    await deleteExam(examId.value!);
    invalidateCachedExams();
    void router.push({ name: 'admin-exams' });
  } catch {
    errors.value.submit = 'Delete failed. Please try again.';
    showDeleteConfirm.value = false;
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="w-full max-w-[1440px] pb-24 mx-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div class="flex items-center gap-3">
        <RegalButton @click="router.push({ name: 'admin-exams' })">
          ← Back
        </RegalButton>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{{ isEdit ? 'Edit Exam' : 'Create New Exam' }}</span>
            <span
              v-if="isEdit"
              class="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-bold"
            >
              #{{ examId }}
            </span>
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Configure exam duration, access rules, and build MCQ & coding sections.
          </p>
        </div>
      </div>

      <!-- Header Actions -->
      <div class="flex items-center gap-3">
        <button
          v-if="isEdit"
          type="button"
          class="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-semibold px-3 py-2 rounded-xl border border-red-200 dark:border-red-950 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer flex items-center gap-1.5"
          @click="showDeleteConfirm = true"
        >
          <span class="material-symbols-outlined text-[16px]">delete</span>
          <span>Delete Exam</span>
        </button>

        <button
          v-if="currentStep === 3"
          type="button"
          class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          :disabled="saving"
          @click="save"
        >
          <span v-if="saving" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
          <span v-else class="material-symbols-outlined text-[16px]">publish</span>
          <span>{{ isEdit ? 'Save Changes' : 'Publish Exam' }}</span>
        </button>
      </div>
    </div>

    <!-- Stepper Navigation -->
    <div class="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl mb-8 select-none border border-slate-200 dark:border-slate-800">
      <button
        type="button"
        class="flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
        :class="
          currentStep === 1
            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        "
        @click="currentStep = 1"
      >
        <span
          class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
          :class="currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'"
        >
          1
        </span>
        <span class="truncate">1. Exam Settings</span>
      </button>

      <button
        type="button"
        class="flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
        :class="
          currentStep === 2
            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        "
        @click="currentStep = 2"
      >
        <span
          class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
          :class="currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'"
        >
          2
        </span>
        <span class="truncate">2. Questions Studio ({{ totalQuestionsCount }})</span>
      </button>

      <button
        type="button"
        class="flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
        :class="
          currentStep === 3
            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        "
        @click="currentStep = 3"
      >
        <span
          class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
          :class="currentStep === 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'"
        >
          3
        </span>
        <span class="truncate">3. Review & Publish</span>
      </button>
    </div>

    <!-- Error Banner -->
    <div
      v-if="errors.submit"
      class="mb-6 text-xs text-red-600 dark:text-red-400 px-4 py-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl"
    >
      {{ errors.submit }}
    </div>

    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <!-- STEP 1: EXAM SETTINGS (WIDESCREEN 2-COLUMN ARCHITECTURE)                  -->
    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <div v-if="currentStep === 1" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Form Configuration (8 Cols) -->
      <div class="lg:col-span-8 flex flex-col gap-6">
        <!-- Basic Info Card -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col gap-5">
          <div class="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span class="material-symbols-outlined text-[20px] text-blue-600">tune</span>
            <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Basic Exam Details
            </h3>
          </div>

          <!-- Title -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
              Exam Title <span class="text-red-500">*</span>
            </label>
            <input
              v-model="title"
              type="text"
              class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-hidden transition-colors font-semibold"
              placeholder="e.g. Data Structures & Algorithms Midterm Exam 2026"
            />
            <span v-if="errors.title" class="text-xs text-red-500">{{ errors.title }}</span>
          </div>

          <!-- Duration & Presets -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
                Duration (minutes) <span class="text-red-500">*</span>
              </label>
              <div class="flex items-center gap-1.5 text-[11px]">
                <span class="text-slate-400">Presets:</span>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer font-medium"
                  @click="setDurationPreset(30)"
                >30m</button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer font-medium"
                  @click="setDurationPreset(60)"
                >60m</button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer font-medium"
                  @click="setDurationPreset(90)"
                >90m</button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer font-medium"
                  @click="setDurationPreset(120)"
                >120m</button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer font-medium"
                  @click="setDurationPreset(180)"
                >180m</button>
              </div>
            </div>
            <input
              v-model.number="durationMinutes"
              type="number"
              min="1"
              class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-hidden"
            />
            <span v-if="errors.durationMinutes" class="text-xs text-red-500">{{ errors.durationMinutes }}</span>
          </div>
        </div>

        <!-- Examination Schedule Card -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col gap-5">
          <div class="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span class="material-symbols-outlined text-[20px] text-emerald-600">calendar_month</span>
            <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Examination Window & Schedule
            </h3>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Start Time <span class="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  class="text-[11px] text-primary hover:underline cursor-pointer font-medium"
                  @click="setStartNow"
                >
                  Set to Now
                </button>
              </div>
              <RegalDateTimePicker
                v-model="startTime"
                placeholder="Select start date & time"
                :has-error="!!errors.startTime"
              />
              <span v-if="errors.startTime" class="text-xs text-red-500">{{ errors.startTime }}</span>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
                End Time <span class="text-red-500">*</span>
              </label>
              <RegalDateTimePicker
                v-model="endTime"
                placeholder="Select end date & time"
                :has-error="!!errors.endTime"
              />
              <span v-if="errors.endTime" class="text-xs text-red-500">{{ errors.endTime }}</span>
            </div>
          </div>
        </div>

        <!-- Access Control & Enrollment Policy Card -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col gap-5">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px] text-amber-500">shield_person</span>
              <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Enrollment & Access Control
              </h3>
            </div>
            <RegalButton
              v-if="isEdit && examId"
              size="xs"
              variant="secondary"
              @click="showCandidateModal = true"
            >
              <span class="material-symbols-outlined text-[14px]">how_to_reg</span>
              Manage Candidates
            </RegalButton>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <!-- Option 1: Open -->
            <div
              class="border rounded-xl p-3.5 flex flex-col gap-2 cursor-pointer transition-all"
              :class="
                accessType === 'open'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              "
              @click="accessType = 'open'"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[17px] text-emerald-500">public</span>
                  Open Access
                </span>
                <input
                  type="radio"
                  name="accessType"
                  value="open"
                  :checked="accessType === 'open'"
                  class="text-emerald-600 focus:ring-0 cursor-pointer"
                />
              </div>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">
                Any registered student can view and self-enroll in this contest.
              </p>
            </div>

            <!-- Option 2: Passcode Protected -->
            <div
              class="border rounded-xl p-3.5 flex flex-col gap-2 cursor-pointer transition-all"
              :class="
                accessType === 'passcode'
                  ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 ring-1 ring-purple-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              "
              @click="accessType = 'passcode'"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[17px] text-purple-500">key</span>
                  Passcode Protected
                </span>
                <input
                  type="radio"
                  name="accessType"
                  value="passcode"
                  :checked="accessType === 'passcode'"
                  class="text-purple-600 focus:ring-0 cursor-pointer"
                />
              </div>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">
                Students must enter an access code / passcode to unlock and enroll.
              </p>
            </div>

            <!-- Option 3: Whitelist Only -->
            <div
              class="border rounded-xl p-3.5 flex flex-col gap-2 cursor-pointer transition-all"
              :class="
                accessType === 'whitelist'
                  ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              "
              @click="accessType = 'whitelist'"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[17px] text-amber-500">verified_user</span>
                  Whitelist Only
                </span>
                <input
                  type="radio"
                  name="accessType"
                  value="whitelist"
                  :checked="accessType === 'whitelist'"
                  class="text-amber-600 focus:ring-0 cursor-pointer"
                />
              </div>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">
                Restricted to candidates assigned/enrolled by the Admin.
              </p>
            </div>
          </div>

          <!-- Passcode Input Field (if passcode selected) -->
          <div v-if="accessType === 'passcode'" class="flex flex-col gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
              Exam Passcode / Access Code <span class="text-red-500">*</span>
            </label>
            <div class="relative max-w-md">
              <input
                v-model="passcode"
                type="text"
                class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 dark:text-white uppercase focus:border-purple-500 outline-hidden font-bold"
                placeholder="e.g. EXAM2026 or LAB-TEST-4"
              />
            </div>
            <p class="text-[11px] text-slate-400">
              Candidates will be prompted to enter this passcode on their dashboard before they can enroll.
            </p>
            <span v-if="errors.passcode" class="text-xs text-red-500">{{ errors.passcode }}</span>
          </div>

          <!-- Whitelist Info (if whitelist selected) -->
          <div v-if="accessType === 'whitelist'" class="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">info</span>
              <span>Only candidates enrolled in the Candidate List will be permitted to access this test.</span>
            </div>
            <button
              v-if="isEdit && examId"
              type="button"
              class="font-bold underline cursor-pointer hover:text-amber-800 dark:hover:text-amber-200 whitespace-nowrap"
              @click="showCandidateModal = true"
            >
              Manage Candidates →
            </button>
          </div>
        </div>

        <!-- Proctoring & Anti-Cheating Policy Card -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col gap-5">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px] text-rose-600">gpp_maybe</span>
              <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Anti-Cheating & Proctoring Policy
              </h3>
            </div>
            <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-800/80">
              Lockout Limit
            </span>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Maximum Allowed Violations / Focus Losses
                </label>
                <div class="flex items-center gap-1.5 text-[11px]">
                  <span class="text-slate-400">Presets:</span>
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer font-medium"
                    @click="maxViolations = 3"
                  >Strict (3)</button>
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer font-medium"
                    @click="maxViolations = 5"
                  >Standard (5)</button>
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer font-medium"
                    @click="maxViolations = 10"
                  >Lenient (10)</button>
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer font-medium"
                    @click="maxViolations = 999"
                  >No Limit</button>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <input
                  v-model.number="maxViolations"
                  type="number"
                  min="1"
                  max="999"
                  class="w-32 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white font-bold focus:border-rose-500 outline-hidden"
                />
                <span class="text-xs text-slate-500 dark:text-slate-400">
                  {{ maxViolations >= 999 ? 'Unlimited violations allowed (no auto-lockout)' : `violations allowed before the exam is automatically locked & submitted` }}
                </span>
              </div>
              <p class="text-[11px] text-slate-400 mt-1">
                Monitors tab switching, window blurring, browser side panels (Gemini / Copilot), and full-screen exits.
              </p>
            </div>
          </div>
        </div>

        <!-- Programming Environments Card -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col gap-5">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px] text-purple-600">code_blocks</span>
              <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Allowed Programming Languages
              </h3>
            </div>
            <div class="flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer font-semibold"
                @click="selectLanguagePreset('all')"
              >All</button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer font-semibold"
                @click="selectLanguagePreset('popular')"
              >Popular</button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer font-semibold"
                @click="selectLanguagePreset('python')"
              >Python Only</button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer font-semibold"
                @click="selectLanguagePreset('web')"
              >Web (JS/TS)</button>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <label
              v-for="lang in ALL_LANGUAGES"
              :key="lang.id"
              class="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-all select-none"
              :class="
                selectedLanguages.includes(lang.id)
                  ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              "
            >
              <input
                type="checkbox"
                class="hidden"
                :checked="selectedLanguages.includes(lang.id)"
                @change="toggleLanguage(lang.id)"
              />
              <span class="w-2 h-2 rounded-full" :class="selectedLanguages.includes(lang.id) ? 'bg-blue-600' : 'bg-slate-400'" />
              <span>{{ lang.label }}</span>
            </label>
          </div>
          <span v-if="errors.languages" class="text-xs text-red-500">{{ errors.languages }}</span>
        </div>
      </div>

      <!-- Right Column: Live Inspector & Summary Panel (4 Cols) -->
      <div class="lg:col-span-4 flex flex-col gap-6">
        <!-- Live Overview Card -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col gap-4 sticky top-6">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Exam Snapshot
            </h4>
            <span
              class="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
              :class="isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'"
            >
              {{ isActive ? 'Active / Visible' : 'Draft / Hidden' }}
            </span>
          </div>

          <div class="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span class="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-0.5">Title Preview</span>
            <span class="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
              {{ title || 'Untitled Exam' }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div class="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
              <span class="text-[10px] text-slate-400 font-semibold uppercase">Duration</span>
              <span class="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">{{ durationMinutes }} min</span>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
              <span class="text-[10px] text-slate-400 font-semibold uppercase">Languages</span>
              <span class="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">{{ selectedLanguages.length }} enabled</span>
            </div>
          </div>

          <!-- Active toggle switch -->
          <div class="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Student Access
              </span>
              <span class="text-[11px] text-slate-500">
                Visible on student portal
              </span>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="isActive"
              class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out"
              :class="isActive ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'"
              @click="isActive = !isActive"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out"
                :class="isActive ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>

          <!-- Anti-Cheat Info Card -->
          <div class="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl flex flex-col gap-2">
            <div class="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
              <span class="material-symbols-outlined text-[18px]">verified_user</span>
              <span>Proctoring Guard Active</span>
            </div>
            <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Anti-cheat proctoring will automatically enforce fullscreen, prevent tab switching, and track question timing during the test.
            </p>
          </div>

          <!-- Next Step Button -->
          <button
            type="button"
            class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
            @click="currentStep = 2"
          >
            <span>Next: Questions Studio ({{ totalQuestionsCount }})</span>
            <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <!-- STEP 2: QUESTIONS STUDIO (TOP 4 OPTIONS + FULL-WIDTH PALETTE BELOW)       -->
    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <div v-else-if="currentStep === 2" class="flex flex-col gap-6">
      <!-- Top Row: 4 Action Buttons -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          type="button"
          class="p-4 sm:p-5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all text-center cursor-pointer shadow-xs"
          :class="
            inlineComposerMode === 'mcq'
              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-slate-700 hover:shadow-sm'
          "
          @click="inlineComposerMode = inlineComposerMode === 'mcq' ? 'none' : 'mcq'"
        >
          <span class="material-symbols-outlined text-[28px] text-blue-600 dark:text-blue-400">check_circle</span>
          <div>
            <span class="text-xs font-bold block">+ Quick MCQ</span>
            <span class="text-[10px] text-slate-400">Single / multi-choice</span>
          </div>
        </button>

        <button
          type="button"
          class="p-4 sm:p-5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all text-center cursor-pointer shadow-xs"
          :class="
            inlineComposerMode === 'coding'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-400 dark:hover:border-slate-700 hover:shadow-sm'
          "
          @click="inlineComposerMode = inlineComposerMode === 'coding' ? 'none' : 'coding'"
        >
          <span class="material-symbols-outlined text-[28px] text-emerald-600 dark:text-emerald-400">code</span>
          <div>
            <span class="text-xs font-bold block">+ Quick Coding</span>
            <span class="text-[10px] text-slate-400">Coding challenge</span>
          </div>
        </button>

        <button
          type="button"
          class="p-4 sm:p-5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400 dark:hover:border-slate-700 hover:shadow-sm flex flex-col items-center justify-center gap-2 transition-all text-center cursor-pointer shadow-xs"
          @click="showBulkImportModal = true"
        >
          <span class="material-symbols-outlined text-[28px] text-amber-500">dynamic_feed</span>
          <div>
            <span class="text-xs font-bold block">⚡ Bulk Import</span>
            <span class="text-[10px] text-slate-400">AI text / CSV file</span>
          </div>
        </button>

        <button
          type="button"
          class="p-4 sm:p-5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-purple-400 dark:hover:border-slate-700 hover:shadow-sm flex flex-col items-center justify-center gap-2 transition-all text-center cursor-pointer shadow-xs"
          @click="showLinkModal = true"
        >
          <span class="material-symbols-outlined text-[28px] text-purple-500">local_library</span>
          <div>
            <span class="text-xs font-bold block">📚 Question Bank</span>
            <span class="text-[10px] text-slate-400">Link from library</span>
          </div>
        </button>
      </div>

      <!-- ── Inline MCQ Composer (Full Width) ────────────────────────── -->
      <div
        v-if="inlineComposerMode === 'mcq'"
        class="p-6 bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl shadow-md flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Quick MCQ Composer
            </h3>
          </div>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input v-model="quickMcqIsMulti" type="checkbox" class="rounded text-blue-600" />
              <span>Multi-Select</span>
            </label>
            <div class="flex items-center gap-1 text-xs">
              <span class="text-slate-500">Marks:</span>
              <input
                v-model.number="quickMcqMarks"
                type="number"
                min="1"
                class="w-12 p-1 text-center bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-xs font-bold"
              />
            </div>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-600 cursor-pointer"
              @click="inlineComposerMode = 'none'"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        <textarea
          v-model="quickMcqStem"
          rows="3"
          class="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 outline-hidden"
          placeholder="Enter the MCQ question stem here..."
          @keydown.ctrl.enter="addQuickMcq"
        />

        <!-- Photo / Diagram Attachment in Quick MCQ -->
        <div v-if="quickMcqImageData" class="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="flex items-center gap-3 min-w-0">
            <div class="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0">
              <img :src="`data:image/png;base64,${quickMcqImageData}`" alt="MCQ diagram" class="w-full h-full object-contain" />
            </div>
            <div class="min-w-0">
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px] text-blue-500">image</span>
                <span>Diagram / Photo Attached</span>
              </span>
              <span class="text-[10px] text-slate-400 block truncate">Image will appear above choices for students</span>
            </div>
          </div>
          <button
            type="button"
            class="px-2.5 py-1 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer flex-shrink-0"
            @click="removeQuickMcqImage"
          >
            Remove Photo
          </button>
        </div>

        <div v-else class="flex items-center justify-between">
          <label class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-colors">
            <span class="material-symbols-outlined text-[16px] text-blue-500">add_photo_alternate</span>
            <span>Attach Diagram / Photo</span>
            <input type="file" accept="image/*" class="hidden" @change="onQuickMcqImageUpload" />
          </label>
        </div>

        <!-- Choices -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="(opt, idx) in quickMcqOptions"
            :key="idx"
            class="flex items-center gap-2.5 p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950/60"
            :class="opt.isCorrect ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 dark:border-slate-800'"
          >
            <button
              type="button"
              class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold cursor-pointer transition-colors flex-shrink-0"
              :class="
                opt.isCorrect
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300'
              "
              :title="opt.isCorrect ? 'Correct Option (click to toggle)' : 'Mark as Correct Option'"
              @click="setMcqCorrect(idx)"
            >
              {{ String.fromCharCode(65 + idx) }}
            </button>
            <input
              v-model="opt.text"
              type="text"
              class="flex-1 bg-transparent border-none text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden"
              :placeholder="`Option ${String.fromCharCode(65 + idx)}`"
              @keydown.ctrl.enter="addQuickMcq"
            />
          </div>
        </div>

        <div class="flex items-center justify-between pt-2">
          <span class="text-[11px] text-slate-400">
            Tip: Press <kbd class="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border">Ctrl</kbd> + <kbd class="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border">Enter</kbd> to add & create next
          </span>
          <button
            type="button"
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            :disabled="!quickMcqStem.trim()"
            @click="addQuickMcq"
          >
            <span class="material-symbols-outlined text-[16px]">add</span>
            <span>Add MCQ Question</span>
          </button>
        </div>
      </div>

      <!-- ── Inline Coding Composer (Full Width) ─────────────────────── -->
      <div
        v-if="inlineComposerMode === 'coding'"
        class="p-6 bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-2xl shadow-md flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Quick Coding Problem Composer
            </h3>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1 text-xs">
              <span class="text-slate-500">Marks:</span>
              <input
                v-model.number="quickCodeMarks"
                type="number"
                min="1"
                class="w-14 p-1 text-center bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-xs font-bold"
              />
            </div>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-600 cursor-pointer"
              @click="inlineComposerMode = 'none'"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        <input
          v-model="quickCodeTitle"
          type="text"
          class="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 outline-hidden font-semibold"
          placeholder="Problem Title (e.g. Find Target Index in Sorted Array)"
        />

        <textarea
          v-model="quickCodeDescription"
          rows="3"
          class="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 outline-hidden"
          placeholder="Detailed problem statement..."
        />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <textarea
            v-model="quickCodeSampleInput"
            rows="2"
            class="w-full p-2.5 font-mono text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 outline-hidden"
            placeholder="Sample Input (e.g. [2,7,11,15], target = 9)"
          />
          <textarea
            v-model="quickCodeSampleOutput"
            rows="2"
            class="w-full p-2.5 font-mono text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 outline-hidden"
            placeholder="Sample Expected Output (e.g. [0,1])"
          />
        </div>

        <div class="flex justify-end pt-2">
          <button
            type="button"
            class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            :disabled="!quickCodeTitle.trim()"
            @click="addQuickCoding"
          >
            <span class="material-symbols-outlined text-[16px]">add</span>
            <span>Add Coding Problem</span>
          </button>
        </div>
      </div>

      <!-- ── Added Questions Palette (Full Width Below) ──────────────── -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Exam Questions Palette ({{ totalQuestionsCount }} Questions)
            </h3>
            <p class="text-[11px] text-slate-500 mt-0.5">
              Review and arrange questions linked to this examination.
            </p>
          </div>

          <div class="flex items-center gap-2 text-xs flex-wrap">
            <span class="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-xs">
              {{ mcqCount }} MCQs
            </span>
            <span class="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
              {{ codingCount }} Coding
            </span>
            <span class="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs">
              {{ totalMarks }} Marks
            </span>
          </div>
        </div>

        <div v-if="problemsLoading" class="text-center py-12 text-slate-400 text-xs">
          <span class="material-symbols-outlined animate-spin text-[24px] text-blue-500 block mb-2">progress_activity</span>
          Loading exam questions...
        </div>

        <div v-else-if="totalQuestionsCount === 0" class="text-center py-16 text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <span class="material-symbols-outlined text-[36px] text-slate-400 block mb-2">post_add</span>
          No questions added yet. Use the 4 options above (+ Quick MCQ, + Quick Coding, ⚡ Bulk Import, 📚 Question Bank) to add questions to this exam.
        </div>

        <div v-else class="flex flex-col gap-2.5 max-h-[600px] overflow-y-auto pr-1">
          <!-- Existing problems (edit mode) -->
          <div
            v-for="(p, pIdx) in existingProblems"
            :key="`existing-${p.id}`"
            class="p-3.5 sm:px-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-4 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer select-none"
            @click="openEditExisting(p)"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {{ pIdx + 1 }}
              </span>
              <span
                class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                :class="p.questionType === 'mcq' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'"
              >
                {{ p.questionType === 'mcq' ? 'MCQ' : 'Coding' }}
              </span>
              <div class="min-w-0">
                <span class="text-xs font-bold text-slate-900 dark:text-white truncate block">
                  {{ p.title }}
                </span>
                <span v-if="p.description" class="text-[11px] text-slate-400 line-clamp-1">
                  {{ p.description }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0" @click.stop>
              <span class="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mr-2">
                {{ p.maxScore ?? (p.questionType === 'mcq' ? 1 : 10) }} pts
              </span>

              <button
                type="button"
                class="px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Edit question details"
                @click="openEditExisting(p)"
              >
                Edit
              </button>

              <button
                type="button"
                class="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer"
                :disabled="pIdx === 0"
                title="Move question up"
                @click="moveExistingProblem(pIdx, 'up')"
              >
                <span class="material-symbols-outlined text-[16px]">arrow_upward</span>
              </button>
              <button
                type="button"
                class="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer"
                :disabled="pIdx === existingProblems.length - 1"
                title="Move question down"
                @click="moveExistingProblem(pIdx, 'down')"
              >
                <span class="material-symbols-outlined text-[16px]">arrow_downward</span>
              </button>
              <button
                type="button"
                class="w-7 h-7 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/60 flex items-center justify-center text-red-500 cursor-pointer"
                title="Remove from exam"
                @click="unlinkExistingProblem(p.id)"
              >
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </div>

          <!-- Pending draft problems (to be bulk created on save) -->
          <div
            v-for="(d, dIdx) in draftProblems"
            :key="`draft-${dIdx}`"
            class="p-3.5 sm:px-5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20 flex items-center justify-between gap-4 hover:bg-blue-50/70 dark:hover:bg-blue-950/50 hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer select-none"
            @click="openEditDraft(d, dIdx)"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {{ existingProblems.length + dIdx + 1 }}
              </span>
              <span
                class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                :class="d.questionType === 'mcq' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'"
              >
                {{ d.questionType === 'mcq' ? 'MCQ (Draft)' : 'Coding (Draft)' }}
              </span>
              <div class="min-w-0">
                <span class="text-xs font-bold text-slate-900 dark:text-white truncate block">
                  {{ d.title }}
                </span>
                <span v-if="d.description" class="text-[11px] text-slate-400 line-clamp-1">
                  {{ d.description }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0" @click.stop>
              <span class="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mr-2">
                {{ d.maxScore }} pts
              </span>

              <button
                type="button"
                class="px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Edit draft question details"
                @click="openEditDraft(d, dIdx)"
              >
                Edit
              </button>

              <button
                type="button"
                class="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer"
                :disabled="dIdx === 0"
                title="Move draft up"
                @click="moveDraftProblem(dIdx, 'up')"
              >
                <span class="material-symbols-outlined text-[16px]">arrow_upward</span>
              </button>
              <button
                type="button"
                class="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer"
                :disabled="dIdx === draftProblems.length - 1"
                title="Move draft down"
                @click="moveDraftProblem(dIdx, 'down')"
              >
                <span class="material-symbols-outlined text-[16px]">arrow_downward</span>
              </button>
              <button
                type="button"
                class="w-7 h-7 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/60 flex items-center justify-center text-red-500 cursor-pointer"
                title="Remove draft"
                @click="removeDraftProblem(dIdx)"
              >
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Footer -->
      <div class="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          class="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          @click="currentStep = 1"
        >
          <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Exam Settings</span>
        </button>

        <button
          type="button"
          class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          @click="currentStep = 3"
        >
          <span>Next: Review & Publish</span>
          <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </div>

    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <!-- STEP 3: REVIEW & PUBLISH                                                 -->
    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <div v-else-if="currentStep === 3" class="flex flex-col gap-6">
      <!-- 4 High-Level Metric KPI Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col">
          <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Questions</span>
          <span class="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{{ totalQuestionsCount }}</span>
          <span class="text-[11px] text-slate-400 mt-0.5">{{ mcqCount }} MCQs + {{ codingCount }} Coding</span>
        </div>

        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col">
          <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Marks</span>
          <span class="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">{{ totalMarks }} pts</span>
          <span class="text-[11px] text-slate-400 mt-0.5">Maximum exam score</span>
        </div>

        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col">
          <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Duration</span>
          <span class="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{{ durationMinutes }} min</span>
          <span class="text-[11px] text-slate-400 mt-0.5">{{ (durationMinutes / 60).toFixed(1) }} hours window</span>
        </div>

        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col">
          <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Student Access</span>
          <span
            class="text-xs font-bold px-3 py-1 rounded-full w-max mt-2"
            :class="isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'"
          >
            {{ isActive ? 'Active / Published' : 'Draft / Hidden' }}
          </span>
          <span class="text-[11px] text-slate-400 mt-1">{{ isActive ? 'Visible to students' : 'Hidden from students' }}</span>
        </div>
      </div>

      <!-- Section Breakdown Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col gap-3">
          <div class="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span class="material-symbols-outlined text-[20px] text-blue-600">check_circle</span>
            <h4 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Section 1: Multiple Choice Questions
            </h4>
          </div>
          <div class="grid grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div class="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800">
              <span class="text-[10px] text-slate-400 block font-semibold">Total MCQs</span>
              <span class="text-base font-extrabold text-slate-900 dark:text-white">{{ mcqCount }}</span>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800">
              <span class="text-[10px] text-slate-400 block font-semibold">Estimated Time</span>
              <span class="text-base font-extrabold text-slate-900 dark:text-white">{{ Math.round(mcqCount * 1.5) }} mins</span>
            </div>
          </div>
        </div>

        <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col gap-3">
          <div class="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span class="material-symbols-outlined text-[20px] text-emerald-600">code</span>
            <h4 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Section 2: Coding Challenges
            </h4>
          </div>
          <div class="grid grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div class="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800">
              <span class="text-[10px] text-slate-400 block font-semibold">Total Problems</span>
              <span class="text-base font-extrabold text-slate-900 dark:text-white">{{ codingCount }}</span>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800">
              <span class="text-[10px] text-slate-400 block font-semibold">Estimated Time</span>
              <span class="text-base font-extrabold text-slate-900 dark:text-white">{{ codingCount * 25 }} mins</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          class="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          @click="currentStep = 2"
        >
          <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Questions Studio</span>
        </button>

        <button
          type="button"
          class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          :disabled="saving"
          @click="save"
        >
          <span v-if="saving" class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          <span v-else class="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{{ isEdit ? 'Update & Publish Exam' : 'Save & Publish Exam' }}</span>
        </button>
      </div>
    </div>

    <!-- Modals -->
    <BulkImportModal
      v-if="showBulkImportModal"
      :start-display-order="totalQuestionsCount + 1"
      :exam-id="examId ?? undefined"
      @close="showBulkImportModal = false"
      @imported="handleBulkImported"
    />

    <LinkProblemModal
      v-if="showLinkModal"
      :exam-id="examId ?? undefined"
      :current-display-orders="existingProblems.map((p) => p.displayOrder)"
      @close="showLinkModal = false"
      @selected="onProblemSelected"
      @linked="showLinkModal = false"
    />

    <ConfirmModal
      v-if="showDeleteConfirm"
      title="Delete Exam"
      message="Are you sure you want to permanently delete this exam? All student scores and submissions will be unlinked."
      confirm-text="Delete"
      :loading="deleting"
      @confirm="onDelete"
      @cancel="showDeleteConfirm = false"
    />

    <QuickEditProblemModal
      v-if="showQuickEditModal"
      :problem-id="editingProblemId"
      :draft-problem="editingDraftProblem"
      :draft-index="editingDraftIndex"
      @close="showQuickEditModal = false"
      @saved="onQuickProblemSaved"
    />

    <ExamCandidateModal
      v-if="showCandidateModal && examId"
      :exam-id="examId"
      :exam-title="title"
      :access-type="accessType"
      @close="showCandidateModal = false"
    />
  </div>
</template>
