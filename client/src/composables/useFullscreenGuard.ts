import { ref, computed, onMounted, onUnmounted, watch, type Ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import type { ProctoringConfig } from '../types';
import api from '../services/api';

export type ViolationType =
  | 'fullscreen_exit'
  | 'blur_focus_lost'
  | 'side_panel_detected'
  | 'tab_switched';

export const DEFAULT_MAX_VIOLATIONS = 5;

export function useFullscreenGuard(
  examIdSource?: Ref<number | string | undefined> | (() => number | string | undefined),
  maxViolationsSource?: Ref<number | undefined> | (() => number | undefined) | number,
  proctoringConfigSource?: Ref<ProctoringConfig | undefined> | (() => ProctoringConfig | undefined),
) {
  const authStore = useAuthStore();

  const getUserId = () => authStore.user?.id ?? 'anon';

  const getExamId = () => {
    if (!examIdSource) return 'current';
    if (typeof examIdSource === 'function') return examIdSource() ?? 'current';
    return examIdSource.value ?? 'current';
  };

  const getMaxViolations = () => {
    if (typeof maxViolationsSource === 'number') return maxViolationsSource;
    if (typeof maxViolationsSource === 'function') return maxViolationsSource() ?? DEFAULT_MAX_VIOLATIONS;
    if (maxViolationsSource && 'value' in maxViolationsSource) return maxViolationsSource.value ?? DEFAULT_MAX_VIOLATIONS;
    return DEFAULT_MAX_VIOLATIONS;
  };

  const getProctoringConfig = (): ProctoringConfig => {
    let cfg: ProctoringConfig | undefined;
    if (typeof proctoringConfigSource === 'function') {
      cfg = proctoringConfigSource();
    } else if (proctoringConfigSource && 'value' in proctoringConfigSource) {
      cfg = proctoringConfigSource.value;
    }
    return {
      isProctored: cfg?.isProctored !== undefined ? Boolean(cfg.isProctored) : true,
      enforceFullscreen: cfg?.enforceFullscreen !== undefined ? Boolean(cfg.enforceFullscreen) : true,
      preventTabSwitching: cfg?.preventTabSwitching !== undefined ? Boolean(cfg.preventTabSwitching) : true,
      detectSidePanel: cfg?.detectSidePanel !== undefined ? Boolean(cfg.detectSidePanel) : true,
      preventCopyPaste: cfg?.preventCopyPaste !== undefined ? Boolean(cfg.preventCopyPaste) : true,
      blockDevTools: cfg?.blockDevTools !== undefined ? Boolean(cfg.blockDevTools) : true,
      showWatermark: cfg?.showWatermark !== undefined ? Boolean(cfg.showWatermark) : true,
      maxViolations: cfg?.maxViolations ?? getMaxViolations(),
    };
  };

  const config = computed(getProctoringConfig);
  const isProctored = computed(() => config.value.isProctored);
  const maxViolations = computed(() => config.value.maxViolations ?? getMaxViolations());

  const getViolationsKey = () => `cv_u_${getUserId()}_exam_${getExamId()}_fs_violations`;

  const isFullscreen = ref(Boolean(document.fullscreenElement));
  const isStarted = ref(false);
  const violationCount = ref(0);
  const showGuardModal = ref(false);
  const currentViolationReason = ref<ViolationType | null>(null);
  const isSidePanelOpen = ref(false);

  // Tracks if the user is currently in an active paused/violation modal state
  // to prevent duplicate or timer-like repeating increments
  const isCurrentlyViolating = ref(false);

  let pollInterval: number | null = null;

  const isLockedOut = computed(() => {
    if (!isProctored.value) return false;
    if (maxViolations.value >= 999) return false;
    return violationCount.value >= maxViolations.value;
  });

  const isGuardModalActive = computed(() => {
    if (!isProctored.value) return false;
    if (isLockedOut.value) return true;
    if (showGuardModal.value) return true;
    if (config.value.enforceFullscreen && (!isStarted.value || !isFullscreen.value)) {
      return true;
    }
    return false;
  });

  // Shield flag: whenever modal is visible, focus is lost, or not in fullscreen,
  // question and code editor content must be completely unmounted from the DOM!
  const isQuestionContentHidden = computed(() => {
    if (!isProctored.value) return false;
    return (
      isGuardModalActive.value ||
      isCurrentlyViolating.value
    );
  });

  watch(
    () => [isProctored.value, config.value.enforceFullscreen],
    ([proctored, enforceFs]) => {
      if (!proctored || !enforceFs) {
        isStarted.value = true;
      }
    },
    { immediate: true },
  );

  function checkSidePanelStatus(): boolean {
    if (typeof window === 'undefined') return false;
    // Side panels (Chrome Gemini, Edge Copilot, etc.) reduce innerWidth by 300px-500px
    return (
      window.screen.width > 600 &&
      (window.screen.width - window.innerWidth > 140 ||
        window.outerWidth - window.innerWidth > 140)
    );
  }

  function loadPersistedState() {
    const violations = parseInt(localStorage.getItem(getViolationsKey()) || '0', 10);
    violationCount.value = violations;
    isFullscreen.value = Boolean(document.fullscreenElement);
    isSidePanelOpen.value = checkSidePanelStatus();
  }

  function logViolationToBackend(reason: ViolationType, count: number) {
    const examId = getExamId();
    if (examId && examId !== 'current') {
      void api
        .post(`/exams/${examId}/proctor-event`, {
          eventType: reason,
          violationCount: count,
          timestamp: new Date().toISOString(),
        })
        .catch(() => {
          // graceful offline fallback
        });
    }
  }

  function triggerViolation(reason: ViolationType) {
    if (!isProctored.value) return;
    if (!isStarted.value) return;
    if (isCurrentlyViolating.value) return; // Already paused; do not multi-count

    // Check individual guard configurations
    if (reason === 'fullscreen_exit' && !config.value.enforceFullscreen) return;
    if (
      (reason === 'blur_focus_lost' || reason === 'tab_switched') &&
      !config.value.preventTabSwitching
    ) {
      return;
    }
    if (reason === 'side_panel_detected' && !config.value.detectSidePanel) return;

    isCurrentlyViolating.value = true;
    currentViolationReason.value = reason;
    showGuardModal.value = true;
    violationCount.value++;
    localStorage.setItem(getViolationsKey(), String(violationCount.value));
    logViolationToBackend(reason, violationCount.value);

    // Sanitize clipboard on violation
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        void navigator.clipboard.writeText('');
      }
    } catch {
      // ignore
    }
  }

  function checkFullscreenState() {
    const activeFs = Boolean(document.fullscreenElement);
    isFullscreen.value = activeFs;

    const sidePanelActive = checkSidePanelStatus();
    isSidePanelOpen.value = sidePanelActive;

    if (!isProctored.value) return;
    if (!isStarted.value) return;

    if (isLockedOut.value) {
      showGuardModal.value = true;
      return;
    }

    if (config.value.enforceFullscreen && !activeFs) {
      triggerViolation('fullscreen_exit');
      return;
    }

    if (config.value.detectSidePanel && sidePanelActive) {
      triggerViolation('side_panel_detected');
      return;
    }

    if (config.value.preventTabSwitching && !document.hasFocus()) {
      triggerViolation('blur_focus_lost');
      return;
    }

    // If all checks pass and we were not violating, ensure modal is closed
    if (!isCurrentlyViolating.value) {
      showGuardModal.value = false;
      currentViolationReason.value = null;
    }
  }

  function handleBlur() {
    if (!isProctored.value) return;
    if (!config.value.preventTabSwitching) return;
    if (!isStarted.value) return;
    triggerViolation('blur_focus_lost');
  }

  function handleVisibilityChange() {
    if (!isProctored.value) return;
    if (!config.value.preventTabSwitching) return;
    if (!isStarted.value) return;
    if (document.visibilityState === 'hidden') {
      triggerViolation('tab_switched');
    }
  }

  function handleResize() {
    checkFullscreenState();
  }

  function handleContextMenu(e: MouseEvent) {
    if (!isProctored.value) return;
    if (!config.value.preventCopyPaste) return;
    if (isStarted.value) {
      e.preventDefault();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!isProctored.value) return;
    if (!isStarted.value) return;

    // Block F12 (DevTools)
    if (config.value.blockDevTools) {
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }

      // Block Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (Inspect Element)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)
      ) {
        e.preventDefault();
        return;
      }

      // Block Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && ['U', 'u'].includes(e.key)) {
        e.preventDefault();
        return;
      }
    }

    // Block Ctrl+R / F5 (Page Refresh)
    if (
      e.key === 'F5' ||
      ((e.ctrlKey || e.metaKey) && ['R', 'r'].includes(e.key))
    ) {
      e.preventDefault();
      return;
    }

    // Block Ctrl+A / Ctrl+C / Ctrl+X when focused on question areas
    if (
      config.value.preventCopyPaste &&
      (e.ctrlKey || e.metaKey) &&
      ['A', 'a', 'C', 'c', 'X', 'x'].includes(e.key)
    ) {
      const target = e.target as HTMLElement | null;
      const selection = window.getSelection();
      const anchorNode = selection?.anchorNode;
      const anchorEl = (
        anchorNode?.nodeType === Node.ELEMENT_NODE
          ? anchorNode
          : anchorNode?.parentElement
      ) as HTMLElement | null;

      const isInsideEditor =
        target?.closest('.monaco-editor, .view-lines, textarea, input') ||
        anchorEl?.closest('.monaco-editor, .view-lines, textarea, input');

      const isInsideQuestion =
        target?.closest('.unselectable-area, [data-unselectable="true"]') ||
        anchorEl?.closest('.unselectable-area, [data-unselectable="true"]');

      if (isInsideQuestion && !isInsideEditor) {
        e.preventDefault();
        return;
      }
    }
  }

  function handleCopyOrCut(e: ClipboardEvent) {
    if (!isProctored.value) return;
    if (!config.value.preventCopyPaste) return;
    if (!isStarted.value) return;

    const target = e.target as HTMLElement | null;
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    const anchorEl = (
      anchorNode?.nodeType === Node.ELEMENT_NODE
        ? anchorNode
        : anchorNode?.parentElement
    ) as HTMLElement | null;

    const isInsideEditor =
      target?.closest('.monaco-editor, .view-lines, textarea, input') ||
      anchorEl?.closest('.monaco-editor, .view-lines, textarea, input');

    const isInsideQuestion =
      target?.closest('.unselectable-area, [data-unselectable="true"]') ||
      anchorEl?.closest('.unselectable-area, [data-unselectable="true"]');

    if (isInsideQuestion && !isInsideEditor) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function handleSelectStart(e: Event) {
    if (!isProctored.value) return;
    if (!config.value.preventCopyPaste) return;
    if (!isStarted.value) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('.unselectable-area, [data-unselectable="true"]')) {
      const isInsideEditor = target.closest(
        '.monaco-editor, .view-lines, textarea, input',
      );
      if (!isInsideEditor) {
        e.preventDefault();
      }
    }
  }

  function handleDragStart(e: DragEvent) {
    if (!isProctored.value) return;
    if (!config.value.preventCopyPaste) return;
    if (!isStarted.value) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('.unselectable-area, [data-unselectable="true"], img')
    ) {
      e.preventDefault();
    }
  }

  async function enterFullscreen(): Promise<boolean> {
    if (!isProctored.value) {
      isStarted.value = true;
      isFullscreen.value = true;
      isCurrentlyViolating.value = false;
      showGuardModal.value = false;
      isSidePanelOpen.value = false;
      currentViolationReason.value = null;
      return true;
    }

    if (isLockedOut.value) return false;

    // Hard Gate: If browser side panel is still open, refuse to resume if detectSidePanel is active
    if (config.value.detectSidePanel && checkSidePanelStatus()) {
      isSidePanelOpen.value = true;
      currentViolationReason.value = 'side_panel_detected';
      showGuardModal.value = true;
      return false;
    }

    if (!config.value.enforceFullscreen) {
      isStarted.value = true;
      isFullscreen.value = true;
      isCurrentlyViolating.value = false;
      showGuardModal.value = false;
      isSidePanelOpen.value = false;
      currentViolationReason.value = null;
      return true;
    }

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      isStarted.value = true;
      isFullscreen.value = true;
      isCurrentlyViolating.value = false;
      showGuardModal.value = false;
      isSidePanelOpen.value = false;
      currentViolationReason.value = null;
      return true;
    } catch (err) {
      console.warn('[fullscreen] Could not enter fullscreen mode', err);
      isStarted.value = true;
      isCurrentlyViolating.value = false;
      showGuardModal.value = false;
      isSidePanelOpen.value = false;
      currentViolationReason.value = null;
      return true;
    }
  }

  async function exitFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
    isFullscreen.value = false;
  }

  function clearSession() {
    localStorage.removeItem(getViolationsKey());
    isStarted.value = false;
    isCurrentlyViolating.value = false;
    violationCount.value = 0;
    currentViolationReason.value = null;
    isSidePanelOpen.value = false;
  }

  watch(
    () => [authStore.user?.id, getExamId()],
    () => {
      loadPersistedState();
    },
  );

  onMounted(() => {
    loadPersistedState();
    document.addEventListener('fullscreenchange', checkFullscreenState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyOrCut);
    document.addEventListener('cut', handleCopyOrCut);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('resize', handleResize);

    // Active polling to track sidebar closure in real time
    pollInterval = window.setInterval(() => {
      if (!isProctored.value) return;
      const sidePanelActive = checkSidePanelStatus();
      isSidePanelOpen.value = sidePanelActive;

      if (isStarted.value) {
        if (
          config.value.detectSidePanel &&
          sidePanelActive &&
          !isCurrentlyViolating.value
        ) {
          triggerViolation('side_panel_detected');
        } else if (
          config.value.preventTabSwitching &&
          !document.hasFocus() &&
          !isCurrentlyViolating.value
        ) {
          triggerViolation('blur_focus_lost');
        }
      }
    }, 400);
  });

  onUnmounted(() => {
    if (pollInterval) clearInterval(pollInterval);
    document.removeEventListener('fullscreenchange', checkFullscreenState);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('copy', handleCopyOrCut);
    document.removeEventListener('cut', handleCopyOrCut);
    document.removeEventListener('selectstart', handleSelectStart);
    document.removeEventListener('dragstart', handleDragStart);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('blur', handleBlur);
    window.removeEventListener('resize', handleResize);
  });

  return {
    isFullscreen,
    showGuardModal,
    violationCount,
    currentViolationReason,
    isSidePanelOpen,
    isLockedOut,
    maxViolations,
    isQuestionContentHidden,
    isStarted,
    isProctored,
    isGuardModalActive,
    config,
    enterFullscreen,
    exitFullscreen,
    clearSession,
  };
}
