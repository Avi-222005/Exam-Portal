<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  examTitle: string;
  durationMinutes: number;
  mcqCount: number;
  mcqMarksEach: number;
  codingCount: number;
  codingMarksEach: number;
  totalQuestions: number;
  totalMarks: number;
}>();

const emit = defineEmits<{
  (e: 'understood'): void;
}>();

const hasSections = computed(() => props.mcqCount > 0 || props.codingCount > 0);
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 select-none animate-in fade-in duration-200"
  >
    <div
      class="bg-white dark:bg-[#0f141f] border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
    >
      <!-- Modal Header -->
      <div class="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/70 bg-gradient-to-r from-primary/5 via-transparent to-transparent flex items-start justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
            <span class="material-symbols-outlined text-[24px]">assignment</span>
          </div>
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-primary dark:text-primary-light">Test Structure &amp; Pattern</span>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {{ examTitle || 'Assessment Overview' }}
            </h2>
          </div>
        </div>
        <div class="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span class="material-symbols-outlined text-[15px] text-amber-500">schedule</span>
          <span>{{ durationMinutes }} Mins</span>
        </div>
      </div>

      <!-- Modal Body -->
      <div class="p-6 flex flex-col gap-5">
        <!-- Summary Stats Pills -->
        <div class="grid grid-cols-3 gap-3">
          <div class="p-3 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-xl flex flex-col items-center justify-center text-center">
            <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Total Sections</span>
            <span class="text-base font-black text-slate-800 dark:text-slate-100 font-mono mt-0.5">
              {{ (mcqCount > 0 ? 1 : 0) + (codingCount > 0 ? 1 : 0) }}
            </span>
          </div>
          <div class="p-3 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-xl flex flex-col items-center justify-center text-center">
            <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Total Questions</span>
            <span class="text-base font-black text-primary font-mono mt-0.5">
              {{ totalQuestions }}
            </span>
          </div>
          <div class="p-3 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-xl flex flex-col items-center justify-center text-center">
            <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Total Marks</span>
            <span class="text-base font-black text-emerald-500 font-mono mt-0.5">
              {{ totalMarks }}
            </span>
          </div>
        </div>

        <!-- Section Details Table / Cards -->
        <div class="flex flex-col gap-2.5">
          <span class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px] text-primary">view_list</span>
            <span>Section Breakdown</span>
          </span>

          <div class="flex flex-col gap-2">
            <!-- MCQ Section Card -->
            <div
              v-if="mcqCount > 0"
              class="p-3.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                  <span class="material-symbols-outlined text-[18px]">radio_button_checked</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-slate-900 dark:text-slate-100">Multiple Choice Questions (MCQ)</span>
                  <span class="text-[11px] text-slate-500 dark:text-slate-400">Single &amp; multi-option questions</span>
                </div>
              </div>
              <div class="flex items-center gap-2.5 text-xs font-semibold">
                <span class="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-md text-slate-700 dark:text-slate-300">
                  <strong>{{ mcqCount }}</strong> questions
                </span>
                <span class="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-md text-emerald-700 dark:text-emerald-300 font-bold">
                  {{ mcqMarksEach }} {{ mcqMarksEach === 1 ? 'Mark' : 'Marks' }} each
                </span>
              </div>
            </div>

            <!-- Coding Section Card -->
            <div
              v-if="codingCount > 0"
              class="p-3.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
                  <span class="material-symbols-outlined text-[18px]">code</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-slate-900 dark:text-slate-100">Coding Problems</span>
                  <span class="text-[11px] text-slate-500 dark:text-slate-400">Automated multi-testcase evaluation</span>
                </div>
              </div>
              <div class="flex items-center gap-2.5 text-xs font-semibold">
                <span class="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-md text-slate-700 dark:text-slate-300">
                  <strong>{{ codingCount }}</strong> questions
                </span>
                <span class="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-md text-emerald-700 dark:text-emerald-300 font-bold">
                  {{ codingMarksEach }} {{ codingMarksEach === 1 ? 'Mark' : 'Marks' }} each
                </span>
              </div>
            </div>

            <!-- Fallback if no specific section type detected -->
            <div
              v-if="!hasSections && totalQuestions > 0"
              class="p-3.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold">
                  <span class="material-symbols-outlined text-[18px]">quiz</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-slate-900 dark:text-slate-100">Assessment Questions</span>
                  <span class="text-[11px] text-slate-500 dark:text-slate-400">Standard test questions</span>
                </div>
              </div>
              <div class="flex items-center gap-2.5 text-xs font-semibold">
                <span class="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300">
                  <strong>{{ totalQuestions }}</strong> questions
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Guidelines Note -->
        <div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-300">
          <span class="material-symbols-outlined text-[18px] text-amber-500 shrink-0 mt-0.5">info</span>
          <span class="leading-relaxed text-[11px]">
            Please review the section details above. Clicking <strong>"I Understood"</strong> will proceed to fullscreen assessment mode.
          </span>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-end">
        <button
          type="button"
          class="w-full sm:w-auto px-7 py-2.5 bg-[#2563eb] hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition-all duration-150 cursor-pointer flex items-center justify-center gap-2"
          @click="emit('understood')"
        >
          <span>I Understood</span>
          <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </div>
  </div>
</template>
