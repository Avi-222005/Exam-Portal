<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Problem } from '../../types';

export interface QuestionStatus {
  isAnswered: boolean;
  isBookmarked: boolean;
  isViewed: boolean;
  isSavedInServer: boolean;
}

const props = defineProps<{
  problems: Problem[];
  currentIndex: number;
  statuses: Record<number, QuestionStatus>;
}>();

const emit = defineEmits<{
  (e: 'select-question', index: number): void;
}>();

const showViewMoreModal = ref(false);

const stats = computed(() => {
  let answered = 0;
  let bookmarked = 0;
  let skipped = 0;
  let notViewed = 0;
  let savedInServer = 0;

  props.problems.forEach((p, idx) => {
    const s = props.statuses[p.id] || {
      isAnswered: false,
      isBookmarked: false,
      isViewed: idx === 0,
      isSavedInServer: false,
    };

    if (s.isAnswered) answered++;
    if (s.isBookmarked) bookmarked++;
    if (s.isSavedInServer) savedInServer++;

    if (!s.isViewed) {
      notViewed++;
    } else if (!s.isAnswered) {
      skipped++;
    }
  });

  return {
    total: props.problems.length,
    answered,
    bookmarked,
    skipped,
    notViewed,
    savedInServer,
  };
});

function getButtonClass(idx: number, problem: Problem) {
  const isCurrent = props.currentIndex === idx;
  const s = props.statuses[problem.id];

  if (isCurrent) {
    return 'bg-[#2563eb] text-white border-[#2563eb] font-bold shadow-xs';
  }

  if (s?.isAnswered) {
    return 'bg-[#22c55e] text-white border-[#22c55e] font-semibold';
  }

  if (s?.isBookmarked) {
    return 'bg-[#a855f7] text-white border-[#a855f7] font-semibold';
  }

  if (s?.isViewed && !s.isAnswered) {
    return 'bg-[#f97316] text-white border-[#ea580c] font-semibold shadow-2xs';
  }

  return 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300';
}
</script>

<template>
  <aside
    class="w-28 flex-shrink-0 bg-slate-50/70 dark:bg-[#0b1120] border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between h-full select-none overflow-hidden"
  >
    <!-- ── 2-Column Numbered Grid ─────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto p-2 custom-scrollbar">
      <div class="grid grid-cols-2 gap-1.5">
        <button
          v-for="(problem, idx) in problems"
          :key="problem.id"
          type="button"
          class="aspect-square w-full rounded-md border text-xs flex items-center justify-center transition-all duration-150 cursor-pointer relative font-medium"
          :class="getButtonClass(idx, problem)"
          @click="emit('select-question', idx)"
        >
          <span>{{ idx + 1 }}</span>
          <!-- Little bookmark indicator badge if bookmarked -->
          <span
            v-if="statuses[problem.id]?.isBookmarked"
            class="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 border-2 border-white dark:border-slate-900 rounded-full"
          />
        </button>
      </div>
    </div>

    <!-- ── Bottom Summary Statistics ──────────────────────────────── -->
    <div
      class="p-2 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 flex flex-col gap-1.5 text-[11px]"
    >
      <!-- Answered -->
      <div
        class="flex flex-col items-center justify-center py-1 bg-slate-50 dark:bg-slate-800/60 border-t-2 border-[#22c55e] rounded-xs shadow-2xs"
      >
        <span class="text-[10px] text-slate-500 font-medium leading-tight"
          >Answered</span
        >
        <span class="font-bold text-[#16a34a] dark:text-[#22c55e]"
          >{{ stats.answered }}/{{ stats.total }}</span
        >
      </div>

      <!-- Bookmarked -->
      <div
        class="flex flex-col items-center justify-center py-1 bg-slate-50 dark:bg-slate-800/60 border-t-2 border-[#a855f7] rounded-xs shadow-2xs"
      >
        <span class="text-[10px] text-slate-500 font-medium leading-tight"
          >Bookmarked</span
        >
        <span class="font-bold text-[#9333ea] dark:text-[#c084fc]"
          >{{ stats.bookmarked }}/{{ stats.total }}</span
        >
      </div>

      <!-- Skipped -->
      <div
        class="flex flex-col items-center justify-center py-1 bg-slate-50 dark:bg-slate-800/60 border-t-2 border-[#f97316] rounded-xs shadow-2xs"
      >
        <span class="text-[10px] text-slate-500 font-medium leading-tight"
          >Skipped</span
        >
        <span class="font-bold text-[#ea580c] dark:text-[#fb923c]"
          >{{ stats.skipped }}/{{ stats.total }}</span
        >
      </div>

      <!-- Not Viewed -->
      <div
        class="flex flex-col items-center justify-center py-1 bg-slate-50 dark:bg-slate-800/60 border-t-2 border-[#ef4444] rounded-xs shadow-2xs"
      >
        <span class="text-[10px] text-slate-500 font-medium leading-tight"
          >Not Viewed</span
        >
        <span class="font-bold text-[#dc2626] dark:text-[#f87171]"
          >{{ stats.notViewed }}/{{ stats.total }}</span
        >
      </div>

      <!-- Saved In Server -->
      <div
        class="flex flex-col items-center justify-center py-1 bg-slate-50 dark:bg-slate-800/60 border-t-2 border-[#64748b] rounded-xs shadow-2xs"
      >
        <span class="text-[10px] text-slate-500 font-medium leading-tight"
          >Saved In Server</span
        >
        <span class="font-bold text-slate-600 dark:text-slate-300"
          >{{ stats.savedInServer }}/{{ stats.total }}</span
        >
      </div>

      <!-- View More Link -->
      <button
        type="button"
        class="text-center text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium pt-1 pb-0.5 cursor-pointer"
        @click="showViewMoreModal = true"
      >
        View More
      </button>
    </div>

    <!-- ── View More Modal ────────────────────────────────────────── -->
    <div
      v-if="showViewMoreModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      @click.self="showViewMoreModal = false"
    >
      <div
        class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div
          class="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between"
        >
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            Question Palette Status Overview
          </h3>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            @click="showViewMoreModal = false"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="p-5 flex flex-col gap-3 text-xs">
          <div
            class="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800/50"
          >
            <div class="flex items-center gap-2">
              <span class="w-3.5 h-3.5 rounded-sm bg-[#22c55e]" />
              <span class="font-medium text-emerald-900 dark:text-emerald-200"
                >Answered Questions</span
              >
            </div>
            <span class="font-bold text-emerald-700 dark:text-emerald-300"
              >{{ stats.answered }} / {{ stats.total }}</span
            >
          </div>

          <div
            class="flex items-center justify-between p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800/50"
          >
            <div class="flex items-center gap-2">
              <span class="w-3.5 h-3.5 rounded-sm bg-[#a855f7]" />
              <span class="font-medium text-purple-900 dark:text-purple-200"
                >Bookmarked for Review</span
              >
            </div>
            <span class="font-bold text-purple-700 dark:text-purple-300"
              >{{ stats.bookmarked }} / {{ stats.total }}</span
            >
          </div>

          <div
            class="flex items-center justify-between p-2.5 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800/50"
          >
            <div class="flex items-center gap-2">
              <span class="w-3.5 h-3.5 rounded-sm bg-[#f97316]" />
              <span class="font-medium text-orange-900 dark:text-orange-200"
                >Viewed & Skipped</span
              >
            </div>
            <span class="font-bold text-orange-700 dark:text-orange-300"
              >{{ stats.skipped }} / {{ stats.total }}</span
            >
          </div>

          <div
            class="flex items-center justify-between p-2.5 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800/50"
          >
            <div class="flex items-center gap-2">
              <span class="w-3.5 h-3.5 rounded-sm bg-[#ef4444]" />
              <span class="font-medium text-rose-900 dark:text-rose-200"
                >Not Viewed Yet</span
              >
            </div>
            <span class="font-bold text-rose-700 dark:text-rose-300"
              >{{ stats.notViewed }} / {{ stats.total }}</span
            >
          </div>

          <div
            class="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <div class="flex items-center gap-2">
              <span class="w-3.5 h-3.5 rounded-sm bg-[#64748b]" />
              <span class="font-medium text-slate-700 dark:text-slate-200"
                >Saved in Server</span
              >
            </div>
            <span class="font-bold text-slate-800 dark:text-slate-100"
              >{{ stats.savedInServer }} / {{ stats.total }}</span
            >
          </div>
        </div>

        <div
          class="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-800/30"
        >
          <button
            type="button"
            class="px-4 py-1.5 bg-[#2563eb] text-white rounded-md text-xs font-semibold hover:bg-blue-700"
            @click="showViewMoreModal = false"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.4);
  border-radius: 4px;
}
</style>
