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

  const getStartedKey = () => `cv_u_${getUserId()}_exam_${getExamId()}_fs_started`;
  const getViolationsKey = () => `cv_u_${getUserId()}_exam_${getExamId()}_fs_violations`;

  const isFullscreen = ref(Boolean(document.fullscreenElement));
  const isStarted = ref(false);
  const violationCount = ref(0);
  const showGuardModal = ref(false);
  const currentViolationReason = ref<ViolationType | null>(null);

  let heartbeatInterval: number | null = null;
  let lastViolationTime = 0;

  function loadPersistedState() {
    const legacyKey = `cv_exam_${getExamId()}_fs_violations`;
    if (localStorage.getItem(legacyKey)) {
      localStorage.removeItem(legacyKey);
      localStorage.removeItem(`cv_exam_${getExamId()}_fs_started`);
    }

    const started = localStorage.getItem(getStartedKey()) === 'true';
    const violations = parseInt(localStorage.getItem(getViolationsKey()) || '0', 10);
    isStarted.value = started;
    violationCount.value = violations;

    const active = Boolean(document.fullscreenElement);
    isFullscreen.value = active;

    if (started) {
      if (!active || !document.hasFocus()) {
        showGuardModal.value = true;
      } else {
        showGuardModal.value = false;
      }
    } else {
      showGuardModal.value = true;
    }
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

  function recordViolation(reason: ViolationType) {
    const now = Date.now();
    // Throttle duplicate violations within 800ms
    if (now - lastViolationTime < 800) return;
    lastViolationTime = now;

    currentViolationReason.value = reason;
    violationCount.value++;
    localStorage.setItem(getViolationsKey(), String(violationCount.value));
    logViolationToBackend(reason, violationCount.value);
  }

  function sanitizeClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        void navigator.clipboard.writeText('');
      }
    } catch {
      // ignore
    }
  }

  function checkFullscreenAndFocus() {
    const activeFs = Boolean(document.fullscreenElement);
    isFullscreen.value = activeFs;

    if (!isStarted.value) return;

    const hasFocus = document.hasFocus();
    const isSidePanelOpen =
      screen.width > 600 &&
      (screen.width - window.innerWidth > 75 || screen.height - window.innerHeight > 75);

    if (!activeFs) {
      showGuardModal.value = true;
      recordViolation('fullscreen_exit');
    } else if (!hasFocus) {
      showGuardModal.value = true;
      recordViolation('blur_focus_lost');
      sanitizeClipboard();
    } else if (isSidePanelOpen) {
      showGuardModal.value = true;
      recordViolation('side_panel_detected');
    } else {
      showGuardModal.value = false;
      currentViolationReason.value = null;
    }
  }

  function handleBlur() {
    if (isStarted.value) {
      showGuardModal.value = true;
      recordViolation('blur_focus_lost');
      sanitizeClipboard();
    }
  }

  function handleFocus() {
    if (isStarted.value) {
      checkFullscreenAndFocus();
    }
  }

  function handleResize() {
    if (isStarted.value) {
      checkFullscreenAndFocus();
    }
  }

  function handleVisibilityChange() {
    if (isStarted.value && document.visibilityState === 'hidden') {
      recordViolation('tab_switched');
      showGuardModal.value = true;
      sanitizeClipboard();
    }
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
      localStorage.setItem(getStartedKey(), 'true');
      isFullscreen.value = true;
      showGuardModal.value = false;
      currentViolationReason.value = null;
    } catch (err) {
      console.warn('[fullscreen] Could not enter fullscreen mode', err);
      isStarted.value = true;
      localStorage.setItem(getStartedKey(), 'true');
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
    localStorage.removeItem(getStartedKey());
    localStorage.removeItem(getViolationsKey());
    isStarted.value = false;
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
    document.addEventListener('fullscreenchange', checkFullscreenAndFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyOrCut);
    document.addEventListener('cut', handleCopyOrCut);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('resize', handleResize);

    // Active heartbeat to catch side-panels and floating overlays
    heartbeatInterval = window.setInterval(() => {
      checkFullscreenAndFocus();
    }, 400);
  });

  onUnmounted(() => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    document.removeEventListener('fullscreenchange', checkFullscreenAndFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('copy', handleCopyOrCut);
    document.removeEventListener('cut', handleCopyOrCut);
    document.removeEventListener('selectstart', handleSelectStart);
    document.removeEventListener('dragstart', handleDragStart);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('blur', handleBlur);
    window.removeEventListener('focus', handleFocus);
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
