import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue';
import { useAuthStore } from '../stores/auth';

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

  function loadPersistedState() {
    // Clean up any legacy un-scoped keys
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
      if (!active) {
        showGuardModal.value = true;
      } else {
        showGuardModal.value = false;
      }
    } else {
      showGuardModal.value = true;
    }
  }

  function recordViolation() {
    violationCount.value++;
    localStorage.setItem(getViolationsKey(), String(violationCount.value));
  }

  function checkFullscreen() {
    const active = Boolean(document.fullscreenElement);
    isFullscreen.value = active;

    if (isStarted.value) {
      if (!active) {
        showGuardModal.value = true;
        recordViolation();
      } else {
        showGuardModal.value = false;
      }
    }
  }

  function handleVisibilityChange() {
    if (isStarted.value && document.visibilityState === 'hidden') {
      recordViolation();
      showGuardModal.value = true;
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
    } catch (err) {
      console.warn('[fullscreen] Could not enter fullscreen mode', err);
      // Even if fullscreen is blocked by browser policy, allow proceeding with warning
      isStarted.value = true;
      localStorage.setItem(getStartedKey(), 'true');
      showGuardModal.value = false;
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
  }

  watch(
    () => [authStore.user?.id, getExamId()],
    () => {
      loadPersistedState();
    },
  );

  onMounted(() => {
    loadPersistedState();
    document.addEventListener('fullscreenchange', checkFullscreen);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyOrCut);
    document.addEventListener('cut', handleCopyOrCut);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', checkFullscreen);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('copy', handleCopyOrCut);
    document.removeEventListener('cut', handleCopyOrCut);
    document.removeEventListener('selectstart', handleSelectStart);
    document.removeEventListener('dragstart', handleDragStart);
    window.removeEventListener('keydown', handleKeyDown);
  });

  return {
    isFullscreen,
    showGuardModal,
    violationCount,
    isStarted,
    enterFullscreen,
    exitFullscreen,
    clearSession,
  };
}
