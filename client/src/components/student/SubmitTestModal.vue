<script setup lang="ts">
defineProps<{
  totalQuestions: number;
  answeredCount: number;
  bookmarkedCount: number;
  skippedCount: number;
  notViewedCount: number;
  isSubmitting: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150"
    @click.self="emit('close')"
  >
    <div
      class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div
        class="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between"
      >
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[20px] text-blue-600 dark:text-blue-400"
            >assignment_turned_in</span
          >
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            Submit Assessment
          </h3>
        </div>

        <button
          type="button"
          class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          @click="emit('close')"
        >
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <!-- Body Summary Stats -->
      <div class="p-6 flex flex-col gap-4 text-xs">
        <p class="text-slate-600 dark:text-slate-300 font-medium">
          Are you sure you want to end your exam and submit your final answers?
          Review your progress summary below before submitting:
        </p>

        <div class="grid grid-cols-2 gap-2.5">
          <!-- Total -->
          <div
            class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col items-center"
          >
            <span class="text-slate-500 text-[11px]">Total Questions</span>
            <span class="font-bold text-base text-slate-900 dark:text-white">{{
              totalQuestions
            }}</span>
          </div>

          <!-- Answered -->
          <div
            class="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800/60 flex flex-col items-center"
          >
            <span class="text-emerald-700 dark:text-emerald-300 text-[11px]"
              >Answered</span
            >
            <span class="font-bold text-base text-emerald-700 dark:text-emerald-300">{{
              answeredCount
            }}</span>
          </div>

          <!-- Bookmarked -->
          <div
            class="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800/60 flex flex-col items-center"
          >
            <span class="text-purple-700 dark:text-purple-300 text-[11px]"
              >Bookmarked</span
            >
            <span class="font-bold text-base text-purple-700 dark:text-purple-300">{{
              bookmarkedCount
            }}</span>
          </div>

          <!-- Unanswered / Skipped -->
          <div
            class="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800/60 flex flex-col items-center"
          >
            <span class="text-amber-700 dark:text-amber-300 text-[11px]"
              >Skipped / Unanswered</span
            >
            <span class="font-bold text-base text-amber-700 dark:text-amber-300">{{
              skippedCount + notViewedCount
            }}</span>
          </div>
        </div>

        <div
          v-if="skippedCount + notViewedCount > 0"
          class="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-md text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2"
        >
          <span class="material-symbols-outlined text-[16px] text-amber-600 flex-shrink-0 mt-0.5"
            >warning</span
          >
          <span>
            You still have <strong>{{ skippedCount + notViewedCount }}</strong> unanswered question(s). You cannot modify answers after submission.
          </span>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div
        class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5 bg-slate-50 dark:bg-slate-800/40"
      >
        <button
          type="button"
          class="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          :disabled="isSubmitting"
          @click="emit('close')"
        >
          Cancel
        </button>

        <button
          type="button"
          class="px-5 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-sm transition-colors flex items-center gap-1.5"
          :disabled="isSubmitting"
          @click="emit('confirm')"
        >
          <span
            v-if="isSubmitting"
            class="material-symbols-outlined text-[16px] animate-spin"
            >progress_activity</span
          >
          <span>{{ isSubmitting ? 'Submitting...' : 'Confirm Submit' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
