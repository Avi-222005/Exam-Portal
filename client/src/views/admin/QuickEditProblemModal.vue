<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getProblem, updateProblem } from '../../services/adminApi';
import type { ProblemWithTestCases, CreateProblemPayload } from '../../types/admin';

const props = defineProps<{
  problemId?: number | null;
  draftProblem?: CreateProblemPayload | null;
  draftIndex?: number | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (
    e: 'saved',
    payload: {
      isDraft: boolean;
      problem: ProblemWithTestCases | CreateProblemPayload;
      draftIndex?: number | null;
    },
  ): void;
}>();

const router = useRouter();

// ── State ─────────────────────────────────────────────────────────────────────
const loading = ref(false);
const saving = ref(false);
const error = ref('');

const isDraft = ref(false);
const questionType = ref<'coding' | 'mcq'>('mcq');

// Common fields
const title = ref('');
const description = ref('');
const difficulty = ref<'easy' | 'medium' | 'hard'>('easy');
const maxScore = ref(1);

// MCQ fields
const isMultiSelect = ref(false);
const questionImageData = ref<string | null>(null);
const mcqOptions = ref<Array<{ text: string; imageData?: string | null; isCorrect: boolean }>>([
  { text: '', isCorrect: true },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
]);

// Coding fields
const inputFormat = ref('');
const outputFormat = ref('');
const constraints = ref('');
const timeLimitMs = ref(2000);
const memoryLimitKb = ref(256000);
const testCases = ref<Array<{ id?: number; input: string; expectedOutput: string; isVisible: boolean; displayOrder?: number }>>([
  { input: '', expectedOutput: '', isVisible: true, displayOrder: 1 },
]);

// ── Image Upload Helpers ──────────────────────────────────────────────────────
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

async function onImageUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    error.value = 'Please select a valid image file.';
    return;
  }
  questionImageData.value = await readFileAsBase64(file);
  target.value = '';
}

function removeImage() {
  questionImageData.value = null;
}

// ── MCQ Helpers ───────────────────────────────────────────────────────────────
function setCorrectOption(index: number) {
  if (!isMultiSelect.value) {
    mcqOptions.value.forEach((opt, i) => {
      opt.isCorrect = i === index;
    });
  } else {
    mcqOptions.value[index].isCorrect = !mcqOptions.value[index].isCorrect;
  }
}

function addMcqOption() {
  mcqOptions.value.push({
    text: '',
    isCorrect: false,
  });
}

function removeMcqOption(index: number) {
  if (mcqOptions.value.length <= 2) return;
  mcqOptions.value.splice(index, 1);
  if (!mcqOptions.value.some((o) => o.isCorrect) && mcqOptions.value.length > 0) {
    mcqOptions.value[0].isCorrect = true;
  }
}

// ── Coding Helpers ────────────────────────────────────────────────────────────
function addTestCase() {
  testCases.value.push({
    input: '',
    expectedOutput: '',
    isVisible: true,
    displayOrder: testCases.value.length + 1,
  });
}

function removeTestCase(index: number) {
  if (testCases.value.length <= 1) return;
  testCases.value.splice(index, 1);
}

// ── Load Problem Data ─────────────────────────────────────────────────────────
async function loadProblem() {
  error.value = '';
  if (props.problemId) {
    isDraft.value = false;
    loading.value = true;
    try {
      const p = await getProblem(props.problemId);
      title.value = p.title;
      description.value = p.description || '';
      questionType.value = p.questionType === 'mcq' ? 'mcq' : 'coding';
      difficulty.value = (p.difficulty as 'easy' | 'medium' | 'hard') || 'easy';
      maxScore.value = p.maxScore || (p.questionType === 'mcq' ? 1 : 10);
      questionImageData.value = p.questionImageData || null;

      if (p.questionType === 'mcq') {
        isMultiSelect.value = !!p.isMultiSelect;
        if (p.mcqOptions && p.mcqOptions.length > 0) {
          mcqOptions.value = p.mcqOptions.map((o) => ({
            text: o.text,
            imageData: o.imageData || null,
            isCorrect: !!o.isCorrect,
          }));
        }
      } else {
        inputFormat.value = p.inputFormat || '';
        outputFormat.value = p.outputFormat || '';
        constraints.value = p.constraints || '';
        timeLimitMs.value = p.timeLimitMs || 2000;
        memoryLimitKb.value = p.memoryLimitKb || 256000;
        if (p.testCases && p.testCases.length > 0) {
          testCases.value = p.testCases.map((tc) => ({
            id: tc.id,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isVisible: tc.isVisible,
            displayOrder: tc.displayOrder,
          }));
        }
      }
    } catch {
      error.value = 'Failed to load question details.';
    } finally {
      loading.value = false;
    }
  } else if (props.draftProblem) {
    isDraft.value = true;
    const d = props.draftProblem;
    title.value = d.title || '';
    description.value = d.description || '';
    questionType.value = d.questionType === 'mcq' ? 'mcq' : 'coding';
    difficulty.value = (d.difficulty as 'easy' | 'medium' | 'hard') || 'easy';
    maxScore.value = d.maxScore || (d.questionType === 'mcq' ? 1 : 10);
    questionImageData.value = d.questionImageData || null;

    if (d.questionType === 'mcq') {
      isMultiSelect.value = !!d.isMultiSelect;
      if (d.mcqOptions && d.mcqOptions.length > 0) {
        mcqOptions.value = d.mcqOptions.map((o) => ({
          text: o.text || '',
          imageData: o.imageData || null,
          isCorrect: !!o.isCorrect,
        }));
      }
    } else {
      inputFormat.value = d.inputFormat || '';
      outputFormat.value = d.outputFormat || '';
      constraints.value = d.constraints || '';
      timeLimitMs.value = d.timeLimitMs || 2000;
      memoryLimitKb.value = d.memoryLimitKb || 256000;
      if (d.testCases && d.testCases.length > 0) {
        testCases.value = d.testCases.map((tc) => ({
          input: tc.input || '',
          expectedOutput: tc.expectedOutput || '',
          isVisible: tc.isVisible ?? true,
          displayOrder: tc.displayOrder,
        }));
      }
    }
  }
}

onMounted(() => {
  void loadProblem();
});

watch(
  () => [props.problemId, props.draftProblem],
  () => {
    void loadProblem();
  },
);

// ── Save Handler ──────────────────────────────────────────────────────────────
async function onSave() {
  if (!title.value.trim()) {
    error.value = 'Question title / stem is required.';
    return;
  }

  if (questionType.value === 'mcq') {
    const validOpts = mcqOptions.value.filter((o) => o.text.trim().length > 0);
    if (validOpts.length < 2) {
      error.value = 'Please provide at least 2 non-empty MCQ options.';
      return;
    }
    if (!validOpts.some((o) => o.isCorrect)) {
      validOpts[0].isCorrect = true;
    }
  }

  saving.value = true;
  error.value = '';

  try {
    if (props.problemId && !isDraft.value) {
      // Update existing problem in DB
      const payload: Record<string, unknown> = {
        title: title.value.trim(),
        description: description.value.trim() || title.value.trim(),
        questionType: questionType.value,
        difficulty: difficulty.value,
        maxScore: maxScore.value || (questionType.value === 'mcq' ? 1 : 10),
      };

      if (questionType.value === 'mcq') {
        payload.isMultiSelect = isMultiSelect.value;
        payload.questionImageData = questionImageData.value ?? undefined;
        payload.mcqOptions = mcqOptions.value.map((o) => ({
          text: o.text.trim(),
          imageData: o.imageData ?? undefined,
          isCorrect: o.isCorrect,
        }));
      } else {
        payload.inputFormat = inputFormat.value.trim() || undefined;
        payload.outputFormat = outputFormat.value.trim() || undefined;
        payload.constraints = constraints.value.trim() || undefined;
        payload.timeLimitMs = timeLimitMs.value;
        payload.memoryLimitKb = memoryLimitKb.value;
        payload.testCases = testCases.value.map((tc, idx) => ({
          id: tc.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isVisible: tc.isVisible,
          displayOrder: tc.displayOrder ?? idx + 1,
        }));
      }

      const updated = await updateProblem(props.problemId, payload);
      emit('saved', {
        isDraft: false,
        problem: updated,
      });
      emit('close');
    } else {
      // Update draft problem in memory
      const draftPayload: CreateProblemPayload = {
        title: title.value.trim(),
        description: description.value.trim() || title.value.trim(),
        questionType: questionType.value,
        difficulty: difficulty.value,
        maxScore: maxScore.value || (questionType.value === 'mcq' ? 1 : 10),
      };

      if (questionType.value === 'mcq') {
        draftPayload.isMultiSelect = isMultiSelect.value;
        draftPayload.questionImageData = questionImageData.value ?? undefined;
        draftPayload.mcqOptions = mcqOptions.value.map((o) => ({
          text: o.text.trim(),
          imageData: o.imageData ?? undefined,
          isCorrect: o.isCorrect,
        }));
      } else {
        draftPayload.inputFormat = inputFormat.value.trim() || undefined;
        draftPayload.outputFormat = outputFormat.value.trim() || undefined;
        draftPayload.constraints = constraints.value.trim() || undefined;
        draftPayload.timeLimitMs = timeLimitMs.value;
        draftPayload.memoryLimitKb = memoryLimitKb.value;
        draftPayload.testCases = testCases.value.map((tc, idx) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isVisible: tc.isVisible,
          displayOrder: tc.displayOrder ?? idx + 1,
        }));
      }

      emit('saved', {
        isDraft: true,
        problem: draftPayload,
        draftIndex: props.draftIndex,
      });
      emit('close');
    }
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    error.value = msg || 'Failed to save question changes.';
  } finally {
    saving.value = false;
  }
}

function openFullEditPage() {
  if (props.problemId) {
    void router.push({ name: 'admin-all-problem-edit', params: { id: props.problemId } });
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
    <div
      class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      @click.stop
    >
      <!-- Modal Header -->
      <div class="p-5 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/60 dark:bg-slate-950/40">
        <div class="flex items-center gap-3 min-w-0">
          <span
            class="w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-bold flex-shrink-0"
            :class="
              questionType === 'mcq'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
            "
          >
            <span class="material-symbols-outlined text-[20px]">
              {{ questionType === 'mcq' ? 'check_circle' : 'code' }}
            </span>
          </span>

          <div class="min-w-0">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white truncate">
              Edit Question: {{ title || 'Question Details' }}
            </h3>
            <div class="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span
                class="px-2 py-0.2 rounded text-[10px] font-bold uppercase"
                :class="
                  questionType === 'mcq'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                "
              >
                {{ questionType === 'mcq' ? 'MCQ Question' : 'Coding Challenge' }}
              </span>
              <span v-if="problemId" class="font-mono text-[11px] text-slate-400">#{{ problemId }}</span>
              <span v-else class="text-[10px] text-blue-500 font-semibold">(Draft Question)</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <button
            v-if="problemId"
            type="button"
            class="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
            @click="openFullEditPage"
          >
            <span>Full Form</span>
            <span class="material-symbols-outlined text-[13px]">open_in_new</span>
          </button>

          <button
            type="button"
            class="w-8 h-8 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            @click="emit('close')"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="p-12 text-center text-xs text-slate-400">
        <span class="material-symbols-outlined animate-spin text-[28px] text-blue-500 block mb-2">progress_activity</span>
        Loading question details...
      </div>

      <!-- Modal Body (Scrollable Form) -->
      <div v-else class="p-6 overflow-y-auto flex flex-col gap-5 flex-1">
        <!-- Error Alert -->
        <div v-if="error" class="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600">
          {{ error }}
        </div>

        <!-- Title / Question Stem -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
            {{ questionType === 'mcq' ? 'Question Stem / Prompt' : 'Problem Title' }} <span class="text-red-500">*</span>
          </label>
          <input
            v-if="questionType === 'coding'"
            v-model="title"
            type="text"
            class="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-hidden font-semibold"
            placeholder="Problem title..."
          />
          <textarea
            v-else
            v-model="title"
            rows="3"
            class="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-hidden"
            placeholder="Enter the MCQ question stem here..."
          />
        </div>

        <!-- Image in MCQ (Optional) -->
        <div v-if="questionType === 'mcq'" class="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px] text-blue-500">image</span>
              <span>Question Photo / Diagram</span>
            </span>
            <button
              v-if="questionImageData"
              type="button"
              class="text-[11px] text-red-500 hover:underline cursor-pointer"
              @click="removeImage"
            >
              Remove Photo
            </button>
          </div>

          <div v-if="questionImageData" class="relative max-w-sm rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
            <img :src="`data:image/png;base64,${questionImageData}`" alt="Question Diagram" class="max-h-48 w-auto object-contain bg-white dark:bg-slate-900" />
          </div>

          <label v-else class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:border-blue-400 cursor-pointer w-max transition-colors">
            <span class="material-symbols-outlined text-[16px]">add_photo_alternate</span>
            <span>Attach Diagram / Photo</span>
            <input type="file" accept="image/*" class="hidden" @change="onImageUpload" />
          </label>
        </div>

        <!-- Marks & Difficulty Row -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
              Score / Marks <span class="text-red-500">*</span>
            </label>
            <input
              v-model.number="maxScore"
              type="number"
              min="1"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-hidden font-bold"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
              Difficulty <span class="text-red-500">*</span>
            </label>
            <select
              v-model="difficulty"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-hidden capitalize"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div v-if="questionType === 'mcq'" class="flex flex-col gap-1">
            <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
              Selection Mode
            </label>
            <label class="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 cursor-pointer select-none">
              <input v-model="isMultiSelect" type="checkbox" class="rounded text-blue-600" />
              <span>Multi-Select MCQ</span>
            </label>
          </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- MCQ OPTIONS EDITOR                                                  -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div v-if="questionType === 'mcq'" class="flex flex-col gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
              Answer Options (Click Letter to Mark as Correct)
            </label>
            <button
              type="button"
              class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
              @click="addMcqOption"
            >
              <span class="material-symbols-outlined text-[14px]">add</span>
              <span>Add Option</span>
            </button>
          </div>

          <div class="flex flex-col gap-2.5">
            <div
              v-for="(opt, idx) in mcqOptions"
              :key="idx"
              class="flex items-center gap-2.5 p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950/60 transition-colors"
              :class="opt.isCorrect ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 dark:border-slate-800'"
            >
              <button
                type="button"
                class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-colors flex-shrink-0"
                :class="
                  opt.isCorrect
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300'
                "
                :title="opt.isCorrect ? 'Correct Option (click to toggle)' : 'Mark as Correct Option'"
                @click="setCorrectOption(idx)"
              >
                {{ String.fromCharCode(65 + idx) }}
              </button>

              <input
                v-model="opt.text"
                type="text"
                class="flex-1 bg-transparent border-none text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden"
                :placeholder="`Option ${String.fromCharCode(65 + idx)} text...`"
              />

              <button
                v-if="mcqOptions.length > 2"
                type="button"
                class="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center transition-colors cursor-pointer"
                title="Remove Option"
                @click="removeMcqOption(idx)"
              >
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- CODING CHALLENGE EDITOR                                             -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div v-else class="flex flex-col gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
              Problem Statement / Description
            </label>
            <textarea
              v-model="description"
              rows="4"
              class="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-hidden"
              placeholder="Detailed description of the coding challenge..."
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
                Input Format
              </label>
              <textarea
                v-model="inputFormat"
                rows="2"
                class="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-hidden"
                placeholder="e.g. An integer N followed by array elements..."
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
                Output Format
              </label>
              <textarea
                v-model="outputFormat"
                rows="2"
                class="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-hidden"
                placeholder="e.g. Return the indices of the two numbers..."
              />
            </div>
          </div>

          <!-- Test Cases Editor -->
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-slate-800 dark:text-slate-200">
                Test Cases ({{ testCases.length }})
              </label>
              <button
                type="button"
                class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                @click="addTestCase"
              >
                <span class="material-symbols-outlined text-[14px]">add</span>
                <span>Add Test Case</span>
              </button>
            </div>

            <div class="flex flex-col gap-3">
              <div
                v-for="(tc, tcIdx) in testCases"
                :key="tcIdx"
                class="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2.5"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Test Case #{{ tcIdx + 1 }}
                  </span>
                  <div class="flex items-center gap-3">
                    <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input v-model="tc.isVisible" type="checkbox" class="rounded text-blue-600" />
                      <span>Visible / Sample</span>
                    </label>
                    <button
                      v-if="testCases.length > 1"
                      type="button"
                      class="text-red-500 hover:text-red-700 cursor-pointer"
                      title="Remove test case"
                      @click="removeTestCase(tcIdx)"
                    >
                      <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span class="text-[10px] text-slate-400 block mb-1">Standard Input</span>
                    <textarea
                      v-model="tc.input"
                      rows="2"
                      class="w-full p-2 font-mono text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:border-blue-500 outline-hidden"
                      placeholder="Input..."
                    />
                  </div>
                  <div>
                    <span class="text-[10px] text-slate-400 block mb-1">Expected Output</span>
                    <textarea
                      v-model="tc.expectedOutput"
                      rows="2"
                      class="w-full p-2 font-mono text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:border-blue-500 outline-hidden"
                      placeholder="Expected output..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="p-4 sm:px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-end gap-3">
        <button
          type="button"
          class="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 rounded-xl transition-colors cursor-pointer"
          @click="emit('close')"
        >
          Cancel
        </button>

        <button
          type="button"
          class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          :disabled="saving"
          @click="onSave"
        >
          <span v-if="saving" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
          <span v-else class="material-symbols-outlined text-[16px]">check</span>
          <span>Save Changes</span>
        </button>
      </div>
    </div>
  </div>
</template>
