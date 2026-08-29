import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import api from '../services/api';

export type ViolationType =
  | 'fullscreen_exit'
  | 'blur_focus_lost'
  | 'side_panel_detected'
  | 'tab_switched';

export function useFullscreenGuard(
  examIdSource?: Ref<number | string | undefined> | (() => number | string | undefined),
) {
  const authStore = useAuthStore();

  const getUserId = () => authStore.user?.id ?? 'anon';

  const getExamId = () => {
    if (!examIdSource) return 'current';
    if (typeof examIdSource === 'function') return examIdSource() ?? 'current';
    return examIdSource.value ?? 'current';
  };

  const getViolationsKey = () => `cv_u_${getUserId()}_exam_${getExamId()}_fs_violations`;

  const isFullscreen = ref(Boolean(document.fullscreenElement));
  const isStarted = ref(false);
  const violationCount = ref(0);
  const showGuardModal = ref(false);
  const currentViolationReason = ref<ViolationType | null>(null);

  // Tracks if the user is currently in an active paused/violation modal state
  // to prevent duplicate or timer-like repeating increments
  const isCurrentlyViolating = ref(false);

  function loadPersistedState() {
    const violations = parseInt(localStorage.getItem(getViolationsKey()) || '0', 10);
    violationCount.value = violations;
    isFullscreen.value = Boolean(document.fullscreenElement);
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
    if (!isStarted.value) return;
    if (isCurrentlyViolating.value) return; // Already paused; do not multi-count

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

    if (!isStarted.value) return;

    if (!activeFs) {
      triggerViolation('fullscreen_exit');
      return;
    }

    // Side panel detection: if browser side-panel is opened, viewport width shrinks significantly (>200px)
    const isSidePanelOpen =
      screen.width > 600 &&
      (screen.width - window.innerWidth > 200 || window.outerWidth - window.innerWidth > 200);

    if (isSidePanelOpen) {
      triggerViolation('side_panel_detected');
      return;
    }

    if (!document.hasFocus()) {
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
    if (!isStarted.value) return;
    triggerViolation('blur_focus_lost');
  }

  function handleVisibilityChange() {
    if (!isStarted.value) return;
    if (document.visibilityState === 'hidden') {
      triggerViolation('tab_switched');
    }
  }

  function handleResize() {
    if (!isStarted.value) return;
    checkFullscreenState();
  }

  function handleContextMenu(e: MouseEvent) {
    if (isStarted.value) {
      e.preventDefault();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!isStarted.value) return;

    // Block F12 (DevTools)
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
    if (!isStarted.value) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('.unselectable-area, [data-unselectable="true"], img')
    ) {
      e.preventDefault();
    }
  }

  async function enterFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      isStarted.value = true;
      isFullscreen.value = true;
      isCurrentlyViolating.value = false;
      showGuardModal.value = false;
      currentViolationReason.value = null;
    } catch (err) {
      console.warn('[fullscreen] Could not enter fullscreen mode', err);
      isStarted.value = true;
      isCurrentlyViolating.value = false;
      showGuardModal.value = false;
      currentViolationReason.value = null;
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
  });

  onUnmounted(() => {
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
    isStarted,
    enterFullscreen,
    exitFullscreen,
    clearSession,
  };
}
