<script setup lang="ts">
import { computed } from 'vue';
import type { Problem } from '../../types';
import { useUiStore } from '../../stores/ui';

const props = defineProps<{
  problem: Problem;
  questionNumber: number;
  totalQuestions: number;
  isBookmarked: boolean;
  selectedOptionIds: string[];
}>();

const emit = defineEmits<{
  (e: 'toggle-bookmark'): void;
  (e: 'toggle-option', optionId: string): void;
  (e: 'clear-selection'): void;
  (e: 'next-question'): void;
}>();

const uiStore = useUiStore();
const marks = computed(() => props.problem.maxScore ?? 1);

function isSelected(optId: string) {
  return props.selectedOptionIds.includes(optId);
}

function formatImageSrc(data: string | null | undefined): string {
  if (!data) return '';
  if (data.startsWith('data:image/')) return data;
  return `data:image/png;base64,${data}`;
}
</script>

<template>
  <div
    class="flex flex-col md:flex-row h-full w-full select-none unselectable-area overflow-hidden"
    data-unselectable="true"
    @copy.prevent
    @cut.prevent
    @dragstart.prevent
  >
    <!-- ── Left: MCQ Question Statement ──────────────────────────── -->
    <div
      class="flex-1 flex flex-col bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 overflow-hidden select-none"
    >
      <!-- Header: Question No + Bookmark -->
      <div
        class="h-11 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 select-none"
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

      <!-- Question Body -->
      <div class="flex-1 overflow-y-auto p-6 text-xs leading-relaxed custom-scrollbar select-none">
        <h2 class="text-sm font-bold text-slate-900 dark:text-white mb-4 select-none scalable-heading">
          Multi Choice Type Question
        </h2>

        <div
          class="text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed text-sm font-normal select-none pointer-events-none scalable-text"
        >
          {{ problem.description || problem.title }}
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

      <!-- Left Bottom Bar: Marks & Negative Marks -->
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

    <!-- ── Right: MCQ Options & Answering Area ────────────────────── -->
    <div
      class="flex-1 flex flex-col bg-slate-50/40 dark:bg-[#0b1120] overflow-hidden select-none"
    >
      <!-- Answer Header -->
      <div
        class="h-11 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 bg-white dark:bg-[#0f172a] select-none"
      >
        <span class="text-xs font-bold text-slate-800 dark:text-slate-100 select-none">
          Answer here
        </span>

        <!-- Theme toggle -->
        <button
          type="button"
          class="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          :title="uiStore.theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'"
          @click="uiStore.toggleTheme"
        >
          <span class="material-symbols-outlined text-[16px] select-none">
            {{ uiStore.theme === 'dark' ? 'light_mode' : 'dark_mode' }}
          </span>
        </button>
      </div>

      <!-- Options List -->
      <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-3 custom-scrollbar select-none">
        <div
          v-for="opt in problem.mcqOptions || []"
          :key="opt.id"
          class="group relative flex items-start gap-3.5 p-4 rounded-lg border transition-all duration-150 cursor-pointer select-none"
          :class="[
            isSelected(opt.id)
              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500 shadow-xs'
              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800',
          ]"
          @click="emit('toggle-option', opt.id)"
        >
          <!-- Radio / Checkbox Indicator -->
          <div
            class="w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors select-none"
            :class="[
              isSelected(opt.id)
                ? 'border-blue-600 bg-blue-600'
                : 'border-slate-300 dark:border-slate-600 bg-transparent group-hover:border-slate-400',
            ]"
          >
            <div
              v-if="isSelected(opt.id)"
              class="w-1.5 h-1.5 rounded-full bg-white"
            />
          </div>

          <!-- Option Content (Text + Image) -->
          <div class="flex-1 flex flex-col gap-2 min-w-0 select-none">
            <span
              class="text-xs font-medium text-slate-800 dark:text-slate-200 leading-normal select-none pointer-events-none scalable-text"
            >
              {{ opt.text }}
            </span>

            <div
              v-if="opt.imageData"
              class="p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 inline-block max-w-xs select-none"
            >
              <img
                :src="formatImageSrc(opt.imageData)"
                alt="Option diagram"
                class="max-w-full max-h-40 rounded object-contain select-none pointer-events-none"
                draggable="false"
              />
            </div>
          </div>
        </div>

        <div
          v-if="!problem.mcqOptions || problem.mcqOptions.length === 0"
          class="text-center py-12 text-slate-400 text-xs select-none"
        >
          No options provided for this question.
        </div>
      </div>

      <!-- Right Bottom Action Bar: Clear & Next -->
      <div
        class="h-12 px-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 select-none"
      >
        <!-- Clear Button -->
        <button
          type="button"
          class="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer select-none"
          @click="emit('clear-selection')"
        >
          Clear
        </button>

        <!-- Next Button -->
        <button
          type="button"
          class="px-5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer select-none"
          @click="emit('next-question')"
        >
          Next
        </button>
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
