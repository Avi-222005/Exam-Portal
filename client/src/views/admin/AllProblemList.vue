<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  listAllProblems,
  deleteProblem,
  deleteProblemsBulk,
  listExams,
} from '../../services/adminApi';
import type { ExamWithProblems } from '../../types/admin';
import ConfirmModal from '../../components/shared/ConfirmModal.vue';
import TablePagination from '../../components/shared/TablePagination.vue';
import RegalButton from '../../components/admin/RegalButton.vue';

interface ProblemItem {
  id: number;
  title: string;
  description?: string;
  questionType?: 'coding' | 'mcq';
  displayOrder: number;
  difficulty: string;
  timeLimitMs?: number;
  memoryLimitKb?: number;
  maxScore: number;
  examId?: number | null;
  examTitle?: string | null;
  exams?: Array<{ id: number; title: string; displayOrder: number }>;
  testCases?: unknown[];
}

const router = useRouter();

// ── State ─────────────────────────────────────────────────────────────────────
const allProblems = ref<ProblemItem[]>([]);
const exams = ref<ExamWithProblems[]>([]);
const loading = ref(false);
const error = ref('');

// ── Filters & Controls ────────────────────────────────────────────────────────
const search = ref('');
const selectedExamFilter = ref<string>('all'); // 'all' | 'unassigned' | string(id)
const selectedTypeFilter = ref<'all' | 'mcq' | 'coding'>('all');
const selectedDifficultyFilter = ref<'all' | 'easy' | 'medium' | 'hard'>('all');
const viewMode = ref<'grouped' | 'table'>('grouped');

// Collapsed state for exam groups
const collapsedGroups = ref<Record<string, boolean>>({});

// ── Selection State ───────────────────────────────────────────────────────────
const selectedProblemIds = ref<number[]>([]);

// ── Pagination for table view ─────────────────────────────────────────────────
const currentPage = ref(1);
const pageSize = ref(20);

// ── Delete Confirmations ───────────────────────────────────────────────────────
const confirmDeleteSingle = ref<ProblemItem | null>(null);
const showBulkDeleteModal = ref(false);
const confirmDeleteGroup = ref<ExamGroup | null>(null);
const showDeleteAllModal = ref(false);
const deleting = ref(false);

// ── Load Data ─────────────────────────────────────────────────────────────────
async function loadData() {
  loading.value = true;
  error.value = '';
  try {
    const [problemsRes, examsRes] = await Promise.all([
      listAllProblems(undefined, { limit: 500, page: 1 }),
      listExams({ limit: 100 }),
    ]);
    allProblems.value = (problemsRes.data as unknown as ProblemItem[]) || [];
    exams.value = examsRes.data || [];
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    error.value = msg || 'Failed to load problems and exams.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadData();
});

// ── Filtered Problems ─────────────────────────────────────────────────────────
const filteredProblems = computed(() => {
  let list = allProblems.value;

  // Search filter
  const q = search.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)),
    );
  }

  // Exam filter
  if (selectedExamFilter.value === 'unassigned') {
    list = list.filter(
      (p) => !p.examId && (!p.exams || p.exams.length === 0),
    );
  } else if (selectedExamFilter.value !== 'all') {
    const targetId = Number(selectedExamFilter.value);
    list = list.filter(
      (p) =>
        p.examId === targetId ||
        p.exams?.some((e) => e.id === targetId),
    );
  }

  // Question Type filter
  if (selectedTypeFilter.value === 'mcq') {
    list = list.filter((p) => p.questionType === 'mcq');
  } else if (selectedTypeFilter.value === 'coding') {
    list = list.filter((p) => p.questionType !== 'mcq');
  }

  // Difficulty filter
  if (selectedDifficultyFilter.value !== 'all') {
    list = list.filter((p) => p.difficulty === selectedDifficultyFilter.value);
  }

  return list;
});

// ── Grouped by Exam ───────────────────────────────────────────────────────────
interface ExamGroup {
  id: string; // numeric string or 'unassigned'
  numericId: number | null;
  title: string;
  problems: ProblemItem[];
  mcqCount: number;
  codingCount: number;
  totalMarks: number;
}

const groupedByExam = computed<ExamGroup[]>(() => {
  const groupsMap = new Map<string, ExamGroup>();

  // Initialize known exams
  exams.value.forEach((ex) => {
    groupsMap.set(String(ex.id), {
      id: String(ex.id),
      numericId: ex.id,
      title: ex.title,
      problems: [],
      mcqCount: 0,
      codingCount: 0,
      totalMarks: 0,
    });
  });

  // Unassigned group
  const unassignedGroup: ExamGroup = {
    id: 'unassigned',
    numericId: null,
    title: 'Question Bank / Standalone Problems',
    problems: [],
    mcqCount: 0,
    codingCount: 0,
    totalMarks: 0,
  };

  // Populate filtered problems into groups
  filteredProblems.value.forEach((p) => {
    const linkedExams =
      p.exams && p.exams.length > 0
        ? p.exams
        : p.examId
          ? [{ id: p.examId, title: p.examTitle ?? '' }]
          : [];

    if (linkedExams.length === 0) {
      unassignedGroup.problems.push(p);
      if (p.questionType === 'mcq') unassignedGroup.mcqCount++;
      else unassignedGroup.codingCount++;
      unassignedGroup.totalMarks += p.maxScore ?? (p.questionType === 'mcq' ? 1 : 10);
    } else {
      linkedExams.forEach((ex) => {
        let grp = groupsMap.get(String(ex.id));
        if (!grp) {
          grp = {
            id: String(ex.id),
            numericId: ex.id,
            title: ex.title || `Exam #${ex.id}`,
            problems: [],
            mcqCount: 0,
            codingCount: 0,
            totalMarks: 0,
          };
          groupsMap.set(String(ex.id), grp);
        }
        grp.problems.push(p);
        if (p.questionType === 'mcq') grp.mcqCount++;
        else grp.codingCount++;
        grp.totalMarks += p.maxScore ?? (p.questionType === 'mcq' ? 1 : 10);
      });
    }
  });

  // Sort problems in each group by displayOrder
  groupsMap.forEach((grp) => {
    grp.problems.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  });
  unassignedGroup.problems.sort((a, b) => a.id - b.id);

  const result: ExamGroup[] = [];
  groupsMap.forEach((grp) => {
    if (grp.problems.length > 0) result.push(grp);
  });

  if (unassignedGroup.problems.length > 0) {
    result.push(unassignedGroup);
  }

  return result;
});

// ── Table View Paged Problems ─────────────────────────────────────────────────
const paginatedProblems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredProblems.value.slice(start, start + pageSize.value);
});

// ── Selection Methods ─────────────────────────────────────────────────────────
function isSelected(id: number): boolean {
  return selectedProblemIds.value.includes(id);
}

function toggleSelection(id: number) {
  const idx = selectedProblemIds.value.indexOf(id);
  if (idx >= 0) selectedProblemIds.value.splice(idx, 1);
  else selectedProblemIds.value.push(id);
}

function selectAllFiltered() {
  const ids = filteredProblems.value.map((p) => p.id);
  selectedProblemIds.value = Array.from(new Set([...selectedProblemIds.value, ...ids]));
}

function deselectAll() {
  selectedProblemIds.value = [];
}

const isAllFilteredSelected = computed(() => {
  if (filteredProblems.value.length === 0) return false;
  return filteredProblems.value.every((p) => selectedProblemIds.value.includes(p.id));
});

function toggleSelectAllFiltered() {
  if (isAllFilteredSelected.value) {
    const filteredIdSet = new Set(filteredProblems.value.map((p) => p.id));
    selectedProblemIds.value = selectedProblemIds.value.filter((id) => !filteredIdSet.has(id));
  } else {
    selectAllFiltered();
  }
}

function isGroupAllSelected(group: ExamGroup): boolean {
  if (group.problems.length === 0) return false;
  return group.problems.every((p) => selectedProblemIds.value.includes(p.id));
}

function toggleGroupSelection(group: ExamGroup) {
  const groupIds = group.problems.map((p) => p.id);
  if (isGroupAllSelected(group)) {
    const set = new Set(groupIds);
    selectedProblemIds.value = selectedProblemIds.value.filter((id) => !set.has(id));
  } else {
    selectedProblemIds.value = Array.from(new Set([...selectedProblemIds.value, ...groupIds]));
  }
}

// ── Accordion Helpers ─────────────────────────────────────────────────────────
function toggleGroup(groupId: string) {
  collapsedGroups.value[groupId] = !collapsedGroups.value[groupId];
}

function expandAll() {
  collapsedGroups.value = {};
}

function collapseAll() {
  groupedByExam.value.forEach((grp) => {
    collapsedGroups.value[grp.id] = true;
  });
}

// ── Reset Filters ─────────────────────────────────────────────────────────────
function resetFilters() {
  search.value = '';
  selectedExamFilter.value = 'all';
  selectedTypeFilter.value = 'all';
  selectedDifficultyFilter.value = 'all';
}

// ── Delete Actions ─────────────────────────────────────────────────────────────
async function onDeleteSingle() {
  if (!confirmDeleteSingle.value) return;
  const id = confirmDeleteSingle.value.id;
  deleting.value = true;
  try {
    await deleteProblem(id);
    allProblems.value = allProblems.value.filter((p) => p.id !== id);
    selectedProblemIds.value = selectedProblemIds.value.filter((item) => item !== id);
    confirmDeleteSingle.value = null;
  } catch {
    error.value = 'Failed to delete problem.';
    confirmDeleteSingle.value = null;
  } finally {
    deleting.value = false;
  }
}

async function onDeleteBulk() {
  if (selectedProblemIds.value.length === 0) return;
  deleting.value = true;
  try {
    const idsToDelete = [...selectedProblemIds.value];
    await deleteProblemsBulk(idsToDelete);
    const deleteSet = new Set(idsToDelete);
    allProblems.value = allProblems.value.filter((p) => !deleteSet.has(p.id));
    selectedProblemIds.value = [];
    showBulkDeleteModal.value = false;
  } catch {
    error.value = 'Failed to delete selected problems.';
    showBulkDeleteModal.value = false;
  } finally {
    deleting.value = false;
  }
}

async function onDeleteGroup() {
  if (!confirmDeleteGroup.value) return;
  const idsToDelete = confirmDeleteGroup.value.problems.map((p) => p.id);
  if (idsToDelete.length === 0) {
    confirmDeleteGroup.value = null;
    return;
  }
  deleting.value = true;
  try {
    await deleteProblemsBulk(idsToDelete);
    const deleteSet = new Set(idsToDelete);
    allProblems.value = allProblems.value.filter((p) => !deleteSet.has(p.id));
    selectedProblemIds.value = selectedProblemIds.value.filter((id) => !deleteSet.has(id));
    confirmDeleteGroup.value = null;
  } catch {
    error.value = 'Failed to delete questions in section.';
    confirmDeleteGroup.value = null;
  } finally {
    deleting.value = false;
  }
}

async function onDeleteAllFiltered() {
  const idsToDelete = filteredProblems.value.map((p) => p.id);
  if (idsToDelete.length === 0) {
    showDeleteAllModal.value = false;
    return;
  }
  deleting.value = true;
  try {
    await deleteProblemsBulk(idsToDelete);
    const deleteSet = new Set(idsToDelete);
    allProblems.value = allProblems.value.filter((p) => !deleteSet.has(p.id));
    selectedProblemIds.value = [];
    showDeleteAllModal.value = false;
  } catch {
    error.value = 'Failed to delete questions.';
    showDeleteAllModal.value = false;
  } finally {
    deleting.value = false;
  }
}

// ── Styling Helpers ───────────────────────────────────────────────────────────
const difficultyClass: Record<string, string> = {
  easy: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900',
  hard: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-900',
};
</script>

<template>
  <div class="max-w-[1250px] pb-24">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">
            Problems Management
          </h2>
          <span
            class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300"
          >
            {{ filteredProblems.length }} questions
          </span>
        </div>
        <p class="text-xs text-slate-500 mt-1">
          Browse, organize, bulk delete, and manage questions grouped by exam or in unified question bank.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <!-- View Mode Switcher -->
        <div class="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            :class="
              viewMode === 'grouped'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            "
            @click="viewMode = 'grouped'"
          >
            <span class="material-symbols-outlined text-[16px]">folder_copy</span>
            <span>Group by Exam</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            :class="
              viewMode === 'table'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            "
            @click="viewMode = 'table'"
          >
            <span class="material-symbols-outlined text-[16px]">table_rows</span>
            <span>Table View</span>
          </button>
        </div>

        <!-- Delete All Button -->
        <button
          v-if="filteredProblems.length > 0"
          type="button"
          class="px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          title="Delete all matching questions"
          @click="showDeleteAllModal = true"
        >
          <span class="material-symbols-outlined text-[16px]">delete_sweep</span>
          <span>Delete All ({{ filteredProblems.length }})</span>
        </button>

        <RegalButton
          variant="primary"
          @click="router.push({ name: 'admin-all-problem-create' })"
        >
          + Add Problem
        </RegalButton>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs mb-6 flex flex-col gap-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <!-- Search -->
        <div class="relative">
          <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">search</span>
          <input
            v-model="search"
            type="text"
            class="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 outline-hidden transition-colors"
            placeholder="Search questions by title or description…"
          />
        </div>

        <!-- Exam Filter -->
        <div>
          <select
            v-model="selectedExamFilter"
            class="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-hidden transition-colors"
          >
            <option value="all">All Exams (Show All)</option>
            <option value="unassigned">Unassigned / Question Bank</option>
            <option v-for="e in exams" :key="e.id" :value="String(e.id)">
              Exam #{{ e.id }}: {{ e.title }}
            </option>
          </select>
        </div>

        <!-- Question Type Filter -->
        <div>
          <select
            v-model="selectedTypeFilter"
            class="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-hidden transition-colors"
          >
            <option value="all">All Question Types</option>
            <option value="mcq">MCQ Questions Only</option>
            <option value="coding">Coding Problems Only</option>
          </select>
        </div>

        <!-- Difficulty Filter -->
        <div>
          <select
            v-model="selectedDifficultyFilter"
            class="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-hidden transition-colors"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      <!-- Quick Selection Controls & Group Expand/Collapse -->
      <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium select-none">
            <input
              type="checkbox"
              :checked="isAllFilteredSelected"
              class="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              @change="toggleSelectAllFiltered"
            />
            <span>Select All ({{ filteredProblems.length }})</span>
          </label>

          <button
            v-if="selectedProblemIds.length > 0"
            type="button"
            class="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
            @click="deselectAll"
          >
            Deselect All ({{ selectedProblemIds.length }} selected)
          </button>
        </div>

        <div v-if="viewMode === 'grouped'" class="flex items-center gap-2">
          <button
            type="button"
            class="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            @click="expandAll"
          >
            Expand All
          </button>
          <span class="text-slate-300 dark:text-slate-700">•</span>
          <button
            type="button"
            class="text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
            @click="collapseAll"
          >
            Collapse All
          </button>
        </div>
      </div>
    </div>

    <!-- Loading / Error States -->
    <div v-if="loading" class="text-center py-16 text-xs text-slate-400">
      <span class="material-symbols-outlined animate-spin text-[28px] text-blue-500 block mb-2">progress_activity</span>
      Loading problems and exams…
    </div>
    <div v-else-if="error" class="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600">
      {{ error }}
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredProblems.length === 0"
      class="text-center py-16 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8"
    >
      <span class="material-symbols-outlined text-[40px] text-slate-400 mb-2 block">content_paste_off</span>
      <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200">No questions found</h3>
      <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto">
        No questions matched your search query or selected filters. Try changing or clearing your filters.
      </p>
      <button
        type="button"
        class="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
        @click="resetFilters"
      >
        Reset Filters
      </button>
    </div>

    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <!-- VIEW 1: GROUPED BY EXAM (ACCORDION CARDS)                                 -->
    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <div v-else-if="viewMode === 'grouped'" class="flex flex-col gap-4">
      <div
        v-for="group in groupedByExam"
        :key="group.id"
        class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all"
      >
        <!-- Group Header (Accordion Trigger) -->
        <div
          class="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors select-none"
          @click="toggleGroup(group.id)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <!-- Group Checkbox -->
            <input
              type="checkbox"
              :checked="isGroupAllSelected(group)"
              class="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer flex-shrink-0"
              title="Select all questions in this exam section"
              @click.stop="toggleGroupSelection(group)"
            />

            <span
              class="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-transform"
              :class="
                group.numericId
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
              "
            >
              <span class="material-symbols-outlined text-[18px]">
                {{ group.numericId ? 'quiz' : 'inventory_2' }}
              </span>
            </span>

            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {{ group.title }}
                </h3>
                <span
                  v-if="group.numericId"
                  class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500"
                >
                  #{{ group.numericId }}
                </span>
                <span
                  v-else
                  class="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-semibold"
                >
                  Question Bank
                </span>
              </div>
              <div class="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <span><strong>{{ group.problems.length }}</strong> Questions</span>
                <span>•</span>
                <span>{{ group.mcqCount }} MCQs</span>
                <span>•</span>
                <span>{{ group.codingCount }} Coding</span>
                <span>•</span>
                <span class="font-bold text-blue-600 dark:text-blue-400">{{ group.totalMarks }} Marks</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2.5 flex-shrink-0" @click.stop>
            <!-- Delete All in Group Button -->
            <button
              type="button"
              class="text-xs font-semibold text-red-500 hover:text-red-700 dark:hover:text-red-400 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-950 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex items-center gap-1 cursor-pointer"
              title="Delete all questions in this section"
              @click="confirmDeleteGroup = group"
            >
              <span class="material-symbols-outlined text-[14px]">delete</span>
              <span class="hidden sm:inline">Delete Section Questions</span>
            </button>

            <button
              v-if="group.numericId"
              type="button"
              class="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              @click="router.push({ name: 'admin-exam-edit', params: { id: group.numericId } })"
            >
              <span class="material-symbols-outlined text-[14px]">edit_note</span>
              <span>Edit Exam Studio</span>
            </button>

            <button
              type="button"
              class="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              @click="toggleGroup(group.id)"
            >
              <span
                class="material-symbols-outlined text-[20px] transition-transform duration-200"
                :class="collapsedGroups[group.id] ? '-rotate-90' : 'rotate-0'"
              >
                expand_more
              </span>
            </button>
          </div>
        </div>

        <!-- Group Question Items -->
        <div
          v-if="!collapsedGroups[group.id]"
          class="border-t border-slate-100 dark:border-slate-800/80 divide-y divide-slate-100 dark:divide-slate-800/60"
        >
          <div
            v-for="(p, pIdx) in group.problems"
            :key="p.id"
            class="p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors cursor-pointer"
            :class="isSelected(p.id) ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''"
            @click="toggleSelection(p.id)"
          >
            <div class="flex items-center gap-3 min-w-0">
              <!-- Item Checkbox -->
              <input
                type="checkbox"
                :checked="isSelected(p.id)"
                class="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer flex-shrink-0"
                @click.stop="toggleSelection(p.id)"
              />

              <span class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {{ pIdx + 1 }}
              </span>

              <span
                class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                :class="
                  p.questionType === 'mcq'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                "
              >
                {{ p.questionType === 'mcq' ? 'MCQ' : 'Coding' }}
              </span>

              <div class="min-w-0">
                <span class="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                  {{ p.title }}
                </span>
                <span v-if="p.description" class="text-[11px] text-slate-400 line-clamp-1">
                  {{ p.description }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2.5 flex-shrink-0" @click.stop>
              <span
                class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border"
                :class="difficultyClass[p.difficulty] ?? 'bg-slate-100 text-slate-700'"
              >
                {{ p.difficulty }}
              </span>

              <span class="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 min-w-[50px] text-right">
                {{ p.maxScore ?? (p.questionType === 'mcq' ? 1 : 10) }} pts
              </span>

              <button
                type="button"
                class="px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                @click="router.push({ name: 'admin-all-problem-edit', params: { id: p.id } })"
              >
                Edit
              </button>

              <button
                type="button"
                class="w-7 h-7 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                title="Delete problem"
                @click="confirmDeleteSingle = p"
              >
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <!-- VIEW 2: FLAT TABLE VIEW                                                   -->
    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <div v-else class="flex flex-col gap-4">
      <div class="overflow-x-auto border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <th class="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  :checked="isAllFilteredSelected"
                  class="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  @change="toggleSelectAllFiltered"
                />
              </th>
              <th class="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">#</th>
              <th class="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">Title & Description</th>
              <th class="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">Type</th>
              <th class="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">Assigned Exam</th>
              <th class="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">Difficulty</th>
              <th class="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">Score</th>
              <th class="px-4 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-[11px]">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="(p, idx) in paginatedProblems"
              :key="p.id"
              class="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
              :class="isSelected(p.id) ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''"
              @click="toggleSelection(p.id)"
            >
              <td class="px-4 py-3" @click.stop>
                <input
                  type="checkbox"
                  :checked="isSelected(p.id)"
                  class="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  @change="toggleSelection(p.id)"
                />
              </td>

              <td class="px-4 py-3 text-slate-400 font-mono text-[11px]">
                {{ (currentPage - 1) * pageSize + idx + 1 }}
              </td>

              <td class="px-4 py-3 min-w-[240px]">
                <span class="font-bold text-slate-900 dark:text-white block">
                  {{ p.title }}
                </span>
                <span v-if="p.description" class="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                  {{ p.description }}
                </span>
              </td>

              <td class="px-4 py-3">
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                  :class="
                    p.questionType === 'mcq'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  "
                >
                  {{ p.questionType === 'mcq' ? 'MCQ' : 'Coding' }}
                </span>
              </td>

              <td class="px-4 py-3">
                <span
                  v-if="p.examTitle || (p.exams && p.exams.length > 0)"
                  class="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 rounded-lg px-2.5 py-1"
                >
                  <span class="material-symbols-outlined text-[13px]">quiz</span>
                  <span>{{ p.examTitle || p.exams?.[0]?.title }}</span>
                </span>
                <span v-else class="text-[11px] text-slate-400 italic">
                  Unassigned
                </span>
              </td>

              <td class="px-4 py-3">
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border"
                  :class="difficultyClass[p.difficulty] ?? 'bg-slate-100 text-slate-700'"
                >
                  {{ p.difficulty }}
                </span>
              </td>

              <td class="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                {{ p.maxScore ?? (p.questionType === 'mcq' ? 1 : 10) }} pts
              </td>

              <td class="px-4 py-3 text-right" @click.stop>
                <div class="flex items-center justify-end gap-1.5">
                  <RegalButton
                    size="sm"
                    @click="router.push({ name: 'admin-all-problem-edit', params: { id: p.id } })"
                  >
                    Edit
                  </RegalButton>
                  <RegalButton
                    size="sm"
                    variant="danger"
                    @click="confirmDeleteSingle = p"
                  >
                    Delete
                  </RegalButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination for Table View -->
      <div v-if="filteredProblems.length > pageSize" class="flex items-center justify-between pt-2">
        <span class="text-xs text-slate-500">
          Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, filteredProblems.length) }} of {{ filteredProblems.length }} questions
        </span>
        <TablePagination
          :page="currentPage"
          :limit="pageSize"
          :total="filteredProblems.length"
          @update:page="currentPage = $event"
        />
      </div>
    </div>

    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <!-- FLOATING BULK ACTIONS BAR                                                 -->
    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <div
      v-if="selectedProblemIds.length > 0"
      class="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 dark:bg-slate-800 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
        <span class="text-xs font-bold">{{ selectedProblemIds.length }} questions selected</span>
      </div>

      <div class="h-4 w-px bg-slate-700" />

      <button
        type="button"
        class="text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
        @click="deselectAll"
      >
        Clear Selection
      </button>

      <button
        type="button"
        class="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
        @click="showBulkDeleteModal = true"
      >
        <span class="material-symbols-outlined text-[16px]">delete</span>
        <span>Delete Selected ({{ selectedProblemIds.length }})</span>
      </button>
    </div>

    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <!-- CONFIRMATION MODALS                                                       -->
    <!-- ═════════════════════════════════════════════════════════════════════════ -->
    <!-- Single Problem Delete -->
    <ConfirmModal
      v-if="confirmDeleteSingle"
      title="Delete Problem"
      :message="`Are you sure you want to delete '${confirmDeleteSingle.title}'? This action cannot be undone.`"
      confirm-text="Delete"
      :loading="deleting"
      @confirm="onDeleteSingle"
      @cancel="confirmDeleteSingle = null"
    />

    <!-- Multiple Selected Bulk Delete -->
    <ConfirmModal
      v-if="showBulkDeleteModal"
      title="Delete Selected Questions"
      :message="`Are you sure you want to permanently delete ${selectedProblemIds.length} selected question(s)? All student submissions and links associated with these questions will be removed.`"
      confirm-text="Delete Selected"
      :loading="deleting"
      @confirm="onDeleteBulk"
      @cancel="showBulkDeleteModal = false"
    />

    <!-- Delete Section Group -->
    <ConfirmModal
      v-if="confirmDeleteGroup"
      title="Delete Section Questions"
      :message="`Are you sure you want to delete all ${confirmDeleteGroup.problems.length} question(s) in '${confirmDeleteGroup.title}'? This action cannot be undone.`"
      confirm-text="Delete All in Section"
      :loading="deleting"
      @confirm="onDeleteGroup"
      @cancel="confirmDeleteGroup = null"
    />

    <!-- Delete All Filtered -->
    <ConfirmModal
      v-if="showDeleteAllModal"
      title="Delete All Questions"
      :message="`Are you sure you want to permanently delete all ${filteredProblems.length} matching question(s)? This will wipe all selected questions from exams and question bank.`"
      confirm-text="Delete All"
      :loading="deleting"
      @confirm="onDeleteAllFiltered"
      @cancel="showDeleteAllModal = false"
    />
  </div>
</template>
