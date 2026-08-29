<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useEditorStore } from '../../stores/editor';
import { useExamStore } from '../../stores/exam';
import { useRunSubmitStore } from '../../stores/runSubmit';
import { useUiStore } from '../../stores/ui';
import { useToastStore } from '../../stores/toast';
import { useMonaco } from '../../composables/useMonaco';
import type { Problem } from '../../types';

const props = defineProps<{
  problem: Problem;
}>();

const emit = defineEmits<{
  (e: 'next-question'): void;
}>();

const editorStore = useEditorStore();
const examStore = useExamStore();
const runSubmit = useRunSubmitStore();
const uiStore = useUiStore();
const toastStore = useToastStore();
const containerRef = ref<HTMLElement | null>(null);

// Monaco Editor setup
const monacoLang = computed(() => editorStore.language.monacoLang);
const code = computed({
  get: () => editorStore.code,
  set: (val: string) => {
    editorStore.code = val;
  },
});

const { editor } = useMonaco(containerRef, monacoLang, code);

// Re-layout editor on resize
watch(
  () => uiStore.editorExpanded,
  () => requestAnimationFrame(() => editor.value?.layout()),
);

// Available languages for this exam
const availableLanguages = computed(() => {
  const langs = editorStore.languages;
  const allowed = examStore.activeExam?.allowedLanguages as
    | (number | string)[]
    | undefined;
  if (!allowed || allowed.length === 0) return langs;
  return langs.filter((l) =>
    allowed.some((a) =>
      typeof a === 'number'
        ? a === l.id
        : String(a).toLowerCase() === l.name.toLowerCase(),
    ),
  );
});

function onLanguageChange(e: Event) {
  const id = parseInt((e.target as HTMLSelectElement).value, 10);
  const lang = editorStore.languages.find((l) => l.id === id);
  if (lang) editorStore.setLanguage(lang);
}

// Custom Input toggle
const showCustomInput = ref(false);
const customInputText = ref('');

// Test Execution
async function handleCompileAndRun() {
  if (runSubmit.running || runSubmit.submitting) return;
  if (runSubmit.alreadySolved && !showCustomInput.value) {
    toastStore.add(
      'info',
      'Final code submission has been done and no more submissions will be taken.',
    );
    return;
  }
  const customStdin = showCustomInput.value ? customInputText.value : undefined;
  await runSubmit.run(customStdin);
}

async function handleSubmitCode() {
  if (runSubmit.running || runSubmit.submitting) return;
  if (runSubmit.alreadySolved) {
    toastStore.add(
      'info',
      'Final code submission has been done and no more submissions will be taken.',
    );
    return;
  }
  await runSubmit.submit();
}

const showResetModal = ref(false);

function handleClear() {
  showResetModal.value = true;
}

function confirmResetCode() {
  editorStore.resetCode();
  showResetModal.value = false;
}

// Stats & test case results
const hasResults = computed(() => {
  return (
    runSubmit.runResult !== null ||
    runSubmit.submission !== null
  );
});

const passedSampleCount = computed(() => {
  if (runSubmit.runResult) {
    return runSubmit.runResult.results.filter((r) => r.passed).length;
  }
  if (runSubmit.submission) {
    return runSubmit.submission.passedTests;
  }
  return 0;
});

const totalSampleCount = computed(() => {
  if (runSubmit.runResult) {
    return runSubmit.runResult.results.length;
  }
  if (runSubmit.submission) {
    return runSubmit.submission.totalTests;
  }
  return 0;
});

const compilerMessage = computed(() => {
  if (runSubmit.runResult?.results?.[0]?.compileOutput) {
    return runSubmit.runResult.results[0].compileOutput;
  }
  if (runSubmit.runResult?.results?.[0]?.stderr) {
    return runSubmit.runResult.results[0].stderr;
  }
  if (runSubmit.submission?.results?.[0]?.compileOutput) {
    return runSubmit.submission.results[0].compileOutput;
  }
  if (runSubmit.submission?.results?.[0]?.stderr) {
    return runSubmit.submission.results[0].stderr;
  }
  return null;
});

const testcaseResults = computed(() => {
  if (runSubmit.runResult?.results) {
    return runSubmit.runResult.results;
  }
  if (runSubmit.submission?.results) {
    return runSubmit.submission.results;
  }
  return [];
});
</script>

<template>
  <div class="flex flex-col h-full bg-[#1e1e1e] select-text overflow-hidden">
    <!-- ── Editor Header Bar ──────────────────────────────────────── -->
    <div
      class="h-11 px-4 bg-slate-100 dark:bg-[#18181b] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 text-xs"
    >
      <span class="font-bold text-slate-800 dark:text-slate-200">
        Fill your code here
      </span>

      <!-- Right controls: Language + Theme + Fullscreen -->
      <div class="flex items-center gap-2">
        <!-- Language selector -->
        <div class="relative">
          <select
            :value="editorStore.language.id"
            class="px-2.5 py-1 bg-white dark:bg-[#27272a] border border-slate-300 dark:border-slate-700 rounded text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 focus:outline-hidden cursor-pointer"
            @change="onLanguageChange"
          >
            <option
              v-for="l in availableLanguages"
              :key="l.id"
              :value="l.id"
            >
              {{ l.name }}
            </option>
          </select>
        </div>

        <!-- Theme toggle -->
        <button
          type="button"
          class="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          :title="uiStore.theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'"
          @click="uiStore.toggleTheme"
        >
          <span class="material-symbols-outlined text-[16px]">
            {{ uiStore.theme === 'dark' ? 'light_mode' : 'dark_mode' }}
          </span>
        </button>

        <!-- Fullscreen expand -->
        <button
          type="button"
          class="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          :title="uiStore.editorExpanded ? 'Collapse Editor' : 'Expand Editor'"
          @click="uiStore.toggleEditorExpanded"
        >
          <span class="material-symbols-outlined text-[16px]">
            {{ uiStore.editorExpanded ? 'fullscreen_exit' : 'fullscreen' }}
          </span>
        </button>
      </div>
    </div>

    <!-- ── Main Editor & Results Container ────────────────────────── -->
    <div class="flex-1 flex flex-col min-h-0 overflow-y-auto bg-white dark:bg-[#090d16] custom-scrollbar">
      <!-- Monaco Editor -->
      <div
        ref="containerRef"
        class="w-full flex-shrink-0"
        :style="{ minHeight: hasResults ? '320px' : '440px', height: hasResults ? '360px' : '100%' }"
      />

      <!-- Custom Input Section -->
      <div class="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex-shrink-0">
        <label class="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            v-model="showCustomInput"
            type="checkbox"
            class="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
          />
          <span>Provide Custom Input</span>
        </label>

        <!-- Custom Input Textarea -->
        <div v-if="showCustomInput" class="mt-2.5">
          <textarea
            v-model="customInputText"
            rows="3"
            placeholder="Enter custom stdin input here..."
            class="w-full p-2.5 text-xs font-mono bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
          />
        </div>
      </div>

      <!-- Test Results Panel (Screenshot 4) -->
      <div
        v-if="hasResults || runSubmit.running || runSubmit.submitting || runSubmit.alreadySolved"
        class="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090d16] flex flex-col gap-4 text-xs"
      >
        <!-- Already solved / Final code submission banner -->
        <div
          v-if="runSubmit.alreadySolved"
          class="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-md text-emerald-800 dark:text-emerald-300 font-medium"
        >
          <span class="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">task_alt</span>
          <span>Final code submission has been done and no more submissions will be taken.</span>
        </div>

        <!-- Running Loader -->
        <div
          v-if="runSubmit.running || runSubmit.submitting"
          class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-md text-blue-700 dark:text-blue-300"
        >
          <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          <span class="font-medium">
            {{ runSubmit.submitting ? 'Judging solution against all test cases...' : 'Compiling and executing code...' }}
          </span>
        </div>

        <template v-else>
          <!-- Result Summary Pill -->
          <div>
            <h4 class="font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              Result
            </h4>
            <div
              class="inline-block px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              {{ passedSampleCount }}/{{ totalSampleCount }} Sample testcase passed
            </div>
          </div>

          <!-- Compiler Message (if any error/warning/output) -->
          <div v-if="compilerMessage">
            <h4 class="font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              Compiler Message
            </h4>
            <pre
              class="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[11px] font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-all max-h-40 overflow-y-auto"
              >{{ compilerMessage }}</pre
            >
          </div>

          <!-- Sample Testcases list -->
          <div v-if="testcaseResults.length > 0">
            <h4 class="font-bold text-slate-800 dark:text-slate-200 mb-2">
              Sample Testcase
            </h4>

            <div class="flex flex-col gap-3">
              <div
                v-for="(tr, idx) in testcaseResults"
                :key="idx"
                class="bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex flex-col gap-2"
              >
                <!-- Title: Testcase N - Passed / Failed -->
                <div class="flex items-center justify-between">
                  <span class="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    Testcase {{ idx + 1 }} -
                    <span :class="tr.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                      {{ tr.passed ? 'Passed' : 'Failed' }}
                    </span>
                  </span>
                </div>

                <!-- Columns for Expected Output vs Output -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                  <!-- Expected Output -->
                  <div>
                    <span class="font-bold text-slate-700 dark:text-slate-300 text-[11px] block mb-1">
                      Expected Output
                    </span>
                    <pre
                      class="p-2 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-700 rounded text-[11px] font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap"
                      >{{ tr.expectedOutput || '(sample output)' }}</pre
                    >
                  </div>

                  <!-- Actual Output -->
                  <div>
                    <span class="font-bold text-slate-700 dark:text-slate-300 text-[11px] block mb-1">
                      Output
                    </span>
                    <pre
                      class="p-2 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-700 rounded text-[11px] font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap"
                      >{{ tr.stdout || tr.stderr || '(no output)' }}</pre
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- ── Bottom Action Bar ──────────────────────────────────────── -->
    <div
      class="h-12 px-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0"
    >
      <!-- Left: Clear button -->
      <button
        type="button"
        class="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        @click="handleClear"
      >
        Clear
      </button>

      <!-- Right: Compile & Run + Submit Code + Next -->
      <div class="flex items-center gap-2.5">
        <!-- Compile & Run -->
        <button
          type="button"
          class="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          :disabled="runSubmit.running || runSubmit.submitting"
          @click="handleCompileAndRun"
        >
          Compile &amp; Run
        </button>

        <!-- Submit Code -->
        <button
          type="button"
          class="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          :disabled="runSubmit.running || runSubmit.submitting"
          @click="handleSubmitCode"
        >
          Submit Code
        </button>

        <!-- Next -->
        <button
          type="button"
          class="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          @click="emit('next-question')"
        >
          Next
        </button>
      </div>
    </div>

    <!-- ── Reset Code In-App Confirmation Modal ────────────────────── -->
    <div
      v-if="showResetModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150"
      @click.self="showResetModal = false"
    >
      <div
        class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[20px] text-amber-500">restart_alt</span>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Reset Code</h3>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            @click="showResetModal = false"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="p-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Are you sure you want to reset your editor to the original starter code template? Any changes you made will be lost.
        </div>

        <div class="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/40">
          <button
            type="button"
            class="px-3.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            @click="showResetModal = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md shadow-xs cursor-pointer"
            @click="confirmResetCode"
          >
            Reset Code
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.4);
  border-radius: 4px;
}
</style>
