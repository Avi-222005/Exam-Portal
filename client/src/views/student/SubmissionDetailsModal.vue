<script setup lang="ts">
import dayjs from 'dayjs';

interface SubmissionDetail {
  id: number;
  problemId: number;
  examId: number;
  sourceCode: string;
  languageId: number;
  status: string;
  score?: number;
  time?: number | null;
  memory?: number | null;
  submittedAt: string;
  problem?: {
    id: number;
    title: string;
    questionType: string;
    maxScore: number;
  };
  exam?: {
    id: number;
    title: string;
  };
}

defineProps<{
  submission: SubmissionDetail | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function formatTime(dateStr: string): string {
  return dayjs(dateStr).format('MMM D, YYYY · h:mm:ss A');
}

function getLanguageName(id: number): string {
  switch (id) {
    case 71: return 'Python 3';
    case 54: return 'C++ (GCC)';
    case 62: return 'Java (OpenJDK)';
    case 50: return 'C (GCC)';
    case 63: return 'JavaScript (Node.js)';
    default: return `Language #${id}`;
  }
}

function getStatusBadge(status: string) {
  const s = status?.toLowerCase() || '';
  if (s.includes('accepted') || s.includes('correct') || s === 'ac') {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  }
  if (s.includes('wrong') || s === 'wa') {
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  }
  if (s.includes('time') || s === 'tle') {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  }
  return 'bg-slate-800 text-slate-300 border-slate-700';
}
</script>

<template>
  <Transition name="modal">
    <div
      v-if="isOpen && submission"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div
        class="bg-[#161b22] border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold">
              <span class="material-symbols-outlined text-[20px]">code</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-100 flex items-center gap-2">
                {{ submission.problem?.title || `Problem #${submission.problemId}` }}
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border"
                  :class="getStatusBadge(submission.status)"
                >
                  {{ submission.status }}
                </span>
              </h3>
              <p class="text-xs text-slate-400">
                {{ submission.exam?.title || `Exam #${submission.examId}` }} · {{ formatTime(submission.submittedAt) }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
            @click="emit('close')"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto space-y-4 text-slate-300 text-xs custom-scrollbar">
          <!-- Metrics -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl">
              <span class="text-[10px] text-slate-500 font-semibold uppercase block">Language</span>
              <span class="text-xs font-bold text-slate-200 mt-0.5 block">{{ getLanguageName(submission.languageId) }}</span>
            </div>
            <div class="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl">
              <span class="text-[10px] text-slate-500 font-semibold uppercase block">Score Awarded</span>
              <span class="text-xs font-bold text-emerald-400 mt-0.5 block">{{ submission.score ?? 0 }} pts</span>
            </div>
            <div class="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl">
              <span class="text-[10px] text-slate-500 font-semibold uppercase block">Execution Time</span>
              <span class="text-xs font-bold text-slate-200 mt-0.5 block">
                {{ submission.time != null ? `${submission.time}s` : 'N/A' }}
              </span>
            </div>
            <div class="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl">
              <span class="text-[10px] text-slate-500 font-semibold uppercase block">Memory Used</span>
              <span class="text-xs font-bold text-slate-200 mt-0.5 block">
                {{ submission.memory != null ? `${submission.memory} KB` : 'N/A' }}
              </span>
            </div>
          </div>

          <!-- Source Code -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Submitted Source Code</span>
            </div>
            <pre class="p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono text-xs overflow-x-auto max-h-[350px] leading-relaxed select-all"><code>{{ submission.sourceCode }}</code></pre>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end">
          <button
            type="button"
            class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            @click="emit('close')"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
