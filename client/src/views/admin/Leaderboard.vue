<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getLeaderboard,
  getLeaderboardLive,
  refreshLeaderboard,
  getExam,
  listExams,
} from '../../services/adminApi';
import UserExamDetailModal from '../../components/admin/UserExamDetailModal.vue';
import RegalButton from '../../components/admin/RegalButton.vue';
import type { LeaderboardEntry, ExamWithProblems } from '../../types/admin';
import type { Problem } from '../../types';

interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number;
  isTied: boolean;
}

const route = useRoute();
const router = useRouter();

const currentExamId = ref<number | null>(
  route.params.examId ? parseInt(String(route.params.examId), 10) : null,
);

const examsList = ref<ExamWithProblems[]>([]);
const entries = ref<LeaderboardEntry[]>([]);
const problems = ref<Problem[]>([]);
const examTitle = ref('');
const isExamActive = ref(false);
const loading = ref(true);
const refreshing = ref(false);
const error = ref('');
const lastRefreshed = ref<Date | null>(null);
const qaFilterOnly = ref(false);
const searchQuery = ref('');
const rankFilter = ref<'all' | 'top10' | 'top3'>('all');

let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
const selectedEntry = ref<LeaderboardEntry | null>(null);

function openUserDetail(entry: LeaderboardEntry) {
  selectedEntry.value = entry;
}

function closeUserDetail() {
  selectedEntry.value = null;
}

// ── Dynamic problem columns from the exam data ────────────────────────────
const problemColumns = computed(() => {
  if (problems.value.length > 0) {
    return [...problems.value].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }
  if (entries.value.length === 0) return [];
  const keys = Object.keys(entries.value[0].problemScores || {});
  return keys.map((k, idx) => ({
    id: parseInt(k, 10),
    title: `Q${idx + 1}`,
    maxScore: 100,
    displayOrder: idx,
  })) as Problem[];
});

// ── 5-Tier Deterministic Competition Ranking ──────────────────────────────
const rankedEntries = computed<RankedLeaderboardEntry[]>(() => {
  // Sort by:
  // 1. totalScore DESC
  // 2. solvedCount DESC
  // 3. totalPenaltyTime ASC
  // 4. lastSolvedAt ASC
  // 5. rollNumber ASC
  const sorted = [...entries.value].sort((a, b) => {
    const aScore = Number(a.totalScore) || 0;
    const bScore = Number(b.totalScore) || 0;
    if (bScore !== aScore) return bScore - aScore;

    if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;

    const aPenalty = Number(a.totalPenaltyTime) || 0;
    const bPenalty = Number(b.totalPenaltyTime) || 0;
    if (Math.abs(aPenalty - bPenalty) > 0.001) return aPenalty - bPenalty;

    const aTime = a.lastSolvedAt ? new Date(a.lastSolvedAt).getTime() : Infinity;
    const bTime = b.lastSolvedAt ? new Date(b.lastSolvedAt).getTime() : Infinity;
    if (aTime !== bTime) return aTime - bTime;

    return (a.rollNumber || '').localeCompare(b.rollNumber || '');
  });

  const result: RankedLeaderboardEntry[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      const isSameScore = Math.abs((Number(prev.totalScore) || 0) - (Number(row.totalScore) || 0)) < 0.001;
      const isSameSolved = prev.solvedCount === row.solvedCount;
      const isSamePenalty = Math.abs((Number(prev.totalPenaltyTime) || 0) - (Number(row.totalPenaltyTime) || 0)) < 0.001;
      const isSameLastSolved =
        (!prev.lastSolvedAt && !row.lastSolvedAt) ||
        (prev.lastSolvedAt &&
          row.lastSolvedAt &&
          new Date(prev.lastSolvedAt).getTime() === new Date(row.lastSolvedAt).getTime());

      if (!isSameScore || !isSameSolved || !isSamePenalty || !isSameLastSolved) {
        currentRank = i + 1;
      }
    }

    result.push({
      ...row,
      rank: currentRank,
      isTied: false,
    });
  }

  // Determine which ranks are tied
  const rankCounts = new Map<number, number>();
  result.forEach((r) => rankCounts.set(r.rank, (rankCounts.get(r.rank) || 0) + 1));
  result.forEach((r) => {
    r.isTied = (rankCounts.get(r.rank) || 0) > 1;
  });

  return result;
});

// ── Search & Filter ────────────────────────────────────────────────────────
const filteredEntries = computed(() => {
  let list = rankedEntries.value;

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(
      (r) =>
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
        (r.rollNumber || '').toLowerCase().includes(q),
    );
  }

  if (rankFilter.value === 'top10') {
    list = list.filter((r) => r.rank <= 10);
  } else if (rankFilter.value === 'top3') {
    list = list.filter((r) => r.rank <= 3);
  }

  return list;
});

// ── Quick Summary Metrics ──────────────────────────────────────────────────
const totalSolvedAll = computed(() =>
  entries.value.reduce((acc, curr) => acc + (curr.solvedCount || 0), 0),
);

const averageScore = computed(() => {
  if (entries.value.length === 0) return '0';
  const sum = entries.value.reduce((acc, curr) => acc + (Number(curr.totalScore) || 0), 0);
  return (sum / entries.value.length).toFixed(1);
});

const topWinner = computed(() => {
  return rankedEntries.value.length > 0 ? rankedEntries.value[0] : null;
});

// ── Data Fetching ──────────────────────────────────────────────────────────
async function loadExamsList() {
  try {
    const res = await listExams({ limit: 100 });
    examsList.value = res.data || [];
    if (!currentExamId.value && examsList.value.length > 0) {
      // Pick first active or latest exam
      const active = examsList.value.find((e) => e.isActive);
      currentExamId.value = active ? active.id : examsList.value[0].id;
    }
  } catch (err) {
    console.warn('Failed to load exams list:', err);
  }
}

async function loadLeaderboardData(silent = false) {
  if (!currentExamId.value) return;
  if (!silent) loading.value = true;
  error.value = '';

  try {
    const examId = currentExamId.value;
    const qaOpts = qaFilterOnly.value ? { qaRoleOptIn: true } : undefined;
    const [lb, exam] = await Promise.all([
      getLeaderboard(examId, qaOpts),
      getExam(examId),
    ]);

    // Fallback to live query for inactive exams with no materialized data
    entries.value =
      lb.length > 0 || exam.isActive
        ? lb
        : await getLeaderboardLive(examId, qaOpts);

    problems.value = (exam.problems as unknown as Problem[]) || [];
    examTitle.value = exam.title;
    isExamActive.value = !!exam.isActive;
    lastRefreshed.value = new Date();
  } catch (err: unknown) {
    error.value = 'Failed to load leaderboard for this exam.';
  } finally {
    loading.value = false;
  }
}

function onExamSelectChange() {
  if (currentExamId.value) {
    void router.replace({ name: 'admin-leaderboard', params: { examId: currentExamId.value } });
    void loadLeaderboardData();
  }
}

async function manualRefresh() {
  if (!currentExamId.value) return;
  refreshing.value = true;
  try {
    await refreshLeaderboard(currentExamId.value);
    await loadLeaderboardData(true);
  } finally {
    refreshing.value = false;
  }
}



function formatPenalty(mins: number) {
  const totalMins = Math.round(Number(mins) || 0);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function exportCsv() {
  const cols = problemColumns.value;
  const headers = [
    'Rank',
    'Roll Number',
    'Name',
    'Solved',
    'Score',
    'Penalty (min)',
    ...cols.map((p, idx) => `Q${(p.displayOrder ?? idx) + 1}: ${p.title}`),
  ];

  const rows = rankedEntries.value.map((entry) => [
    entry.rank,
    entry.rollNumber,
    `${entry.firstName} ${entry.lastName}`,
    entry.solvedCount,
    entry.totalScore,
    Number(entry.totalPenaltyTime).toFixed(1),
    ...cols.map((p) => {
      const s = entry.problemScores?.[String(p.id)];
      return s?.solved ? s.score : 0;
    }),
  ]);

  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `leaderboard-${examTitle.value.replace(/\s+/g, '-')}-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toggleQaFilter() {
  qaFilterOnly.value = !qaFilterOnly.value;
  void loadLeaderboardData();
}

async function exportQaReport() {
  if (!currentExamId.value) return;
  let qaEntries: LeaderboardEntry[];
  try {
    const qaOpts = { qaRoleOptIn: true };
    qaEntries = await getLeaderboard(currentExamId.value, qaOpts);
    if (qaEntries.length === 0) {
      qaEntries = await getLeaderboardLive(currentExamId.value, qaOpts);
    }
  } catch {
    return;
  }

  const cols = problemColumns.value;
  const headers = [
    'Rank',
    'Roll Number',
    'Name',
    'Solved',
    'Score',
    'Penalty (min)',
    ...cols.map((p, idx) => `Q${(p.displayOrder ?? idx) + 1}: ${p.title}`),
  ];

  const sorted = [...qaEntries].sort((a, b) => {
    const aScore = Number(a.totalScore) || 0;
    const bScore = Number(b.totalScore) || 0;
    if (bScore !== aScore) return bScore - aScore;
    if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
    return (Number(a.totalPenaltyTime) || 0) - (Number(b.totalPenaltyTime) || 0);
  });

  const rows = sorted.map((entry, i) => [
    i + 1,
    entry.rollNumber,
    `${entry.firstName} ${entry.lastName}`,
    entry.solvedCount,
    entry.totalScore,
    Number(entry.totalPenaltyTime).toFixed(1),
    ...cols.map((p) => {
      const s = entry.problemScores?.[String(p.id)];
      return s?.solved ? s.score : 0;
    }),
  ]);

  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `qa-leaderboard-${examTitle.value.replace(/\s+/g, '-')}-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

onMounted(async () => {
  await loadExamsList();
  await loadLeaderboardData();
  autoRefreshTimer = setInterval(() => void loadLeaderboardData(true), 15_000);
});

onUnmounted(() => {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
});

watch(
  () => route.params.examId,
  (newId) => {
    if (newId) {
      currentExamId.value = parseInt(String(newId), 10);
      void loadLeaderboardData();
    }
  },
);
</script>

<template>
  <div class="space-y-6 max-w-[1400px]">
    <!-- ── Top Header & Controls ────────────────────────────────────── -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Contest Leaderboard
          </h2>
          <span
            v-if="isExamActive"
            class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            Live Contest
          </span>
          <span
            v-else-if="examTitle"
            class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
          >
            Closed / Archived
          </span>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Real-time competition ranking, points, and metrics. Click on any student row to view full question responses, test runs, and code.
        </p>
      </div>

      <!-- Action Buttons & Dropdowns -->
      <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
        <!-- Exam Switcher -->
        <div class="relative min-w-[190px]">
          <select
            v-model="currentExamId"
            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary cursor-pointer font-semibold shadow-sm pr-8"
            @change="onExamSelectChange"
          >
            <option v-for="e in examsList" :key="e.id" :value="e.id">
              {{ e.title }} {{ e.isActive ? '🟢 (Live)' : '⚪ (Ended)' }}
            </option>
          </select>
        </div>

        <RegalButton size="xs" :disabled="refreshing" @click="manualRefresh">
          <span class="material-symbols-outlined text-[15px]" :class="{ 'animate-spin': refreshing }">refresh</span>
          <span class="whitespace-nowrap">Refresh</span>
        </RegalButton>

        <button
          class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap flex-nowrap shrink-0 inline-flex items-center"
          :class="
            qaFilterOnly
              ? 'bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-purple-400'
          "
          title="Filter for candidates who opted into QA Track"
          @click="toggleQaFilter"
        >
          QA Track Only
        </button>

        <RegalButton
          variant="primary"
          size="xs"
          :disabled="entries.length === 0"
          @click="exportCsv"
        >
          <span class="material-symbols-outlined text-[15px]">download</span>
          <span class="whitespace-nowrap">Export CSV</span>
        </RegalButton>

        <RegalButton
          size="xs"
          :disabled="entries.length === 0"
          @click="exportQaReport"
        >
          <span class="whitespace-nowrap">QA Report</span>
        </RegalButton>
      </div>
    </div>

    <!-- ── Top Metrics Hero Banner ──────────────────────────────────── -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="stat-card">
        <div class="flex items-center gap-3">
          <div class="stat-icon bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[20px]">groups</span>
          </div>
          <div>
            <span class="text-[10px] uppercase font-bold text-slate-400">Total Contestants</span>
            <h4 class="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">{{ entries.length }}</h4>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center gap-3">
          <div class="stat-icon bg-emerald-500/10 text-emerald-500">
            <span class="material-symbols-outlined text-[20px]">check_circle</span>
          </div>
          <div>
            <span class="text-[10px] uppercase font-bold text-slate-400">Total Solved</span>
            <h4 class="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{{ totalSolvedAll }}</h4>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center gap-3">
          <div class="stat-icon bg-sky-500/10 text-sky-500">
            <span class="material-symbols-outlined text-[20px]">analytics</span>
          </div>
          <div>
            <span class="text-[10px] uppercase font-bold text-slate-400">Average Score</span>
            <h4 class="text-xl font-black text-sky-600 dark:text-sky-400 font-mono">{{ averageScore }} pts</h4>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center gap-3">
          <div class="stat-icon bg-amber-500/10 text-amber-500">
            <span class="material-symbols-outlined text-[20px]">emoji_events</span>
          </div>
          <div class="truncate">
            <span class="text-[10px] uppercase font-bold text-slate-400">Current Leader</span>
            <h4 class="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
              {{ topWinner ? `${topWinner.firstName} ${topWinner.lastName}` : 'No submissions' }}
            </h4>
            <span v-if="topWinner" class="text-[10px] text-amber-500 font-mono font-bold">
              {{ topWinner.totalScore }} pts · {{ topWinner.solvedCount }} solved
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Filter & Search Controls ────────────────────────────────── -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          class="chip-btn whitespace-nowrap"
          :class="{ 'chip-btn--active': rankFilter === 'all' }"
          @click="rankFilter = 'all'"
        >
          All Participants ({{ rankedEntries.length }})
        </button>
        <button
          type="button"
          class="chip-btn whitespace-nowrap"
          :class="{ 'chip-btn--active': rankFilter === 'top10' }"
          @click="rankFilter = 'top10'"
        >
          Top 10
        </button>
        <button
          type="button"
          class="chip-btn flex items-center gap-1 whitespace-nowrap"
          :class="{ 'chip-btn--active': rankFilter === 'top3' }"
          @click="rankFilter = 'top3'"
        >
          <span>🏆</span> Podium
        </button>
      </div>

      <div class="relative w-full sm:w-72">
        <span class="material-symbols-outlined text-[16px] text-slate-400 absolute left-3 top-2.5">search</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Filter by participant name or roll..."
          class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
        />
      </div>
    </div>

    <!-- ── Loading / Error State ───────────────────────────────────── -->
    <div v-if="loading" class="p-12 text-center text-slate-400">
      <span class="material-symbols-outlined text-3xl animate-spin text-primary">progress_activity</span>
      <p class="text-xs mt-2 font-medium">Computing live competition standings...</p>
    </div>

    <div v-else-if="error" class="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
      {{ error }}
    </div>

    <!-- ── Empty State ─────────────────────────────────────────────── -->
    <div v-else-if="rankedEntries.length === 0" class="p-12 text-center bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/[0.06] rounded-2xl">
      <span class="material-symbols-outlined text-4xl text-slate-400 mb-2">military_tech</span>
      <h3 class="text-base font-bold text-slate-700 dark:text-slate-300">No submissions recorded yet</h3>
      <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
        As students write and test solutions in the contest workspace, their live standings and problem breakdown will appear here.
      </p>
    </div>

    <!-- ── Clean & Fast Scoreboard Table ─────────────────────────── -->
    <div v-else class="overflow-x-auto bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/[0.06] rounded-2xl shadow-sm">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-white/[0.06] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
          <tr>
            <th class="px-4 py-3 text-center w-16 whitespace-nowrap">Rank</th>
            <th class="px-4 py-3 whitespace-nowrap min-w-[180px]">Participant Name</th>
            <th class="px-4 py-3 font-mono whitespace-nowrap min-w-[140px]">Roll Number</th>
            <th class="px-4 py-3 text-center whitespace-nowrap min-w-[120px]">Problems Solved</th>
            <th class="px-4 py-3 text-right whitespace-nowrap min-w-[110px]">Total Score</th>
            <th class="px-4 py-3 text-right whitespace-nowrap min-w-[110px]">Penalty Time</th>
            <th class="px-4 py-3 text-center w-36 whitespace-nowrap">Details</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-white/[0.04] text-slate-700 dark:text-slate-300">
          <tr
            v-for="entry in filteredEntries"
            :key="entry.userId"
            class="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
            title="Click to view detailed submission log & code for this student"
            @click="openUserDetail(entry)"
          >
            <!-- Rank -->
            <td class="px-4 py-3.5 text-center font-bold whitespace-nowrap">
              <div class="flex items-center justify-center gap-1">
                <span v-if="entry.rank === 1" class="text-amber-500 text-sm">🥇 1</span>
                <span v-else-if="entry.rank === 2" class="text-slate-400 text-sm">🥈 2</span>
                <span v-else-if="entry.rank === 3" class="text-amber-600 text-sm">🥉 3</span>
                <span v-else class="text-slate-500 font-mono">{{ entry.rank }}</span>
                <span v-if="entry.isTied" class="text-[9px] text-amber-500 font-bold" title="Tied rank with identical score & penalty">=</span>
              </div>
            </td>

            <!-- Name -->
            <td class="px-4 py-3.5 text-slate-900 dark:text-slate-100 font-bold whitespace-nowrap">
              <span>{{ entry.firstName }} {{ entry.lastName }}</span>
            </td>

            <!-- Roll -->
            <td class="px-4 py-3.5 font-mono text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
              {{ entry.rollNumber }}
            </td>

            <!-- Solved Count -->
            <td class="px-4 py-3.5 text-center font-bold text-sky-600 dark:text-sky-400 font-mono text-xs whitespace-nowrap">
              {{ entry.solvedCount }} <span v-if="problems.length" class="text-slate-400 font-normal">/ {{ problems.length }}</span>
            </td>

            <!-- Score -->
            <td class="px-4 py-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">
              {{ entry.totalScore }} pts
            </td>

            <!-- Penalty -->
            <td class="px-4 py-3.5 text-right font-mono text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
              {{ formatPenalty(entry.totalPenaltyTime) }}
            </td>

            <!-- Details Action -->
            <td class="px-4 py-3.5 text-center whitespace-nowrap">
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 group-hover:bg-primary group-hover:text-white transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap flex-nowrap shrink-0"
                @click.stop="openUserDetail(entry)"
              >
                <span class="whitespace-nowrap">View Details</span>
                <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Student Detail Modal -->
    <UserExamDetailModal
      v-if="selectedEntry && currentExamId"
      :user-id="selectedEntry.userId"
      :exam-id="currentExamId"
      :entry="selectedEntry"
      @close="closeUserDetail"
    />
  </div>
</template>

<style scoped>
.stat-card {
  @apply bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-4 shadow-sm;
}

.stat-icon {
  @apply w-10 h-10 rounded-xl flex items-center justify-center;
}

.chip-btn {
  @apply px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] text-xs font-medium text-slate-600 dark:text-slate-400
         hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer;
}

.chip-btn--active {
  @apply bg-primary/15 border-primary/40 text-primary font-bold;
}
</style>
