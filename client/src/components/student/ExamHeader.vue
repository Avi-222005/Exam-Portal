<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useExamStore } from '../../stores/exam';
import { useProblemsStore } from '../../stores/problems';
import { useUiStore } from '../../stores/ui';

const props = defineProps<{
  activeSection: 'mcq' | 'coding';
  remainingTime: string;
  isTimerWarning?: boolean;
  isTimerCritical?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select-section', section: 'mcq' | 'coding'): void;
  (e: 'submit-test'): void;
}>();

const authStore = useAuthStore();
const examStore = useExamStore();
const problemsStore = useProblemsStore();
const uiStore = useUiStore();

// Section dropdown toggle
const isDropdownOpen = ref(false);
function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value;
}
function selectSection(section: 'mcq' | 'coding') {
  emit('select-section', section);
  isDropdownOpen.value = false;
}

// Problem counts
const mcqCount = computed(
  () => problemsStore.problems.filter((p) => p.questionType === 'mcq').length,
);
const codingCount = computed(
  () =>
    problemsStore.problems.filter((p) => p.questionType !== 'mcq').length,
);
const totalSections = computed(() => {
  let count = 0;
  if (mcqCount.value > 0) count++;
  if (codingCount.value > 0) count++;
  return Math.max(count, 1);
});

const currentSectionIndex = computed(() => {
  if (props.activeSection === 'mcq') return 1;
  if (props.activeSection === 'coding') {
    return mcqCount.value > 0 ? 2 : 1;
  }
  return 1;
});

const currentSectionTitle = computed(() => {
  if (props.activeSection === 'mcq') return `MCQs (${mcqCount.value})`;
  if (props.activeSection === 'coding') return `COD (${codingCount.value})`;
  return mcqCount.value > 0
    ? `MCQs (${mcqCount.value})`
    : `COD (${codingCount.value})`;
});

const studentName = computed(() => {
  if (!authStore.user) return 'Student';
  return (
    `${authStore.user.firstName || ''} ${authStore.user.lastName || ''}`.trim() ||
    authStore.user.email.split('@')[0]
  );
});

const studentRoll = computed(() => {
  if (!authStore.user) return '---';
  return (
    authStore.user.rollNumber ||
    (authStore.user.metadata?.rollNumber as string) ||
    String(authStore.user.id).padStart(6, '0')
  );
});

const examTitle = computed(() => {
  return examStore.activeExam?.title || 'Online Assessment';
});
</script>

<template>
  <div class="flex flex-col select-none flex-shrink-0 z-30">
    <!-- ── Main Header ───────────────────────────────────────────── -->
    <header
      class="h-14 px-4 bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm relative"
    >
      <!-- Left side: Exam pill + Section switcher -->
      <div class="flex items-center gap-3 min-w-0">
        <!-- Exam title pill -->
        <div
          class="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[200px] truncate"
          :title="examTitle"
        >
          {{ examTitle }}
        </div>

        <!-- Section Selector Dropdown -->
        <div class="relative">
          <button
            type="button"
            class="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-2xs cursor-pointer"
            @click="toggleDropdown"
          >
            <span>Section {{ currentSectionIndex }}/{{ totalSections }}</span>
            <span class="text-slate-300 dark:text-slate-600">|</span>
            <span class="font-semibold text-slate-900 dark:text-white">{{
              currentSectionTitle
            }}</span>
            <span
              class="material-symbols-outlined text-[16px] text-slate-500 transition-transform duration-200"
              :class="{ 'rotate-180': isDropdownOpen }"
            >
              expand_more
            </span>
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="isDropdownOpen"
            class="absolute left-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              v-if="mcqCount > 0"
              class="w-full px-3.5 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
              :class="
                activeSection === 'mcq'
                  ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/50 dark:bg-blue-950/30'
                  : 'text-slate-700 dark:text-slate-200'
              "
              @click="selectSection('mcq')"
            >
              <span>Section 1 / {{ totalSections }} | 1. MCQs</span>
              <span class="text-slate-400 text-[11px]">({{ mcqCount }})</span>
            </button>

            <button
              v-if="codingCount > 0"
              class="w-full px-3.5 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
              :class="
                activeSection === 'coding'
                  ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/50 dark:bg-blue-950/30'
                  : 'text-slate-700 dark:text-slate-200'
              "
              @click="selectSection('coding')"
            >
              <span
                >Section {{ mcqCount > 0 ? '2' : '1' }} / {{ totalSections }} |
                {{ mcqCount > 0 ? '2.' : '1.' }} Coding</span
              >
              <span class="text-slate-400 text-[11px]">({{ codingCount }})</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Middle: Student Details Card -->
      <div
        class="hidden md:flex items-center gap-4 px-3.5 py-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-md text-xs text-slate-600 dark:text-slate-300"
      >
        <div class="flex items-center gap-1.5">
          <span class="text-slate-400 dark:text-slate-500">Name :</span>
          <span class="font-semibold text-slate-800 dark:text-slate-100">{{
            studentName
          }}</span>
        </div>
        <div class="h-3 w-px bg-slate-200 dark:bg-slate-700" />
        <div class="flex items-center gap-1.5">
          <span class="text-slate-400 dark:text-slate-500">Roll Number :</span>
          <span class="font-mono font-bold text-slate-900 dark:text-white">{{
            studentRoll
          }}</span>
        </div>
        <span
          class="material-symbols-outlined text-[16px] text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200"
        >
          chevron_right
        </span>
      </div>

      <!-- Right: Accessibility + Timer + Submit Test Button -->
      <div class="flex items-center gap-3">
        <!-- Text Zoom / Accessibility Controls -->
        <div
          class="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-md p-0.5 select-none"
          title="Adjust Text Size / Zoom"
        >
          <button
            type="button"
            class="w-6 h-6 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-30 cursor-pointer text-[10px] font-black"
            :disabled="uiStore.textScale <= 85"
            title="Decrease Font Size (A-)"
            @click="uiStore.decreaseTextSize()"
          >
            A-
          </button>
          <button
            type="button"
            class="px-1.5 h-6 flex items-center justify-center text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors cursor-pointer"
            title="Reset Font Size to 100%"
            @click="uiStore.resetTextSize()"
          >
            {{ uiStore.textScale }}%
          </button>
          <button
            type="button"
            class="w-6 h-6 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-30 cursor-pointer text-[12px] font-black"
            :disabled="uiStore.textScale >= 145"
            title="Increase Font Size (A+)"
            @click="uiStore.increaseTextSize()"
          >
            A+
          </button>
        </div>

        <!-- Live Countdown Timer -->
        <div
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs font-bold transition-all shadow-2xs"
          :class="[
            isTimerCritical
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse'
              : isTimerWarning
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                : 'bg-[#e0f2fe] text-[#0284c7] dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
          ]"
        >
          <span class="material-symbols-outlined text-[16px]">schedule</span>
          <span>{{ remainingTime }}</span>
        </div>

        <!-- Submit Test Button -->
        <button
          type="button"
          class="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-md shadow-sm transition-all duration-150 cursor-pointer flex items-center gap-1.5"
          @click="emit('submit-test')"
        >
          Submit Test
        </button>
      </div>
    </header>
  </div>
</template>
