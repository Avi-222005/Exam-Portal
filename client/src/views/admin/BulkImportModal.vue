<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  parseTextToMcqs,
  parseCsvToMcqs,
  parsedMcqToPayload,
  SAMPLE_MCQ_CSV,
  type ParsedMcqQuestion,
} from '../../utils/questionParser';
import type { CreateProblemPayload } from '../../types/admin';

const props = defineProps<{
  startDisplayOrder: number;
  examId?: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'imported', questions: CreateProblemPayload[]): void;
}>();

const activeTab = ref<'text' | 'csv'>('text');
const rawText = ref(
  `Q1: What does CPU stand for?
A) Central Processing Unit
B) Central Performance Unit
C) Core Processing Unit
D) Computer Processing Unit
Answer: A
Marks: 1

Q2: Which data structure operates on LIFO (Last In First Out) principle?
A) Queue
B) Stack
C) Array
D) Binary Tree
Answer: B
Marks: 1`,
);

const csvContent = ref('');
const fileName = ref('');

const parsedQuestions = computed<ParsedMcqQuestion[]>(() => {
  if (activeTab.value === 'text') {
    return parseTextToMcqs(rawText.value);
  }
  return parseCsvToMcqs(csvContent.value);
});

function handleFileUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  fileName.value = file.name;
  const reader = new FileReader();
  reader.onload = (event) => {
    csvContent.value = (event.target?.result as string) || '';
  };
  reader.readAsText(file);
}

function downloadCsvTemplate() {
  const blob = new Blob([SAMPLE_MCQ_CSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mcq_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function handleConfirmImport() {
  if (parsedQuestions.value.length === 0) return;
  const payloads: CreateProblemPayload[] = parsedQuestions.value.map(
    (q, idx) => {
      return parsedMcqToPayload(
        q,
        props.startDisplayOrder + idx,
        props.examId,
      );
    },
  );
  emit('imported', payloads);
  emit('close');
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150"
    @click.self="emit('close')"
  >
    <div
      class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center"
          >
            <span class="material-symbols-outlined text-[20px]">dynamic_feed</span>
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">
              Bulk Import MCQs
            </h3>
            <p class="text-[11px] text-slate-500">
              Instantly create multiple questions by pasting text or uploading a CSV file.
            </p>
          </div>
        </div>

        <button
          type="button"
          class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          @click="emit('close')"
        >
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <!-- Mode Tabs -->
      <div
        class="px-6 border-b border-slate-200 dark:border-slate-800 flex gap-4 text-xs font-semibold flex-shrink-0 bg-slate-50/50 dark:bg-slate-800/30"
      >
        <button
          type="button"
          class="py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5"
          :class="
            activeTab === 'text'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          "
          @click="activeTab = 'text'"
        >
          <span class="material-symbols-outlined text-[16px]">edit_note</span>
          <span>Paste Plain Text / AI</span>
        </button>

        <button
          type="button"
          class="py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5"
          :class="
            activeTab === 'csv'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          "
          @click="activeTab = 'csv'"
        >
          <span class="material-symbols-outlined text-[16px]">upload_file</span>
          <span>Upload CSV / Excel</span>
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-5 text-xs">
        <!-- Tab 1: Text Paste -->
        <div v-if="activeTab === 'text'" class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <label class="font-bold text-slate-800 dark:text-slate-200">
              Paste Questions Below:
            </label>
            <span class="text-[11px] text-slate-500">
              Format: <code>Q1: Question text \n A) ... \n Answer: A</code>
            </span>
          </div>

          <textarea
            v-model="rawText"
            rows="7"
            class="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
            placeholder="Paste your questions here..."
          />
        </div>

        <!-- Tab 2: CSV Upload -->
        <div v-else class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-800 dark:text-slate-200">
              Select CSV File:
            </span>
            <button
              type="button"
              class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              @click="downloadCsvTemplate"
            >
              <span class="material-symbols-outlined text-[15px]">download</span>
              <span>Download CSV Template</span>
            </button>
          </div>

          <div
            class="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-950/40"
          >
            <span class="material-symbols-outlined text-[36px] text-slate-400">upload_file</span>
            <p class="text-slate-700 dark:text-slate-300 font-medium">
              {{ fileName || 'Click or drag a CSV file here' }}
            </p>
            <input
              type="file"
              accept=".csv,.txt"
              class="hidden"
              id="csv-file-input"
              @change="handleFileUpload"
            />
            <label
              for="csv-file-input"
              class="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shadow-xs"
            >
              Browse Files
            </label>
          </div>
        </div>

        <!-- Live Preview of Parsed Questions -->
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
            <span class="font-bold text-slate-800 dark:text-slate-200">
              Detected Questions Preview ({{ parsedQuestions.length }} found)
            </span>
            <span
              v-if="parsedQuestions.length > 0"
              class="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded font-semibold text-[11px]"
            >
              Ready to import
            </span>
            <span
              v-else
              class="px-2.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded font-semibold text-[11px]"
            >
              No valid questions detected
            </span>
          </div>

          <!-- Question preview list -->
          <div
            v-if="parsedQuestions.length > 0"
            class="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1"
          >
            <div
              v-for="(q, qIdx) in parsedQuestions"
              :key="qIdx"
              class="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl flex flex-col gap-2"
            >
              <div class="flex items-start justify-between gap-2">
                <span class="font-bold text-slate-900 dark:text-white">
                  {{ qIdx + 1 }}. {{ q.title }}
                </span>
                <span class="text-[10px] font-semibold bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 flex-shrink-0">
                  {{ q.maxScore }} Mark{{ q.maxScore > 1 ? 's' : '' }}
                </span>
              </div>

              <!-- Options -->
              <div class="grid grid-cols-2 gap-2 mt-1">
                <div
                  v-for="(opt, optIdx) in q.options"
                  :key="optIdx"
                  class="p-2 rounded border text-[11px] flex items-center gap-2"
                  :class="
                    opt.isCorrect
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 font-semibold text-emerald-900 dark:text-emerald-200'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  "
                >
                  <span
                    class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                    :class="
                      opt.isCorrect
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    "
                  >
                    {{ String.fromCharCode(65 + optIdx) }}
                  </span>
                  <span class="truncate">{{ opt.text }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 flex-shrink-0"
      >
        <span class="text-xs text-slate-500">
          {{ parsedQuestions.length }} question{{ parsedQuestions.length !== 1 ? 's' : '' }} will be created
        </span>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            @click="emit('close')"
          >
            Cancel
          </button>

          <button
            type="button"
            class="px-5 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            :disabled="parsedQuestions.length === 0"
            @click="handleConfirmImport"
          >
            <span class="material-symbols-outlined text-[16px]">file_download_done</span>
            <span>Import {{ parsedQuestions.length }} Questions</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
