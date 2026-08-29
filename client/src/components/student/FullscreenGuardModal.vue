<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';

const props = defineProps<{
  isInitialPrompt: boolean;
  violationCount: number;
  violationReason?:
    | 'fullscreen_exit'
    | 'blur_focus_lost'
    | 'side_panel_detected'
    | 'tab_switched'
    | null;
  isSidePanelOpen?: boolean;
  isLockedOut?: boolean;
  maxViolations?: number;
  isSubmittingLockout?: boolean;
}>();

const emit = defineEmits<{
  (e: 'enter-fullscreen'): void;
  (e: 'submit-lockout'): void;
}>();

const lockoutCountdown = ref(10);
let lockoutTimer: number | null = null;

function startLockoutTimer() {
  stopLockoutTimer();
  lockoutCountdown.value = 10;
  lockoutTimer = window.setInterval(() => {
    if (lockoutCountdown.value > 1) {
      lockoutCountdown.value -= 1;
    } else {
      lockoutCountdown.value = 0;
      stopLockoutTimer();
      emit('submit-lockout');
    }
  }, 1000);
}

function stopLockoutTimer() {
  if (lockoutTimer !== null) {
    clearInterval(lockoutTimer);
    lockoutTimer = null;
  }
}

function handleOkClick() {
  stopLockoutTimer();
  emit('submit-lockout');
}

watch(
  () => props.isLockedOut,
  (locked) => {
    if (locked) {
      startLockoutTimer();
    } else {
      stopLockoutTimer();
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  stopLockoutTimer();
});

const titleText = computed(() => {
  if (props.isLockedOut) return 'Violation Limit Exceeded';
  if (props.isInitialPrompt) return 'Secure Assessment Environment';
  if (props.isSidePanelOpen || props.violationReason === 'side_panel_detected')
    return 'Side Panel Detected - Close to Continue';
  if (props.violationReason === 'blur_focus_lost')
    return 'Window Focus Lost / External Interaction';
  if (props.violationReason === 'tab_switched')
    return 'Browser Tab Switch Detected';
  return 'Fullscreen Mode Required';
});

const descriptionText = computed(() => {
  if (props.isLockedOut) {
    return `You have crossed your maximum allowed proctoring violations (${props.maxViolations || 5}). Your test is now locked and will be automatically submitted.`;
  }
  if (props.isInitialPrompt) {
    return 'To ensure exam integrity, this assessment must be taken in uninterrupted Fullscreen Mode with all browser sidebars closed. Click the button below to start.';
  }
  if (props.isSidePanelOpen || props.violationReason === 'side_panel_detected') {
    return 'A browser AI side panel (Gemini / Copilot / Edge Sidebar) or split window is open. Please click the [X] button at the top-right of the sidebar to close it. The assessment will unlock once closed.';
  }
  if (props.violationReason === 'blur_focus_lost') {
    return 'You clicked outside the test window or interacted with an external app / floating window. Assessment content is hidden until you refocus.';
  }
  if (props.violationReason === 'tab_switched') {
    return 'You navigated away from the exam tab. Tab switching is strictly prohibited and recorded in your proctoring audit log.';
  }
  return 'You have exited Fullscreen Mode. Assessment content is paused and hidden until you return to fullscreen.';
});
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-4 select-none animate-in fade-in duration-200"
  >
    <div
      class="bg-white dark:bg-[#0f141f] border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8 flex flex-col items-center gap-5"
    >
      <!-- Security Icon -->
      <div
        class="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
        :class="
          isLockedOut
            ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-700'
            : isInitialPrompt
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-pulse'
        "
      >
        <span class="material-symbols-outlined text-[36px]">
          {{ isLockedOut ? 'lock_clock' : isInitialPrompt ? 'lock' : 'gpp_maybe' }}
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

      <!-- Lockout 10-Second Countdown Banner -->
      <div
        v-if="isLockedOut"
        class="w-full flex flex-col items-center gap-2 py-3.5 px-6 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-2xl"
      >
        <div class="flex items-center justify-between w-full text-xs font-semibold text-rose-700 dark:text-rose-300">
          <span>Auto-submitting test in:</span>
          <span class="font-mono text-base font-extrabold text-rose-600 dark:text-rose-400">
            {{ lockoutCountdown }}s
          </span>
        </div>
        <div class="w-full bg-rose-200/80 dark:bg-rose-900/60 rounded-full h-2 overflow-hidden">
          <div
            class="bg-rose-600 dark:bg-rose-500 h-full transition-all duration-1000 ease-linear rounded-full"
            :style="{ width: `${(lockoutCountdown / 10) * 100}%` }"
          ></div>
        </div>
      </div>

      <!-- Action Required: Side Panel Close Callout -->
      <div
        v-if="!isInitialPrompt && !isLockedOut && isSidePanelOpen"
        class="w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded-xl p-3.5 text-left flex items-start gap-3 shadow-xs animate-bounce duration-1000"
      >
        <span class="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px] flex-shrink-0 mt-0.5">
          close_fullscreen
        </span>
        <div class="text-[11px] text-amber-900 dark:text-amber-200 leading-normal">
          <p class="font-bold mb-0.5">Sidebar Still Open</p>
          <p>Click the <strong>✕ (Close)</strong> button at the top-right of your sidebar (Gemini / Copilot). The exam will allow resuming only after it is closed.</p>
        </div>
      </div>

      <!-- Warning Counter Pill (if exited during test) -->
      <div
        v-if="!isInitialPrompt && violationCount > 0"
        class="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs"
        :class="
          isLockedOut
            ? 'bg-rose-600 text-white font-bold'
            : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300'
        "
      >
        <span class="material-symbols-outlined text-[18px]">warning</span>
        <span>
          Violations: <strong>{{ violationCount }} / {{ maxViolations || 5 }}</strong>
        </span>
      </div>

      <!-- Rules List -->
      <div
        v-if="!isLockedOut"
        class="w-full text-left bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-[11px] text-slate-600 dark:text-slate-300 flex flex-col gap-2"
      >
        <div class="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
          <span class="material-symbols-outlined text-[16px] text-primary">verified_user</span>
          <span>Proctoring Security Rules:</span>
        </div>
        <ul class="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
          <li>Close all browser sidebars (Gemini, Copilot, extensions) and floating overlays.</li>
          <li>Do not press Escape or click into outside apps / windows.</li>
          <li>Exam questions are hidden from the DOM whenever focus is lost.</li>
        </ul>
      </div>

      <!-- Lockout Action: OK Button -->
      <button
        v-if="isLockedOut"
        type="button"
        :disabled="isSubmittingLockout"
        class="w-full py-3.5 font-bold text-sm rounded-xl shadow-lg transition-all duration-150 flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
        @click="handleOkClick"
      >
        <span v-if="isSubmittingLockout" class="material-symbols-outlined text-[20px] animate-spin">
          progress_activity
        </span>
        <span v-else class="material-symbols-outlined text-[20px]">
          check_circle
        </span>
        <span>
          {{ isSubmittingLockout ? 'Submitting & Returning to Dashboard...' : 'OK' }}
        </span>
      </button>

      <!-- Standard Action Button -->
      <button
        v-else
        type="button"
        class="w-full py-3 font-bold text-sm rounded-xl shadow-md transition-all duration-150 flex items-center justify-center gap-2"
        :class="
          isSidePanelOpen
            ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
            : 'bg-[#2563eb] hover:bg-blue-700 active:bg-blue-800 text-white cursor-pointer'
        "
        @click="emit('enter-fullscreen')"
      >
        <span class="material-symbols-outlined text-[20px]">
          {{ isSidePanelOpen ? 'refresh' : 'fullscreen' }}
        </span>
        <span>
          {{
            isInitialPrompt
              ? 'Start Test in Fullscreen Mode'
              : isSidePanelOpen
              ? 'I have closed the sidebar — Resume Fullscreen'
              : 'Refocus & Return to Fullscreen'
          }}
        </span>
      </button>
    </div>
  </div>
</template>
