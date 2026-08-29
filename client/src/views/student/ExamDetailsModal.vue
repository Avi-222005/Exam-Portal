<script setup lang="ts">
import dayjs from 'dayjs';

interface ExamDetails {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  allowedLanguages?: number[];
  mcqCount?: number;
  codingCount?: number;
  totalProblems?: number;
  totalMarks?: number;
}

const props = defineProps<{
  exam: ExamDetails | null;
  isOpen: boolean;
  isEnrolled: boolean;
  isLive: boolean;
  isStarted?: boolean;
  isCompleted?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'enroll', exam: ExamDetails): void;
  (e: 'enter', exam: ExamDetails): void;
}>();

function formatTime(dateStr: string): string {
  return dayjs(dateStr).format('dddd, MMMM D, YYYY · h:mm A');
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} hour${h > 1 ? 's' : ''} ${m} min${m > 1 ? 's' : ''}`;
  if (h > 0) return `${h} hour${h > 1 ? 's' : ''}`;
  return `${m} mins`;
}
</script>

<template>
  <Transition name="modal">
    <div
      v-if="isOpen && exam"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div
        class="bg-[#161b22] border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      >
        <!-- Modal Header -->
        <div class="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold">
              <span class="material-symbols-outlined text-[20px]">assignment</span>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-100">{{ exam.title }}</h3>
              <p class="text-xs text-slate-400">Exam Specifications & Instructions</p>
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

        <!-- Modal Body -->
        <div class="p-6 overflow-y-auto space-y-6 text-slate-300 text-xs custom-scrollbar">
          <!-- Overview Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-center">
              <span class="text-[10px] text-slate-500 font-semibold uppercase block">Duration</span>
              <span class="text-sm font-bold text-slate-100 mt-0.5 block">{{ formatDuration(exam.durationMinutes) }}</span>
            </div>
            <div class="p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-center">
              <span class="text-[10px] text-slate-500 font-semibold uppercase block">MCQ Questions</span>
              <span class="text-sm font-bold text-sky-400 mt-0.5 block">{{ exam.mcqCount ?? 0 }}</span>
            </div>
            <div class="p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-center">
              <span class="text-[10px] text-slate-500 font-semibold uppercase block">Coding Problems</span>
              <span class="text-sm font-bold text-purple-400 mt-0.5 block">{{ exam.codingCount ?? 0 }}</span>
            </div>
            <div class="p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-center">
              <span class="text-[10px] text-slate-500 font-semibold uppercase block">Total Marks</span>
              <span class="text-sm font-bold text-emerald-400 mt-0.5 block">{{ exam.totalMarks ?? 0 }} pts</span>
            </div>
          </div>

          <!-- Schedule -->
          <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px] text-primary">event</span>
              Exam Schedule
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span class="text-slate-500 block">Start Time:</span>
                <span class="font-semibold text-slate-200">{{ formatTime(exam.startTime) }}</span>
              </div>
              <div>
                <span class="text-slate-500 block">End Time:</span>
                <span class="font-semibold text-slate-200">{{ formatTime(exam.endTime) }}</span>
              </div>
            </div>
          </div>

          <!-- Rules & Instructions -->
          <div class="space-y-2.5">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px] text-primary">rule</span>
              Important Guidelines & Scoring Rules
            </h4>
            <ul class="space-y-2 text-slate-300 list-disc list-inside leading-relaxed bg-slate-900/30 p-4 rounded-xl border border-slate-800">
              <li><strong>Section Structure:</strong> The exam is divided into Multiple Choice Questions (MCQ) and Hands-on Coding sections.</li>
              <li><strong>Real-Time Code Execution:</strong> Run test cases in the Monaco code editor with instant verdicts before final submission.</li>
              <li><strong>Continuous Autosave:</strong> Your draft responses are continuously saved to the server so your progress is preserved across accidental browser reloads.</li>
              <li><strong>ICPC Penalty System:</strong> Wrong code submissions add a 5-minute penalty to your solve time on the leaderboard. Test carefully with "Run" first.</li>
              <li><strong>Proctoring & Integrity:</strong> Avoid tab switching or closing your exam window during live assessment.</li>
            </ul>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <button
            type="button"
            class="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            @click="emit('close')"
          >
            Close
          </button>

          <div class="flex items-center gap-3">
            <button
              v-if="isCompleted"
              type="button"
              class="px-5 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-default"
              disabled
            >
              <span class="material-symbols-outlined text-[16px]">task_alt</span>
              Test Finished
            </button>
            <button
              v-else-if="isLive"
              type="button"
              :class="[
                'px-5 py-2 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer',
                isStarted
                  ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 shadow-orange-500/25'
                  : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20',
              ]"
              @click="emit('enter', exam)"
            >
              <span class="material-symbols-outlined text-[16px]">{{ isStarted ? 'play_circle' : 'play_arrow' }}</span>
              {{ isStarted ? 'Resume Test' : 'Start Test' }}
            </button>
            <button
              v-else-if="!isEnrolled"
              type="button"
              class="px-5 py-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary/20 flex items-center gap-1.5 transition-all cursor-pointer"
              @click="emit('enroll', exam)"
            >
              <span class="material-symbols-outlined text-[16px]">how_to_reg</span>
              1-Click Enroll
            </button>
            <span v-else class="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]">check_circle</span>
              Enrolled
            </span>
          </div>
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
