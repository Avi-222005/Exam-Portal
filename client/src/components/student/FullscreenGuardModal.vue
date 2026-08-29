<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  isInitialPrompt: boolean;
  violationCount: number;
  violationReason?:
    | 'fullscreen_exit'
    | 'blur_focus_lost'
    | 'side_panel_detected'
    | 'tab_switched'
    | null;
}>();

const emit = defineEmits<{
  (e: 'enter-fullscreen'): void;
}>();

const titleText = computed(() => {
  if (props.isInitialPrompt) return 'Secure Assessment Environment';
  if (props.violationReason === 'side_panel_detected')
    return 'Side Panel / Split Screen Detected';
  if (props.violationReason === 'blur_focus_lost')
    return 'Window Focus Lost / Floating Window Detected';
  if (props.violationReason === 'tab_switched')
    return 'Browser Tab Switch Detected';
  return 'Fullscreen Mode Required';
});

const descriptionText = computed(() => {
  if (props.isInitialPrompt) {
    return 'To ensure exam integrity, this assessment must be taken in uninterrupted Fullscreen Mode. Click the button below to start.';
  }
  if (props.violationReason === 'side_panel_detected') {
    return 'A browser side panel (such as AI sidebar / Gemini / Copilot) or split-screen window was detected. Please close all side panels, dismiss floating overlays, and return to Fullscreen Mode.';
  }
  if (props.violationReason === 'blur_focus_lost') {
    return 'You clicked outside the test window or interacted with a floating application / external tool. The exam is paused until you refocus.';
  }
  if (props.violationReason === 'tab_switched') {
    return 'You navigated away from the exam tab. Tab switches are strictly prohibited and recorded in your proctor log.';
  }
  return 'You have exited Fullscreen Mode. The exam window is paused until you return to fullscreen.';
});
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 select-none animate-in fade-in duration-200"
  >
    <div
      class="bg-white dark:bg-[#0f141f] border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8 flex flex-col items-center gap-5"
    >
      <!-- Security Icon -->
      <div
        class="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
        :class="
          isInitialPrompt
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-pulse'
        "
      >
        <span class="material-symbols-outlined text-[36px]">
          {{ isInitialPrompt ? 'lock' : 'gpp_maybe' }}
        </span>
      </div>

      <!-- Heading -->
      <div class="flex flex-col gap-1.5">
        <h2 class="text-xl font-bold text-slate-900 dark:text-white leading-tight">
          {{ titleText }}
        </h2>
        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-md">
          {{ descriptionText }}
        </p>
      </div>

      <!-- Warning Counter Pill (if exited during test) -->
      <div
        v-if="!isInitialPrompt && violationCount > 0"
        class="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 shadow-xs"
      >
        <span class="material-symbols-outlined text-[18px]">warning</span>
        <span>
          Recorded Violations / Focus Losses: <strong>{{ violationCount }}</strong>
        </span>
      </div>

      <!-- Rules List -->
      <div
        class="w-full text-left bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-[11px] text-slate-600 dark:text-slate-300 flex flex-col gap-2"
      >
        <div class="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
          <span class="material-symbols-outlined text-[16px] text-primary">verified_user</span>
          <span>Proctoring Security Rules:</span>
        </div>
        <ul class="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
          <li>Close all browser sidebars (Gemini, Copilot, extensions) and floating overlays.</li>
          <li>Do not press Escape or click into outside apps / windows.</li>
          <li>Clipboard pasting from external sources and right-clicking are blocked.</li>
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
          {{ isInitialPrompt ? 'Start Test in Fullscreen Mode' : 'Refocus & Return to Fullscreen' }}
        </span>
      </button>
    </div>
  </div>
</template>
