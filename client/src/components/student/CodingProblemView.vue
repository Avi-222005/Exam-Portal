<script setup lang="ts">
import { computed } from 'vue';
import type { Problem } from '../../types';
import ObfuscatedText from './ObfuscatedText.vue';

const props = defineProps<{
  problem: Problem;
  questionNumber: number;
  totalQuestions: number;
  isBookmarked: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-bookmark'): void;
}>();

const marks = computed(() => props.problem.maxScore ?? 10);

const sampleCases = computed(() => {
  const list: Array<{ input: string; output: string }> = [];

  // 1. From problem.testCases (visible test cases)
  if (props.problem.testCases && Array.isArray(props.problem.testCases)) {
    for (const tc of props.problem.testCases) {
      if (tc.isVisible !== false && (tc.input || tc.expectedOutput)) {
        list.push({
          input: tc.input || '',
          output: tc.expectedOutput || '',
        });
      }
    }
  }

  // 2. If no test cases but problem.sampleInput / problem.sampleOutput exists
  if (list.length === 0 && (props.problem.sampleInput || props.problem.sampleOutput)) {
    list.push({
      input: props.problem.sampleInput || '',
      output: props.problem.sampleOutput || '',
    });
  }

  return list;
});

function formatImageSrc(data: string | null | undefined): string {
  if (!data) return '';
  if (data.startsWith('data:image/')) return data;
  return `data:image/png;base64,${data}`;
}
</script>

<template>
  <div
    class="flex flex-col h-full bg-white dark:bg-[#0f172a] select-none unselectable-area overflow-hidden"
    data-unselectable="true"
    @copy.prevent
    @cut.prevent
    @dragstart.prevent
  >
    <!-- ── Header: Question No & Bookmark ────────────────────────── -->
    <div
      class="h-11 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 bg-white dark:bg-[#0f172a] select-none"
    >
      <span class="text-xs font-bold text-slate-800 dark:text-slate-100 select-none">
        Question No : {{ questionNumber }} / {{ totalQuestions }}
      </span>

      <button
        type="button"
        class="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        :title="isBookmarked ? 'Remove Bookmark' : 'Bookmark for Review'"
        @click="emit('toggle-bookmark')"
      >
        <span
          class="material-symbols-outlined text-[20px] transition-colors select-none"
          :class="
            isBookmarked
              ? 'text-amber-500 dark:text-amber-400'
              : 'text-slate-400 dark:text-slate-500 hover:text-amber-500'
          "
          :style="isBookmarked ? 'font-variation-settings: \'FILL\' 1;' : ''"
        >
          bookmark
        </span>
      </button>
    </div>

    <!-- ── Problem Statement Scrollable Content ───────────────────── -->
    <div class="flex-1 overflow-y-auto p-5 text-xs leading-relaxed custom-scrollbar select-none">
      <!-- Title -->
      <h2 class="text-sm font-bold text-slate-900 dark:text-white mb-4 select-none scalable-heading">
        Single File Programming Question
      </h2>

      <!-- Problem Statement Section -->
      <div class="mb-5 select-none">
        <h3 class="font-bold text-slate-800 dark:text-slate-200 underline mb-2 select-none scalable-heading">
          Problem Statement
        </h3>
        <div class="text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed select-none pointer-events-none scalable-text">
          <ObfuscatedText :text="problem.description || problem.title" />
        </div>

        <!-- Question Image Diagram -->
        <div
          v-if="problem.questionImageData"
          class="mt-4 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/80 inline-block max-w-full select-none"
        >
          <img
            :src="formatImageSrc(problem.questionImageData)"
            alt="Question diagram"
            class="max-w-full max-h-80 rounded object-contain bg-white dark:bg-slate-900 select-none pointer-events-none"
            draggable="false"
          />
        </div>
      </div>

      <!-- Input Format -->
      <div v-if="problem.inputFormat" class="mb-4 select-none">
        <h4 class="font-bold text-slate-800 dark:text-slate-200 mb-1 select-none scalable-heading">
          Input format :
        </h4>
        <div class="text-slate-700 dark:text-slate-300 whitespace-pre-line select-none pointer-events-none scalable-text">
          {{ problem.inputFormat }}
        </div>
      </div>

      <!-- Output Format -->
      <div v-if="problem.outputFormat" class="mb-4 select-none">
        <h4 class="font-bold text-slate-800 dark:text-slate-200 mb-1 select-none scalable-heading">
          Output format :
        </h4>
        <div class="text-slate-700 dark:text-slate-300 whitespace-pre-line select-none pointer-events-none scalable-text">
          {{ problem.outputFormat }}
        </div>
        <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium italic select-none pointer-events-none scalable-text">
          Refer to the sample output for formatting specifications.
        </p>
      </div>

      <!-- Code Constraints -->
      <div v-if="problem.constraints" class="mb-5 select-none">
        <h4 class="font-bold text-slate-800 dark:text-slate-200 mb-1 select-none scalable-heading">
          Code constraints :
        </h4>
        <div
          class="text-slate-700 dark:text-slate-300 font-mono text-[11px] bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded border border-slate-200 dark:border-slate-700/80 whitespace-pre-line select-none pointer-events-none scalable-code"
        >
          {{ problem.constraints }}
        </div>
      </div>

      <!-- Sample Test Cases -->
      <div
        v-if="sampleCases.length > 0"
        class="mb-4 select-none"
      >
        <h4 class="font-bold text-slate-800 dark:text-slate-200 mb-2 select-none scalable-heading">
          Sample test cases :
        </h4>

        <div class="flex flex-col gap-3 select-none">
          <div
            v-for="(sc, idx) in sampleCases"
            :key="idx"
            class="grid grid-cols-1 md:grid-cols-2 gap-3 select-none"
          >
            <!-- Sample Input Card -->
            <div
              class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md p-3 select-none"
            >
              <div class="font-bold text-slate-800 dark:text-slate-200 mb-1.5 text-[11px] select-none scalable-heading">
                Input {{ idx + 1 }} :
              </div>
              <pre
                class="font-mono text-slate-700 dark:text-slate-300 text-[11px] whitespace-pre-wrap break-all select-none pointer-events-none scalable-code"
                >{{ sc.input.trim() || '(empty)' }}</pre
              >
            </div>

            <!-- Sample Output Card -->
            <div
              class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md p-3 select-none"
            >
              <div class="font-bold text-slate-800 dark:text-slate-200 mb-1.5 text-[11px] select-none scalable-heading">
                Output {{ idx + 1 }} :
              </div>
              <pre
                class="font-mono text-slate-700 dark:text-slate-300 text-[11px] whitespace-pre-wrap break-all select-none pointer-events-none scalable-code"
                >{{ sc.output.trim() || '(empty)' }}</pre
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Bottom Bar: Marks & Negative Marks ─────────────────────── -->
    <div
      class="h-10 px-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-6 text-xs text-slate-600 dark:text-slate-400 flex-shrink-0 select-none"
    >
      <div>
        <span>Marks : </span>
        <span class="font-semibold text-slate-900 dark:text-white">{{ marks }}</span>
      </div>
      <div>
        <span>Negative Marks : </span>
        <span class="font-semibold text-slate-900 dark:text-white">0</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.unselectable-area,
.unselectable-area * {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  -webkit-touch-callout: none !important;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.4);
  border-radius: 4px;
}
</style>
