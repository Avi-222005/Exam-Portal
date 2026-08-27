<script setup lang="ts">
defineProps<{
  isInitialPrompt: boolean;
  violationCount: number;
}>();

const emit = defineEmits<{
  (e: 'enter-fullscreen'): void;
}>();
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 select-none animate-in fade-in duration-200"
  >
    <div
      class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8 flex flex-col items-center gap-5"
    >
      <!-- Security Icon -->
      <div
        class="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
        :class="
          isInitialPrompt
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-bounce'
        "
      >
        <span class="material-symbols-outlined text-[36px]">
          {{ isInitialPrompt ? 'lock' : 'warning' }}
        </span>
      </div>

      <!-- Heading -->
      <div class="flex flex-col gap-1.5">
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">
          {{ isInitialPrompt ? 'Secure Assessment Environment' : 'Fullscreen Mode Required' }}
        </h2>
        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm">
          {{
            isInitialPrompt
              ? 'To ensure academic integrity, this exam must be taken in Fullscreen Mode. Please click the button below to start.'
              : 'You have exited Fullscreen Mode, switched windows, or refreshed the page. The exam window is paused until you return to fullscreen.'
          }}
        </p>
      </div>

      <!-- Warning Counter Pill (if exited during test) -->
      <div
        v-if="!isInitialPrompt && violationCount > 0"
        class="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-lg text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2"
      >
        <span class="material-symbols-outlined text-[18px]">gpp_maybe</span>
        <span>
          Recorded Exits / Tab Switches: <strong>{{ violationCount }}</strong>
        </span>
      </div>

      <!-- Rules List -->
      <div
        class="w-full text-left bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 text-[11px] text-slate-600 dark:text-slate-300 flex flex-col gap-2"
      >
        <div class="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
          <span class="material-symbols-outlined text-[16px] text-blue-600">verified_user</span>
          <span>Proctoring Guidelines:</span>
        </div>
        <ul class="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
          <li>Do not press Escape or exit Fullscreen Mode.</li>
          <li>Do not switch browser tabs or open external applications.</li>
          <li>Right-click and developer tools shortcuts are disabled.</li>
        </ul>
      </div>

      <!-- Action Button -->
      <button
        type="button"
        class="w-full py-3 bg-[#2563eb] hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm rounded-xl shadow-md transition-all duration-150 cursor-pointer flex items-center justify-center gap-2"
        @click="emit('enter-fullscreen')"
      >
        <span class="material-symbols-outlined text-[20px]">fullscreen</span>
        <span>
          {{ isInitialPrompt ? 'Start Test in Fullscreen Mode' : 'Return to Fullscreen Mode' }}
        </span>
      </button>
    </div>
  </div>
</template>
