import {
  shallowRef,
  markRaw,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
  type Ref,
} from 'vue';

import { themeColors } from '../config/theme';
import { useUiStore } from '../stores/ui';
import { useToastStore } from '../stores/toast';
import { useClipboardStore } from '../stores/clipboard';

// Use the minimal editor API entry - avoids pulling in all 100+ language servers
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// Import only the 5 language syntax contributions we actually use
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution';
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution'; // registers both 'c' and 'cpp'
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';

// In-memory whitelist of snippets copied strictly within the assessment code editor
const internalClipWhitelist = new Set<string>();

export function normalizeClip(text: string): string {
  return (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

export function registerInternalClip(text: string) {
  if (!text) return;
  const normalized = normalizeClip(text);
  if (normalized) {
    internalClipWhitelist.add(normalized);
  }
}

export function isInternalClip(text: string): boolean {
  if (!text) return false;
  const normalized = normalizeClip(text);
  if (!normalized) return false;
  return internalClipWhitelist.has(normalized);
}

// Only the base editor worker - no IntelliSense or language servers needed
declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker(_moduleId: string, _label: string): Worker;
    };
  }
}

self.MonacoEnvironment = {
  getWorker() {
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      { type: 'module' },
    );
  },
};

let themeRegistered = false;

function registerTheme() {
  if (themeRegistered) return;
  themeRegistered = true;

  monaco.editor.defineTheme('exam-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      {
        token: 'keyword',
        foreground: themeColors.primary.replace('#', ''),
        fontStyle: 'bold',
      },
      { token: 'string', foreground: themeColors.accent.replace('#', '') },
      { token: 'comment', foreground: '5f6368', fontStyle: 'italic' },
      { token: 'number', foreground: 'e4a526' },
      { token: 'type', foreground: '5b8def' },
      { token: 'function', foreground: 'dcdcaa' },
      { token: 'variable', foreground: 'e8eaed' },
      { token: 'operator', foreground: 'e8eaed' },
    ],
    colors: {
      'editor.background': '#0d1011',
      'editor.foreground': '#e8eaed',
      'editor.lineHighlightBackground': '#1a1e1f',
      'editor.selectionBackground': `${themeColors.accent}40`,
      'editorCursor.foreground': themeColors.accent,
      'editorLineNumber.foreground': '#5f6368',
      'editorLineNumber.activeForeground': '#e8eaed',
      'editor.inactiveSelectionBackground': `${themeColors.accent}20`,
      'editorWidget.background': '#141718',
      'editorWidget.border': '#2d3234',
      'input.background': '#0d1011',
      'input.border': '#2d3234',
      'dropdown.background': '#141718',
    },
  });
}

export function useMonaco(
  containerRef: Ref<HTMLElement | null>,
  language: Ref<string>,
  code: Ref<string>,
) {
  const editor = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const toastStore = useToastStore();
  const clipboardStore = useClipboardStore();

  // Tracks the last value we pushed INTO Monaco programmatically.
  // When watch(code) fires, if newVal === lastSetValue the change came FROM
  // Monaco (user typed), so we skip setValue to avoid a cursor-reset loop.
  let lastSetValue = '';

  // Guard: true while we are programmatically calling setValue, so the
  // onDidChangeModelContent listener ignores the resulting event.
  let updatingFromExternal = false;

  let contentDisposable: monaco.IDisposable | null = null;
  let pasteDisposable: monaco.IDisposable | null = null;
  let keyDownDisposable: monaco.IDisposable | null = null;

  function captureEditorSelection() {
    if (!editor.value) return;
    const model = editor.value.getModel();
    const selection = editor.value.getSelection();
    let textToCopy = '';

    if (selection && !selection.isEmpty() && model) {
      textToCopy = model.getValueInRange(selection);
    } else if (model) {
      const pos = editor.value.getPosition();
      if (pos) {
        textToCopy = model.getLineContent(pos.lineNumber) + '\n';
      }
    }

    if (textToCopy) {
      registerInternalClip(textToCopy);
      clipboardStore.push(textToCopy);
    }
  }

  function isAllowedText(pastedText: string): boolean {
    if (!pastedText) return true;
    const normalized = normalizeClip(pastedText);
    if (!normalized) return true;
    return isInternalClip(normalized);
  }

  function onWindowCopyOrCut(_e: ClipboardEvent) {
    const activeEl = document.activeElement;
    const isInsideMonaco =
      Boolean(activeEl?.closest('.monaco-editor')) ||
      Boolean(containerRef.value?.contains(activeEl));

    if (isInsideMonaco) {
      captureEditorSelection();
    }
  }

  function onWindowPaste(e: ClipboardEvent) {
    const activeEl = document.activeElement;
    const isInsideMonaco =
      Boolean(activeEl?.closest('.monaco-editor')) ||
      Boolean(containerRef.value?.contains(activeEl));

    if (!isInsideMonaco) return;

    const pastedText =
      e.clipboardData?.getData('text/plain') ??
      e.clipboardData?.getData('text') ??
      '';

    if (pastedText && !isAllowedText(pastedText)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      toastStore.add(
        'warning',
        'External paste blocked. Only code copied within this assessment editor can be pasted.',
        4000,
      );
    }
  }

  function onWindowDrop(e: DragEvent) {
    const activeEl = document.activeElement;
    const isInsideMonaco =
      Boolean(activeEl?.closest('.monaco-editor')) ||
      Boolean(containerRef.value?.contains(activeEl));

    if (isInsideMonaco) {
      e.preventDefault();
      e.stopPropagation();
      toastStore.add(
        'warning',
        'Dragging external content is disabled during the exam.',
        3000,
      );
    }
  }

  onMounted(() => {
    if (!containerRef.value) return;
    registerTheme();

    lastSetValue = code.value;
    editor.value = markRaw(
      monaco.editor.create(containerRef.value, {
        value: code.value,
        language: language.value,
        theme: 'exam-dark',
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
        padding: { top: 12 },
        lineNumbers: 'on',
        wordWrap: 'off',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        dragAndDrop: false,
      }),
    );

    // Capture Ctrl+C / Ctrl+X at the Monaco keydown level
    keyDownDisposable = editor.value.onKeyDown((e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.keyCode === monaco.KeyCode.KeyC || e.keyCode === monaco.KeyCode.KeyX)
      ) {
        captureEditorSelection();
      }
    });

    // Fallback security barrier: if any external text bypassed DOM paste, detect & erase it
    pasteDisposable = editor.value.onDidPaste((e) => {
      if (!editor.value) return;
      const model = editor.value.getModel();
      if (!model) return;
      const insertedText = model.getValueInRange(e.range);
      if (!insertedText) return;

      if (!isAllowedText(insertedText)) {
        editor.value.executeEdits('anti-cheat-paste-block', [
          {
            range: e.range,
            text: '',
            forceMoveMarkers: true,
          },
        ]);
        toastStore.add(
          'warning',
          'External paste blocked. Only code copied within this assessment editor can be pasted.',
          4000,
        );
      }
    });

    // Monaco → Vue: user typed something.
    contentDisposable = editor.value.onDidChangeModelContent(() => {
      if (updatingFromExternal) return;
      const val = editor.value!.getValue();
      lastSetValue = val;
      code.value = val;
    });

    window.addEventListener('copy', onWindowCopyOrCut, true);
    window.addEventListener('cut', onWindowCopyOrCut, true);
    window.addEventListener('paste', onWindowPaste, true);
    window.addEventListener('drop', onWindowDrop, true);
  });

  // Vue → Monaco: code changed from outside (language switch, problem change,
  // autosave restore). Only sync when the new value is different from what
  // Monaco already has - i.e. not a change that originated from Monaco itself.
  watch(code, (newVal) => {
    if (!editor.value) return;
    // Skip if this change originated from Monaco (user typing)
    if (newVal === lastSetValue) return;
    // Also skip if Monaco already has this exact content
    if (editor.value.getValue() === newVal) {
      lastSetValue = newVal;
      return;
    }
    updatingFromExternal = true;
    lastSetValue = newVal;
    editor.value.setValue(newVal);
    updatingFromExternal = false;
  });

  // Defer setModelLanguage to the next tick so it never runs in the same
  // synchronous batch as setValue - running both together in one tick causes
  // Monaco to process two model mutations without yielding to the browser.
  watch(language, (newLang) => {
    void nextTick(() => {
      if (editor.value) {
        const model = editor.value.getModel();
        if (model) monaco.editor.setModelLanguage(model, newLang);
      }
    });
  });

  const uiStore = useUiStore();

  watch(
    () => uiStore.textScale,
    (scale) => {
      if (!editor.value) return;
      const baseSize = 14;
      const computedSize = Math.max(10, Math.round(baseSize * (scale / 100)));
      editor.value.updateOptions({ fontSize: computedSize });
      requestAnimationFrame(() => editor.value?.layout());
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    window.removeEventListener('copy', onWindowCopyOrCut, true);
    window.removeEventListener('cut', onWindowCopyOrCut, true);
    window.removeEventListener('paste', onWindowPaste, true);
    window.removeEventListener('drop', onWindowDrop, true);
    keyDownDisposable?.dispose();
    pasteDisposable?.dispose();
    contentDisposable?.dispose();
    editor.value?.dispose();
    editor.value = null;
  });

  return { editor };
}
