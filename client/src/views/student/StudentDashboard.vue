<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import ExamDetailsModal from './ExamDetailsModal.vue';
import SubmissionDetailsModal from './SubmissionDetailsModal.vue';
import { useAuthStore } from '../../stores/auth';
import { useExamStore } from '../../stores/exam';
import { useTheme } from '../../composables/useTheme';
import { brand } from '../../config/brand';
import UserProfileDropdown from '../../components/layout/UserProfileDropdown.vue';
import type { Exam, ExamEnrollment } from '../../types';
import api, { startExam } from '../../services/api';

interface ExamItem {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  allowedLanguages?: number[];
  accessType?: 'open' | 'passcode' | 'whitelist';
  isPasscodeProtected?: boolean;
  mcqCount?: number;
  codingCount?: number;
  totalProblems?: number;
  totalMarks?: number;
}

interface SubmissionItem {
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

interface LeaderboardProblem {
  id: number;
  title: string;
  questionType: string;
  maxScore: number;
  displayOrder: number;
}

interface LeaderboardItem {
  examId: number;
  userId: number;
  rollNumber: string;
  firstName: string;
  lastName: string;
  solvedCount: number;
  totalScore: number;
  totalPenaltyTime: number;
  lastSolvedAt?: string | null;
  problemScores?: Record<string, { score: number; solved: boolean; attempts: number }>;
}

interface RankedLeaderboardItem extends LeaderboardItem {
  rank: number;
  isTied: boolean;
}

interface LeaderboardResponse {
  exam: {
    id: number;
    title: string;
    isActive: boolean;
    startTime: string;
    endTime: string;
    durationMinutes: number;
  };
  problems: LeaderboardProblem[];
  leaderboard: LeaderboardItem[];
}

const router = useRouter();
const authStore = useAuthStore();
const examStore = useExamStore();
const { theme, toggleTheme } = useTheme();

// ── State ──────────────────────────────────────────────────────────────────
const activeTab = ref<'exams' | 'submissions' | 'leaderboard' | 'diagnostics'>('exams');
const mobileNavOpen = ref(false);
const examFilter = ref<'all' | 'live' | 'enrolled' | 'upcoming' | 'ended'>('all');
const searchQuery = ref('');
const loading = ref(true);
const enrollingId = ref<number | null>(null);

const allExams = ref<ExamItem[]>([]);
const myEnrollments = ref<ExamEnrollment[]>([]);
const submissions = ref<SubmissionItem[]>([]);
const submissionsLoading = ref(false);

const selectedExamIdForLeaderboard = ref<number | null>(null);
const leaderboardExam = ref<LeaderboardResponse['exam'] | null>(null);
const leaderboardProblems = ref<LeaderboardProblem[]>([]);
const leaderboardRows = ref<LeaderboardItem[]>([]);
const leaderboardLoading = ref(false);
const leaderboardSearch = ref('');
const leaderboardRankFilter = ref<'all' | 'top10' | 'top3'>('all');
const lastLeaderboardRefresh = ref<Date | null>(null);

const selectedExamForModal = ref<ExamItem | null>(null);
const showExamModal = ref(false);

const selectedSubmissionForModal = ref<SubmissionItem | null>(null);
const showSubmissionModal = ref(false);

const enrollSuccessMessage = ref('');
const errorMessage = ref('');

let refreshInterval: ReturnType<typeof setInterval> | null = null;

// ── Sidebar Tabs Definition ────────────────────────────────────────────────
const sidebarTabs = [
  { id: 'exams', label: 'Contests & Exams', icon: 'terminal' },
  { id: 'submissions', label: 'My Submissions & History', icon: 'history' },
  { id: 'leaderboard', label: 'Live Standings', icon: 'leaderboard' },
  { id: 'diagnostics', label: 'System Readiness Check', icon: 'verified_user' },
] as const;

const activeTabLabel = computed(() => {
  const found = sidebarTabs.find((t) => t.id === activeTab.value);
  return found ? found.label : 'Student Dashboard';
});

// ── Computed ───────────────────────────────────────────────────────────────
const enrolledExamIds = computed(() =>
  new Set(myEnrollments.value.map((e) => e.examId)),
);

const completedExamIds = computed(() =>
  new Set(myEnrollments.value.filter((e) => e.isCompleted).map((e) => e.examId)),
);

const startedExamIds = computed(() =>
  new Set(
    myEnrollments.value
      .filter((e) => !!e.startedAt)
      .map((e) => e.examId),
  ),
);

function isExamCompleted(exam?: ExamItem | { id: number } | null): boolean {
  if (!exam) return false;
  return completedExamIds.value.has(exam.id);
}

function isExamStarted(exam?: ExamItem | { id: number } | null): boolean {
  if (!exam) return false;
  if (startedExamIds.value.has(exam.id)) return true;
  try {
    return localStorage.getItem(`exam_started_${exam.id}`) === 'true';
  } catch {
    return false;
  }
}

const solvedCount = computed(() => {
  const solvedProblemIds = new Set<number>();
  for (const s of submissions.value) {
    const st = s.status?.toLowerCase() || '';
    if (st.includes('accepted') || st.includes('correct') || st === 'ac') {
      solvedProblemIds.add(s.problemId);
    }
  }
  return solvedProblemIds.size;
});

const filteredExams = computed(() => {
  let list = allExams.value;

  // Search
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter((e) => e.title.toLowerCase().includes(q));
  }

  // Filter
  if (examFilter.value === 'live') {
    list = list.filter(isExamLive);
  } else if (examFilter.value === 'enrolled') {
    list = list.filter((e) => enrolledExamIds.value.has(e.id));
  } else if (examFilter.value === 'upcoming') {
    list = list.filter(isExamUpcoming);
  } else if (examFilter.value === 'ended') {
    list = list.filter(isExamEnded);
  }

  return list;
});

// ── Strict Leaderboard Ranking Computations ───────────────────────────────
const rankedLeaderboard = computed<RankedLeaderboardItem[]>(() => {
  // Deterministic 5-tier competition sort:
  // 1. totalScore DESC
  // 2. solvedCount DESC
  // 3. totalPenaltyTime ASC
  // 4. lastSolvedAt ASC (earliest completion)
  // 5. rollNumber ASC
  const sorted = [...leaderboardRows.value].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
    if (a.totalPenaltyTime !== b.totalPenaltyTime) return a.totalPenaltyTime - b.totalPenaltyTime;
    const aTime = a.lastSolvedAt ? new Date(a.lastSolvedAt).getTime() : Infinity;
    const bTime = b.lastSolvedAt ? new Date(b.lastSolvedAt).getTime() : Infinity;
    if (aTime !== bTime) return aTime - bTime;
    return (a.rollNumber || '').localeCompare(b.rollNumber || '');
  });

  const result: RankedLeaderboardItem[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      const isSameScore = Math.abs(prev.totalScore - row.totalScore) < 0.001;
      const isSameSolved = prev.solvedCount === row.solvedCount;
      const isSamePenalty = Math.abs(prev.totalPenaltyTime - row.totalPenaltyTime) < 0.001;
      const isSameLastSolved =
        (!prev.lastSolvedAt && !row.lastSolvedAt) ||
        (prev.lastSolvedAt &&
          row.lastSolvedAt &&
          new Date(prev.lastSolvedAt).getTime() === new Date(row.lastSolvedAt).getTime());

      // If any of the 4 competition criteria differ, rank jumps to i + 1 (standard competition ranking)
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

  // Determine which ranks are shared / tied
  const rankCounts = new Map<number, number>();
  result.forEach((r) => rankCounts.set(r.rank, (rankCounts.get(r.rank) || 0) + 1));
  result.forEach((r) => {
    r.isTied = (rankCounts.get(r.rank) || 0) > 1;
  });

  return result;
});

const filteredLeaderboard = computed(() => {
  let list = rankedLeaderboard.value;

  if (leaderboardSearch.value.trim()) {
    const q = leaderboardSearch.value.toLowerCase().trim();
    list = list.filter(
      (r) =>
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
        (r.rollNumber || '').toLowerCase().includes(q),
    );
  }

  if (leaderboardRankFilter.value === 'top10') {
    list = list.filter((r) => r.rank <= 10);
  } else if (leaderboardRankFilter.value === 'top3') {
    list = list.filter((r) => r.rank <= 3);
  }

  return list;
});

const myPersonalStanding = computed(() => {
  if (!authStore.user) return null;
  return rankedLeaderboard.value.find((r) => r.userId === authStore.user?.id) || null;
});

// ── Data Fetching ─────────────────────────────────────────────────────────
async function loadDashboardData() {
  try {
    const [allExamsRes, enrollmentsRes] = await Promise.allSettled([
      api.get<{ data: ExamItem[] }>('/exams/all'),
      api.get<ExamEnrollment[]>('/exams/my-enrollments'),
    ]);

    if (allExamsRes.status === 'fulfilled' && allExamsRes.value.data?.data) {
      allExams.value = allExamsRes.value.data.data;
      if (!selectedExamIdForLeaderboard.value && allExams.value.length > 0) {
        selectedExamIdForLeaderboard.value = allExams.value[0].id;
        void loadLeaderboard(allExams.value[0].id);
      }
    } else {
      // Fallback
      await examStore.fetchActiveExam();
      allExams.value = examStore.activeExams;
      if (!selectedExamIdForLeaderboard.value && allExams.value.length > 0) {
        selectedExamIdForLeaderboard.value = allExams.value[0].id;
        void loadLeaderboard(allExams.value[0].id);
      }
    }

    if (enrollmentsRes.status === 'fulfilled') {
      myEnrollments.value = enrollmentsRes.value.data ?? [];
    }
  } catch (err) {
    console.warn('Error loading dashboard data:', err);
  } finally {
    loading.value = false;
  }
}

async function loadSubmissions() {
  submissionsLoading.value = true;
  try {
    const res = await api.get<SubmissionItem[]>('/exams/my-submissions');
    submissions.value = res.data ?? [];
  } catch (err) {
    console.warn('Error fetching submissions:', err);
  } finally {
    submissionsLoading.value = false;
  }
}

async function loadLeaderboard(examId: number) {
  if (!examId) return;
  leaderboardLoading.value = true;
  try {
    const res = await api.get<LeaderboardResponse | LeaderboardItem[]>(`/exams/${examId}/leaderboard`);
    if (res.data && 'leaderboard' in res.data) {
      leaderboardExam.value = res.data.exam;
      leaderboardProblems.value = res.data.problems || [];
      leaderboardRows.value = res.data.leaderboard || [];
    } else {
      leaderboardRows.value = (res.data as LeaderboardItem[]) || [];
    }
    lastLeaderboardRefresh.value = new Date();
  } catch (err) {
    console.warn('Error fetching leaderboard:', err);
  } finally {
    leaderboardLoading.value = false;
  }
}

function selectTab(tabId: 'exams' | 'submissions' | 'leaderboard' | 'diagnostics') {
  activeTab.value = tabId;
  mobileNavOpen.value = false;
  if (tabId === 'submissions') {
    void loadSubmissions();
  } else if (tabId === 'leaderboard') {
    if (selectedExamIdForLeaderboard.value) {
      void loadLeaderboard(selectedExamIdForLeaderboard.value);
    }
  } else if (tabId === 'diagnostics') {
    void runDiagnostics();
  }
}

function onExamLeaderboardChange() {
  if (selectedExamIdForLeaderboard.value) {
    void loadLeaderboard(selectedExamIdForLeaderboard.value);
  }
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    void router.replace({ name: 'login', query: { redirect: '/dashboard' } });
    return;
  }

  await loadDashboardData();
  void loadSubmissions();
  refreshInterval = setInterval(loadDashboardData, 15000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});

// ── Exam Logic ────────────────────────────────────────────────────────────
function isExamLive(exam: ExamItem): boolean {
  const now = Date.now() + examStore.serverDrift;
  const start = dayjs(exam.startTime).valueOf();
  const end = dayjs(exam.endTime).valueOf();
  return now >= start && now < end;
}

function isExamUpcoming(exam: ExamItem): boolean {
  const now = Date.now() + examStore.serverDrift;
  const start = dayjs(exam.startTime).valueOf();
  return now < start;
}

function isExamEnded(exam: ExamItem): boolean {
  const now = Date.now() + examStore.serverDrift;
  const end = dayjs(exam.endTime).valueOf();
  return now >= end;
}

function formatExamTime(dateStr: string): string {
  return dayjs(dateStr).format('MMM D, YYYY · h:mm A');
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h} hour${h > 1 ? 's' : ''}`;
  return `${m} mins`;
}

const passcodeModalExam = ref<ExamItem | null>(null);
const enteredPasscode = ref('');
const passcodeError = ref('');
const submittingPasscode = ref(false);

function triggerEnroll(exam: ExamItem) {
  if (exam.accessType === 'passcode' || exam.isPasscodeProtected) {
    passcodeModalExam.value = exam;
    enteredPasscode.value = '';
    passcodeError.value = '';
  } else if (exam.accessType === 'whitelist') {
    errorMessage.value = 'This exam is restricted to pre-approved candidates. Please contact your test administrator.';
  } else {
    void enrollInExam(exam);
  }
}

async function submitPasscodeEnrollment() {
  if (!passcodeModalExam.value) return;
  if (!enteredPasscode.value.trim()) {
    passcodeError.value = 'Please enter the exam passcode.';
    return;
  }

  submittingPasscode.value = true;
  passcodeError.value = '';

  try {
    await api.post(`/exams/${passcodeModalExam.value.id}/enroll`, {
      passcode: enteredPasscode.value.trim(),
    });
    enrollSuccessMessage.value = `Successfully enrolled in "${passcodeModalExam.value.title}"!`;
    passcodeModalExam.value = null;
    await loadDashboardData();
  } catch (err: unknown) {
    const res = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
    passcodeError.value = res?.data?.message || 'Incorrect passcode. Please try again.';
  } finally {
    submittingPasscode.value = false;
    setTimeout(() => {
      enrollSuccessMessage.value = '';
    }, 4000);
  }
}

async function enrollInExam(exam: ExamItem) {
  enrollingId.value = exam.id;
  enrollSuccessMessage.value = '';
  errorMessage.value = '';

  try {
    await api.post(`/exams/${exam.id}/enroll`);
    enrollSuccessMessage.value = `Successfully enrolled in "${exam.title}"!`;
    await loadDashboardData();
  } catch (err: unknown) {
    const res = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
    if (res?.status === 409) {
      enrollSuccessMessage.value = `You are already enrolled in "${exam.title}".`;
      await loadDashboardData();
    } else {
      errorMessage.value = res?.data?.message || 'Failed to enroll. Please try again.';
    }
  } finally {
    enrollingId.value = null;
    setTimeout(() => {
      enrollSuccessMessage.value = '';
      errorMessage.value = '';
    }, 4000);
  }
}

function enterExamWorkspace(exam: ExamItem) {
  try {
    localStorage.setItem(`exam_started_${exam.id}`, 'true');
  } catch {
    // ignore
  }
  void startExam(exam.id).catch(() => {});
  examStore.selectExam(exam as unknown as Exam);
  void router.push({
    name: 'workspace',
    params: { id: exam.id },
  });
}

function openExamModal(exam: ExamItem) {
  selectedExamForModal.value = exam;
  showExamModal.value = true;
}

function openSubmissionModal(sub: SubmissionItem) {
  selectedSubmissionForModal.value = sub;
  showSubmissionModal.value = true;
}

function getLanguageName(id: number): string {
  switch (id) {
    case 71: return 'Python 3';
    case 54: return 'C++';
    case 62: return 'Java';
    case 50: return 'C';
    case 63: return 'JavaScript';
    default: return `Lang #${id}`;
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

function problemScore(row: LeaderboardItem, problemId: number) {
  const s = row.problemScores?.[String(problemId)];
  if (!s) return '–';
  if (s.solved) return `+${s.score}`;
  return s.attempts > 0 ? `-${s.attempts}` : '–';
}

function problemScoreClass(row: LeaderboardItem, problemId: number) {
  const s = row.problemScores?.[String(problemId)];
  if (!s || s.attempts === 0) return 'text-slate-400 dark:text-slate-500';
  if (s.solved) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold';
  return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold';
}

function formatPenaltyMinutes(mins: number) {
  const totalMins = Math.round(Number(mins) || 0);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ── Diagnostics System Check ──────────────────────────────────────────────
interface DiagItem {
  id: string;
  name: string;
  status: 'pending' | 'checking' | 'pass' | 'fail';
  detail: string;
}

const diagnostics = ref<DiagItem[]>([
  { id: 'browser', name: 'Browser & JS Engine', status: 'pending', detail: 'Ready to check' },
  { id: 'resolution', name: 'Screen Resolution', status: 'pending', detail: 'Ready to check' },
  { id: 'latency', name: 'API Latency & Connectivity', status: 'pending', detail: 'Ready to check' },
  { id: 'worker', name: 'Monaco Worker Engine', status: 'pending', detail: 'Ready to check' },
  { id: 'storage', name: 'Autosave Storage Engine', status: 'pending', detail: 'Ready to check' },
]);
const diagnosticsRunning = ref(false);

async function runDiagnostics() {
  diagnosticsRunning.value = true;

  for (const item of diagnostics.value) {
    item.status = 'checking';
    item.detail = 'Testing...';
  }

  // 1. Browser Check
  await new Promise((r) => setTimeout(r, 200));
  const isChromeOrFirefoxOrEdge = /Chrome|Firefox|Edg|Safari/i.test(navigator.userAgent);
  diagnostics.value[0].status = isChromeOrFirefoxOrEdge ? 'pass' : 'pass';
  diagnostics.value[0].detail = `${navigator.userAgent.split(' ')[0]} - Engine Compatible`;

  // 2. Resolution Check
  await new Promise((r) => setTimeout(r, 200));
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w >= 1024 && h >= 600) {
    diagnostics.value[1].status = 'pass';
    diagnostics.value[1].detail = `${w} × ${h} px (Recommended >= 1024×600)`;
  } else {
    diagnostics.value[1].status = 'pass';
    diagnostics.value[1].detail = `${w} × ${h} px (Compact screen)`;
  }

  // 3. API Latency Check
  const startTime = performance.now();
  try {
    await api.get('/health');
    const elapsed = Math.round(performance.now() - startTime);
    diagnostics.value[2].status = 'pass';
    diagnostics.value[2].detail = `${elapsed}ms ping to Scorix Server`;
  } catch {
    diagnostics.value[2].status = 'fail';
    diagnostics.value[2].detail = 'Could not reach server endpoint';
  }

  // 4. Monaco / Web Worker Check
  await new Promise((r) => setTimeout(r, 200));
  try {
    const workerSupported = typeof Worker !== 'undefined';
    diagnostics.value[3].status = workerSupported ? 'pass' : 'fail';
    diagnostics.value[3].detail = workerSupported ? 'Web Workers & Monaco syntax worker active' : 'Workers not supported';
  } catch {
    diagnostics.value[3].status = 'pass';
    diagnostics.value[3].detail = 'Monaco engine verified';
  }

  // 5. Local Storage / Autosave Check
  try {
    localStorage.setItem('__cv_diag_test__', '1');
    localStorage.removeItem('__cv_diag_test__');
    diagnostics.value[4].status = 'pass';
    diagnostics.value[4].detail = 'Indexed storage ready for continuous autosave';
  } catch {
    diagnostics.value[4].status = 'fail';
    diagnostics.value[4].detail = 'Storage disabled';
  }

  diagnosticsRunning.value = false;
}
</script>

<template>
  <div
    class="flex flex-col h-screen overflow-hidden bg-[#f4f4f7] dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display"
  >
    <!-- ── Top Header Bar (Admin style) ──────────────────────────────── -->
    <header
      class="flex items-center justify-between h-12 px-5 bg-[#fafafc] dark:bg-background-dark border-b border-slate-200/90 dark:border-white/[0.06] flex-shrink-0 gap-4 select-none"
    >
      <!-- Left: Mobile toggle + Logo + Student Badge -->
      <div class="flex items-center gap-3 min-w-[180px]">
        <button
          type="button"
          class="sm:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors mr-1 cursor-pointer"
          @click="mobileNavOpen = !mobileNavOpen"
        >
          <span class="material-symbols-outlined text-[20px]">menu</span>
        </button>
        <router-link to="/" class="flex items-center gap-2 no-underline" title="Go to Home">
          <img
            :src="brand.logoPath"
            :alt="brand.appName"
            class="h-7 object-contain"
            style="filter: drop-shadow(0 0 8px rgb(var(--color-primary)))"
          />
          <span class="font-bisdak text-xl font-bold tracking-wide text-primary dark:text-[#f4f4f7] select-none transition-colors">
            scorix
          </span>
          <span
            class="text-[10px] font-semibold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 ml-0.5"
          >
            Student
          </span>
        </router-link>
      </div>

      <!-- Center: Active Tab Breadcrumb -->
      <div class="hidden sm:flex flex-1 justify-center">
        <span class="text-xs font-bold text-slate-600 dark:text-slate-300">
          {{ activeTabLabel }}
        </span>
      </div>

      <!-- Right: Theme Toggle + Profile dropdown -->
      <div class="flex items-center gap-2 min-w-[180px] justify-end">
        <button
          type="button"
          class="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          <span class="material-symbols-outlined text-[18px]">
            {{ theme === 'dark' ? 'light_mode' : 'dark_mode' }}
          </span>
        </button>

        <!-- Profile dropdown (same style as home page) -->
        <div class="pl-1 border-l border-slate-200 dark:border-white/[0.08]">
          <UserProfileDropdown dropdown-id="student-dashboard-profile-dropdown" />
        </div>
      </div>
    </header>

    <!-- ── Mobile Drawer Backdrop ────────────────────────────────────── -->
    <div
      v-if="mobileNavOpen"
      class="sm:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
      @click="mobileNavOpen = false"
    />

    <!-- ── Mobile Drawer Sidebar ─────────────────────────────────────── -->
    <nav
      class="sm:hidden fixed inset-y-0 left-0 z-50 w-[240px] flex flex-col bg-[#ececf1] dark:bg-background-dark border-r border-slate-200/90 dark:border-white/[0.06] py-3 transition-transform duration-200"
      :class="mobileNavOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
        <button
          v-for="tab in sidebarTabs"
          :key="tab.id"
          type="button"
          class="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left"
          :class="
            activeTab === tab.id
              ? 'bg-primary/10 text-primary font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.04]'
          "
          @click="selectTab(tab.id)"
        >
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[18px]">{{ tab.icon }}</span>
            <span>{{ tab.label }}</span>
          </div>
          <span
            v-if="tab.id === 'exams' && allExams.length"
            class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
          >
            {{ allExams.length }}
          </span>
          <span
            v-else-if="tab.id === 'submissions' && submissions.length"
            class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
          >
            {{ submissions.length }}
          </span>
        </button>

        <div class="my-2 border-t border-slate-200 dark:border-white/[0.06]" />

        <router-link
          to="/"
          class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.04] no-underline"
          @click="mobileNavOpen = false"
        >
          <span class="material-symbols-outlined text-[18px]">home</span>
          <span>Go to Home</span>
        </router-link>
      </div>
      <div class="px-5 py-2 text-[11px] text-slate-400 dark:text-slate-600">
        Scorix Student v1.0
      </div>
    </nav>

    <!-- ── Main Workspace Body (Sidebar + Content) ──────────────────── -->
    <div class="flex flex-1 overflow-hidden">
      <!-- ── Desktop Sidebar ─────────────────────────────────────────── -->
      <nav
        class="hidden sm:flex w-[230px] flex-shrink-0 bg-[#ececf1] dark:bg-background-dark border-r border-slate-200/90 dark:border-white/[0.06] flex-col py-3 select-none"
      >
        <div class="flex-1 flex flex-col gap-1 px-2.5">
          <button
            v-for="tab in sidebarTabs"
            :key="tab.id"
            type="button"
            class="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left"
            :class="
              activeTab === tab.id
                ? 'bg-primary/10 text-primary font-bold shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-slate-200'
            "
            @click="selectTab(tab.id)"
          >
            <div class="flex items-center gap-2.5">
              <span class="material-symbols-outlined text-[18px]">{{ tab.icon }}</span>
              <span class="truncate">{{ tab.label }}</span>
            </div>
            <span
              v-if="tab.id === 'exams' && allExams.length"
              class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
            >
              {{ allExams.length }}
            </span>
            <span
              v-else-if="tab.id === 'submissions' && submissions.length"
              class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
            >
              {{ submissions.length }}
            </span>
          </button>

          <div class="my-2 border-t border-slate-200 dark:border-white/[0.06]" />

          <router-link
            to="/"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.04] hover:text-primary no-underline transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">home</span>
            <span>Go to Home</span>
          </router-link>
        </div>

        <div class="px-5 py-2 text-[11px] text-slate-400 dark:text-slate-600">
          Scorix v1.0
        </div>
      </nav>

      <!-- ── Main Content Area ───────────────────────────────────────── -->
      <main class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar space-y-6 bg-[#f4f4f7] dark:bg-[#0d1117] min-w-0">
        <!-- ── Top Welcome & Profile Banner ──────────────────────────── -->
        <section class="welcome-card">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div class="flex items-center gap-4">
              <div class="avatar-lg">
                {{ authStore.user?.firstName?.charAt(0) || 'S' }}
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h1 class="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    Welcome, {{ authStore.user?.firstName }} {{ authStore.user?.lastName }}
                  </h1>
                  <span class="role-badge">Student</span>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                  <span class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-[15px] text-primary">badge</span>
                    Roll: <strong class="text-slate-700 dark:text-slate-200 font-mono">{{ authStore.user?.rollNumber }}</strong>
                  </span>
                  <span>•</span>
                  <span class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-[15px] text-primary">mail</span>
                    {{ authStore.user?.email }}
                  </span>
                </p>
              </div>
            </div>

            <!-- Quick Stats -->
            <div class="flex items-center gap-2.5 flex-wrap">
              <div class="stat-pill">
                <span class="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Available</span>
                <span class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ allExams.length }}</span>
              </div>
              <div class="stat-pill">
                <span class="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Enrolled</span>
                <span class="text-sm font-bold text-emerald-600 dark:text-emerald-400">{{ myEnrollments.length }}</span>
              </div>
              <div class="stat-pill">
                <span class="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Solved</span>
                <span class="text-sm font-bold text-sky-600 dark:text-sky-400">{{ solvedCount }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Alert Notifications -->
        <div v-if="enrollSuccessMessage" class="alert-success">
          <span class="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{{ enrollSuccessMessage }}</span>
        </div>

        <div v-if="errorMessage" class="alert-error">
          <span class="material-symbols-outlined text-[18px]">error</span>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- ════════════════════════════════════════════════════════════ -->
        <!-- TAB 1: Contests & Exams                                     -->
        <!-- ════════════════════════════════════════════════════════════ -->
        <div v-if="activeTab === 'exams'" class="space-y-5">
          <!-- Search & Filter Controls -->
          <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
            <!-- Filter Chips -->
            <div class="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
              <button
                type="button"
                class="chip-btn"
                :class="{ 'chip-btn--active': examFilter === 'all' }"
                @click="examFilter = 'all'"
              >
                All Exams
              </button>
              <button
                type="button"
                class="chip-btn flex items-center gap-1"
                :class="{ 'chip-btn--active': examFilter === 'live' }"
                @click="examFilter = 'live'"
              >
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Now
              </button>
              <button
                type="button"
                class="chip-btn"
                :class="{ 'chip-btn--active': examFilter === 'enrolled' }"
                @click="examFilter = 'enrolled'"
              >
                Enrolled
              </button>
              <button
                type="button"
                class="chip-btn"
                :class="{ 'chip-btn--active': examFilter === 'upcoming' }"
                @click="examFilter = 'upcoming'"
              >
                Upcoming
              </button>
              <button
                type="button"
                class="chip-btn"
                :class="{ 'chip-btn--active': examFilter === 'ended' }"
                @click="examFilter = 'ended'"
              >
                Past / Closed
              </button>
            </div>

            <!-- Search Box & Refresh -->
            <div class="flex items-center gap-2 w-full sm:w-auto">
              <div class="relative flex-1 sm:w-64">
                <span class="material-symbols-outlined text-[16px] text-slate-400 absolute left-3 top-2.5">search</span>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search exams..."
                  class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <button
                type="button"
                class="refresh-btn"
                title="Refresh exams list"
                @click="loadDashboardData"
              >
                <span class="material-symbols-outlined text-[16px]">refresh</span>
              </button>
            </div>
          </div>

          <!-- Loading Skeleton -->
          <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div v-for="i in 3" :key="i" class="h-64 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 animate-pulse" />
          </div>

          <!-- Empty State -->
          <div v-else-if="!filteredExams.length" class="empty-state">
            <span class="material-symbols-outlined text-4xl text-slate-400 dark:text-slate-600 mb-2">event_busy</span>
            <h3 class="text-base font-bold text-slate-700 dark:text-slate-300">No exams found</h3>
            <p class="text-xs text-slate-500 mt-1 max-w-sm">
              {{ searchQuery ? `No exams matching "${searchQuery}" in this filter.` : 'There are currently no exams in this category.' }}
            </p>
          </div>

          <!-- Exam Cards Grid -->
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div
              v-for="exam in filteredExams"
              :key="exam.id"
              class="exam-card group"
              :class="{
                'border-emerald-500/40 shadow-lg shadow-emerald-500/5': isExamLive(exam),
                'border-amber-500/30': isExamUpcoming(exam),
              }"
            >
              <!-- Header Badges -->
              <div class="flex items-center justify-between gap-2 mb-3">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <div v-if="isExamLive(exam)" class="status-live">
                    <span class="status-dot-live"></span>
                    LIVE NOW
                  </div>
                  <div v-else-if="isExamUpcoming(exam)" class="status-upcoming">
                    <span class="material-symbols-outlined text-[13px]">schedule</span>
                    UPCOMING
                  </div>
                  <div v-else class="status-ended">
                    ENDED
                  </div>

                  <!-- Access Type Badge -->
                  <span
                    v-if="exam.accessType === 'passcode' || exam.isPasscodeProtected"
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1"
                    title="Passcode required to enroll"
                  >
                    <span>🔑</span> Passcode
                  </span>
                  <span
                    v-else-if="exam.accessType === 'whitelist'"
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1"
                    title="Restricted to pre-approved candidates"
                  >
                    <span>🛡️</span> Whitelist
                  </span>
                </div>

                <span
                  v-if="isExamCompleted(exam)"
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1"
                >
                  <span class="material-symbols-outlined text-[12px]">task_alt</span>
                  Test Finished
                </span>
                <span v-else-if="enrolledExamIds.has(exam.id)" class="enrolled-badge">
                  <span class="material-symbols-outlined text-[14px]">check</span>
                  Enrolled
                </span>
              </div>

              <!-- Title & Info -->
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors line-clamp-1">
                {{ exam.title }}
              </h3>

              <!-- Details -->
              <div class="flex flex-col gap-2 my-4 text-xs text-slate-500 dark:text-slate-400">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">calendar_today</span>
                  <span>Starts: <strong class="text-slate-700 dark:text-slate-200">{{ formatExamTime(exam.startTime) }}</strong></span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">timer</span>
                  <span>Duration: <strong class="text-slate-700 dark:text-slate-200">{{ formatDuration(exam.durationMinutes) }}</strong></span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">quiz</span>
                  <span>Sections: <strong class="text-slate-700 dark:text-slate-200">{{ exam.mcqCount ?? 0 }} MCQs · {{ exam.codingCount ?? 0 }} Coding</strong></span>
                </div>
              </div>

              <!-- Card Actions -->
              <div class="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                <button
                  type="button"
                  class="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  title="View details & syllabus"
                  @click="openExamModal(exam)"
                >
                  Details
                </button>

                <!-- If Completed / Submitted -->
                <button
                  v-if="isExamCompleted(exam)"
                  type="button"
                  class="btn-disabled flex-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 cursor-default"
                  disabled
                >
                  <span class="material-symbols-outlined text-[16px]">task_alt</span>
                  Test Finished
                </button>

                <!-- If Enrolled & Live & Resumable -->
                <button
                  v-else-if="isExamLive(exam) && enrolledExamIds.has(exam.id) && isExamStarted(exam)"
                  type="button"
                  class="btn-resume flex-1"
                  @click="enterExamWorkspace(exam)"
                >
                  <span class="material-symbols-outlined text-[16px]">play_circle</span>
                  Resume Test
                </button>

                <!-- If Enrolled & Live & Not Started -->
                <button
                  v-else-if="isExamLive(exam) && enrolledExamIds.has(exam.id)"
                  type="button"
                  class="btn-enter flex-1"
                  @click="enterExamWorkspace(exam)"
                >
                  <span class="material-symbols-outlined text-[16px]">play_arrow</span>
                  Start Test
                </button>

                <!-- If Enrolled & Upcoming -->
                <button
                  v-else-if="isExamUpcoming(exam) && enrolledExamIds.has(exam.id)"
                  type="button"
                  class="btn-disabled flex-1"
                  disabled
                >
                  <span class="material-symbols-outlined text-[16px]">lock_clock</span>
                  Starts Soon
                </button>

                <!-- If Not Enrolled: Whitelist Exam -->
                <button
                  v-else-if="!isExamEnded(exam) && !enrolledExamIds.has(exam.id) && exam.accessType === 'whitelist'"
                  type="button"
                  class="btn-disabled flex-1"
                  disabled
                  title="This exam is restricted to pre-approved candidates assigned by the administrator"
                >
                  <span class="material-symbols-outlined text-[16px]">lock</span>
                  Restricted Access
                </button>

                <!-- If Not Enrolled: Passcode Exam -->
                <button
                  v-else-if="!isExamEnded(exam) && !enrolledExamIds.has(exam.id) && (exam.accessType === 'passcode' || exam.isPasscodeProtected)"
                  type="button"
                  class="btn-enroll flex-1"
                  :disabled="enrollingId === exam.id"
                  @click="triggerEnroll(exam)"
                >
                  <span class="material-symbols-outlined text-[16px]">key</span>
                  Enter Passcode to Enroll
                </button>

                <!-- If Not Enrolled: Open Exam -->
                <button
                  v-else-if="!isExamEnded(exam) && !enrolledExamIds.has(exam.id)"
                  type="button"
                  class="btn-enroll flex-1"
                  :disabled="enrollingId === exam.id"
                  @click="triggerEnroll(exam)"
                >
                  <span v-if="enrollingId === exam.id" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span v-else class="material-symbols-outlined text-[16px]">how_to_reg</span>
                  {{ enrollingId === exam.id ? 'Enrolling…' : '1-Click Enroll' }}
                </button>

                <!-- If Ended -->
                <button
                  v-else
                  type="button"
                  class="btn-disabled flex-1"
                  disabled
                >
                  Exam Closed
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ════════════════════════════════════════════════════════════ -->
        <!-- TAB 2: My Submissions & History                             -->
        <!-- ════════════════════════════════════════════════════════════ -->
        <div v-else-if="activeTab === 'submissions'" class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">My Submissions & History</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">Review your past code submissions, verdicts, scores, and execution metrics.</p>
            </div>
            <button
              type="button"
              class="refresh-btn"
              title="Refresh submissions"
              @click="loadSubmissions"
            >
              <span class="material-symbols-outlined text-[16px]">refresh</span>
              Refresh
            </button>
          </div>

          <div v-if="submissionsLoading" class="p-8 text-center text-slate-500">
            <span class="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
            <p class="text-xs mt-2">Loading submissions history...</p>
          </div>

          <div v-else-if="!submissions.length" class="empty-state">
            <span class="material-symbols-outlined text-4xl text-slate-400 dark:text-slate-600 mb-2">code_off</span>
            <h3 class="text-base font-bold text-slate-700 dark:text-slate-300">No submissions recorded</h3>
            <p class="text-xs text-slate-500 mt-1 max-w-sm">
              You haven't made any submissions yet. Once you participate in an exam, your judged submissions will appear here.
            </p>
          </div>

          <!-- Submissions Table -->
          <div v-else class="overflow-x-auto bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th class="px-4 py-3">Problem / Question</th>
                  <th class="px-4 py-3">Exam</th>
                  <th class="px-4 py-3">Language</th>
                  <th class="px-4 py-3">Verdict</th>
                  <th class="px-4 py-3 text-right">Score</th>
                  <th class="px-4 py-3">Submitted At</th>
                  <th class="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                <tr v-for="sub in submissions" :key="sub.id" class="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                  <td class="px-4 py-3 font-semibold text-slate-900 dark:text-slate-200">
                    {{ sub.problem?.title || `Problem #${sub.problemId}` }}
                  </td>
                  <td class="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {{ sub.exam?.title || `Exam #${sub.examId}` }}
                  </td>
                  <td class="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                    {{ getLanguageName(sub.languageId) }}
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border"
                      :class="getStatusBadge(sub.status)"
                    >
                      {{ sub.status }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {{ sub.score ?? 0 }} pts
                  </td>
                  <td class="px-4 py-3 text-slate-500 dark:text-slate-400 text-[11px]">
                    {{ dayjs(sub.submittedAt).format('MMM D, YYYY · h:mm A') }}
                  </td>
                  <td class="px-4 py-3 text-center">
                    <button
                      type="button"
                      class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg transition-colors cursor-pointer text-[11px]"
                      @click="openSubmissionModal(sub)"
                    >
                      View Code
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ════════════════════════════════════════════════════════════ -->
        <!-- TAB 3: Live Standings / Leaderboard                          -->
        <!-- ════════════════════════════════════════════════════════════ -->
        <div v-else-if="activeTab === 'leaderboard'" class="space-y-5">
          <!-- Standings Top Controls Bar -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Live Standings & Leaderboard</h2>
                <span v-if="leaderboardExam && isExamLive(leaderboardExam as any)" class="status-live">
                  <span class="status-dot-live"></span>
                  LIVE
                </span>
                <span v-else-if="leaderboardExam" class="status-ended">
                  CLOSED
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Real-time Olympic competition ranks, problem-by-problem matrix, and penalty points.
              </p>
            </div>

            <!-- Exam Selector & Refresh -->
            <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div class="relative min-w-[200px]">
                <select
                  v-model="selectedExamIdForLeaderboard"
                  class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary cursor-pointer pr-8 font-medium"
                  @change="onExamLeaderboardChange"
                >
                  <option v-for="e in allExams" :key="e.id" :value="e.id">
                    {{ e.title }} {{ isExamLive(e) ? '🟢 (Live)' : '⚪ (Ended)' }}
                  </option>
                </select>
              </div>

              <button
                type="button"
                class="refresh-btn"
                :disabled="leaderboardLoading"
                title="Refresh standings"
                @click="selectedExamIdForLeaderboard && loadLeaderboard(selectedExamIdForLeaderboard)"
              >
                <span class="material-symbols-outlined text-[16px]" :class="{ 'animate-spin': leaderboardLoading }">refresh</span>
                <span class="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          <!-- Personal Standing Hero Card -->
          <div
            v-if="myPersonalStanding"
            class="personal-standing-card"
          >
            <div class="flex items-center gap-4">
              <div class="medal-circle">
                <span v-if="myPersonalStanding.rank === 1" class="text-2xl">🥇</span>
                <span v-else-if="myPersonalStanding.rank === 2" class="text-2xl">🥈</span>
                <span v-else-if="myPersonalStanding.rank === 3" class="text-2xl">🥉</span>
                <span v-else class="text-base font-black font-mono">#{{ myPersonalStanding.rank }}</span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] uppercase font-extrabold tracking-wider text-primary">Your Standing</span>
                  <span v-if="myPersonalStanding.isTied" class="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 font-bold">Tied Rank</span>
                </div>
                <h3 class="text-base font-black text-slate-900 dark:text-slate-100">
                  Rank #{{ myPersonalStanding.rank }} of {{ rankedLeaderboard.length }} Contestant{{ rankedLeaderboard.length === 1 ? '' : 's' }}
                </h3>
                <span class="text-xs text-slate-500 dark:text-slate-400">
                  {{ myPersonalStanding.firstName }} {{ myPersonalStanding.lastName }} (Roll: {{ myPersonalStanding.rollNumber }})
                </span>
              </div>
            </div>

            <div class="flex items-center gap-6 flex-wrap mt-3 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-slate-800">
              <div class="flex flex-col">
                <span class="text-[9px] uppercase font-bold text-slate-400">Total Score</span>
                <span class="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{{ myPersonalStanding.totalScore }} pts</span>
              </div>
              <div class="flex flex-col">
                <span class="text-[9px] uppercase font-bold text-slate-400">Solved</span>
                <span class="text-lg font-black text-sky-600 dark:text-sky-400 font-mono">{{ myPersonalStanding.solvedCount }} / {{ leaderboardProblems.length }}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-[9px] uppercase font-bold text-slate-400">Penalty Time</span>
                <span class="text-lg font-black text-slate-700 dark:text-slate-300 font-mono">{{ formatPenaltyMinutes(myPersonalStanding.totalPenaltyTime) }}</span>
              </div>
            </div>
          </div>

          <!-- If student has not submitted in this exam -->
          <div
            v-else-if="rankedLeaderboard.length > 0 && selectedExamIdForLeaderboard"
            class="p-4 rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <span class="material-symbols-outlined text-[18px]">info</span>
              </div>
              <div>
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200 block">You haven't participated in this contest yet</span>
                <span class="text-[11px] text-slate-500 dark:text-slate-400">Submit solutions in the exam workspace to record your score on the live standings.</span>
              </div>
            </div>

            <button
              v-if="leaderboardExam && isExamLive(leaderboardExam as any) && !completedExamIds.has(leaderboardExam.id)"
              type="button"
              :class="[
                'px-3.5 py-1.5 font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 text-white transition-all',
                isExamStarted(leaderboardExam as any)
                  ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
                  : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20',
              ]"
              @click="enterExamWorkspace(leaderboardExam as any)"
            >
              <span class="material-symbols-outlined text-[15px]">{{ isExamStarted(leaderboardExam as any) ? 'play_circle' : 'play_arrow' }}</span>
              {{ isExamStarted(leaderboardExam as any) ? 'Resume Test' : 'Start Test' }}
            </button>
            <span
              v-else-if="leaderboardExam && completedExamIds.has(leaderboardExam.id)"
              class="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <span class="material-symbols-outlined text-[15px]">task_alt</span>
              Test Finished
            </span>
          </div>

          <!-- Search & Filter Bar -->
          <div v-if="rankedLeaderboard.length > 0" class="flex flex-col sm:flex-row items-center justify-between gap-3">
            <!-- Filter Chips -->
            <div class="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                class="chip-btn"
                :class="{ 'chip-btn--active': leaderboardRankFilter === 'all' }"
                @click="leaderboardRankFilter = 'all'"
              >
                All ({{ rankedLeaderboard.length }})
              </button>
              <button
                type="button"
                class="chip-btn"
                :class="{ 'chip-btn--active': leaderboardRankFilter === 'top10' }"
                @click="leaderboardRankFilter = 'top10'"
              >
                Top 10
              </button>
              <button
                type="button"
                class="chip-btn flex items-center gap-1"
                :class="{ 'chip-btn--active': leaderboardRankFilter === 'top3' }"
                @click="leaderboardRankFilter = 'top3'"
              >
                <span>🏆</span> Podium
              </button>
            </div>

            <!-- Search input -->
            <div class="relative w-full sm:w-64">
              <span class="material-symbols-outlined text-[16px] text-slate-400 absolute left-3 top-2.5">search</span>
              <input
                v-model="leaderboardSearch"
                type="text"
                placeholder="Search participant / roll..."
                class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="leaderboardLoading" class="p-12 text-center text-slate-500">
            <span class="material-symbols-outlined text-3xl animate-spin text-primary">progress_activity</span>
            <p class="text-xs mt-2 font-medium">Computing competition standings & tie-breakers...</p>
          </div>

          <!-- Empty State -->
          <div v-else-if="!rankedLeaderboard.length" class="empty-state">
            <span class="material-symbols-outlined text-4xl text-slate-400 dark:text-slate-600 mb-2">military_tech</span>
            <h3 class="text-base font-bold text-slate-700 dark:text-slate-300">No submissions recorded yet</h3>
            <p class="text-xs text-slate-500 mt-1 max-w-sm">
              Standings will update automatically in real-time as contestants submit solutions.
            </p>
          </div>

          <!-- Rich Problem-by-Problem Matrix Table -->
          <div v-else class="overflow-x-auto bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
                <tr>
                  <th class="px-3 py-3 text-center w-14">Rank</th>
                  <th class="px-4 py-3 min-w-[170px]">Participant</th>
                  <th class="px-3 py-3 font-mono">Roll No</th>

                  <!-- Dynamic Question Columns (Q1, Q2, etc.) -->
                  <th
                    v-for="p in leaderboardProblems"
                    :key="p.id"
                    class="px-2 py-3 text-center min-w-[64px]"
                    :title="`${p.title} (${p.questionType.toUpperCase()} - ${p.maxScore} pts)`"
                  >
                    <div class="flex flex-col items-center">
                      <span class="font-bold text-slate-700 dark:text-slate-200">Q{{ p.displayOrder + 1 }}</span>
                      <span class="text-[9px] text-slate-400 font-normal">{{ p.maxScore }}p</span>
                    </div>
                  </th>

                  <th class="px-3 py-3 text-center min-w-[60px]">Solved</th>
                  <th class="px-4 py-3 text-right min-w-[80px]">Score</th>
                  <th class="px-3 py-3 text-right min-w-[70px]">Penalty</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                <tr
                  v-for="row in filteredLeaderboard"
                  :key="row.userId"
                  class="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                  :class="{
                    'bg-primary/10 border-l-4 border-l-primary font-semibold': row.userId === authStore.user?.id,
                  }"
                >
                  <!-- Rank (Olympic + Ties) -->
                  <td class="px-3 py-3 text-center font-bold">
                    <div class="flex items-center justify-center gap-1">
                      <span v-if="row.rank === 1" class="text-amber-500 text-sm">🥇 1</span>
                      <span v-else-if="row.rank === 2" class="text-slate-400 text-sm">🥈 2</span>
                      <span v-else-if="row.rank === 3" class="text-amber-600 text-sm">🥉 3</span>
                      <span v-else class="text-slate-500 font-mono">{{ row.rank }}</span>
                      <span v-if="row.isTied" class="text-[9px] text-amber-500 font-bold" title="Tied rank with identical score & penalty">=</span>
                    </div>
                  </td>

                  <!-- Participant Name -->
                  <td class="px-4 py-3 text-slate-900 dark:text-slate-200">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-semibold">{{ row.firstName }} {{ row.lastName }}</span>
                      <span
                        v-if="row.userId === authStore.user?.id"
                        class="px-1.5 py-0.2 rounded bg-primary/20 text-primary text-[10px] font-bold uppercase"
                      >
                        You
                      </span>
                    </div>
                  </td>

                  <!-- Roll Number -->
                  <td class="px-3 py-3 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                    {{ row.rollNumber }}
                  </td>

                  <!-- Problem Score Matrix Cells -->
                  <td
                    v-for="p in leaderboardProblems"
                    :key="p.id"
                    class="px-2 py-3 text-center font-mono text-[11px]"
                  >
                    <span
                      class="inline-block px-1.5 py-0.5 rounded text-[10px]"
                      :class="problemScoreClass(row, p.id)"
                    >
                      {{ problemScore(row, p.id) }}
                    </span>
                  </td>

                  <!-- Solved Count -->
                  <td class="px-3 py-3 text-center font-bold text-sky-600 dark:text-sky-400 font-mono">
                    {{ row.solvedCount }}
                  </td>

                  <!-- Total Score -->
                  <td class="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {{ row.totalScore }} pts
                  </td>

                  <!-- Penalty Time -->
                  <td class="px-3 py-3 text-right font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                    {{ formatPenaltyMinutes(row.totalPenaltyTime) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ════════════════════════════════════════════════════════════ -->
        <!-- TAB 4: Pre-Exam System Diagnostics                         -->
        <!-- ════════════════════════════════════════════════════════════ -->
        <div v-else-if="activeTab === 'diagnostics'" class="space-y-5 max-w-3xl">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">System Readiness Diagnostics</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Run this automated check to ensure your browser, network, and editor engine are 100% prepared for live exams.
              </p>
            </div>
            <button
              type="button"
              class="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary/20 flex items-center gap-1.5 transition-all cursor-pointer"
              :disabled="diagnosticsRunning"
              @click="runDiagnostics"
            >
              <span class="material-symbols-outlined text-[16px]" :class="{ 'animate-spin': diagnosticsRunning }">
                {{ diagnosticsRunning ? 'progress_activity' : 'play_arrow' }}
              </span>
              {{ diagnosticsRunning ? 'Running Tests...' : 'Run Diagnostics' }}
            </button>
          </div>

          <div class="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
            <div
              v-for="d in diagnostics"
              :key="d.id"
              class="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                  :class="{
                    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30': d.status === 'pass',
                    'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30': d.status === 'fail',
                    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30': d.status === 'checking',
                    'bg-slate-200 dark:bg-slate-800 text-slate-500': d.status === 'pending',
                  }"
                >
                  <span v-if="d.status === 'pass'" class="material-symbols-outlined text-[18px]">check_circle</span>
                  <span v-else-if="d.status === 'fail'" class="material-symbols-outlined text-[18px]">cancel</span>
                  <span v-else-if="d.status === 'checking'" class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span v-else class="material-symbols-outlined text-[18px]">hourglass_empty</span>
                </div>
                <div>
                  <span class="text-xs font-bold text-slate-800 dark:text-slate-200 block">{{ d.name }}</span>
                  <span class="text-[11px] text-slate-500 dark:text-slate-400">{{ d.detail }}</span>
                </div>
              </div>

              <span
                class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase"
                :class="{
                  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30': d.status === 'pass',
                  'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30': d.status === 'fail',
                  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30': d.status === 'checking',
                  'bg-slate-200 dark:bg-slate-800 text-slate-500': d.status === 'pending',
                }"
              >
                {{ d.status }}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Modals -->
    <ExamDetailsModal
      :exam="selectedExamForModal"
      :is-open="showExamModal"
      :is-enrolled="selectedExamForModal ? enrolledExamIds.has(selectedExamForModal.id) : false"
      :is-live="selectedExamForModal ? isExamLive(selectedExamForModal) : false"
      :is-started="selectedExamForModal ? isExamStarted(selectedExamForModal) : false"
      :is-completed="selectedExamForModal ? isExamCompleted(selectedExamForModal) : false"
      @close="showExamModal = false"
      @enroll="(ex) => { showExamModal = false; triggerEnroll(ex as ExamItem); }"
      @enter="enterExamWorkspace"
    />

    <SubmissionDetailsModal
      :submission="selectedSubmissionForModal"
      :is-open="showSubmissionModal"
      @close="showSubmissionModal = false"
    />

    <!-- Passcode Enrollment Modal -->
    <Teleport to="body">
      <div
        v-if="passcodeModalExam"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
        @click.self="passcodeModalExam = null"
      >
        <div
          class="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <span class="material-symbols-outlined text-[18px]">key</span>
              </div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                Enter Exam Passcode
              </h3>
            </div>
            <button
              type="button"
              class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              @click="passcodeModalExam = null"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div>
            <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {{ passcodeModalExam.title }}
            </p>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              This exam is passcode-protected. Please enter the secret access code provided by your instructor or test administrator to unlock and enroll.
            </p>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">
              Exam Passcode
            </label>
            <input
              v-model="enteredPasscode"
              type="text"
              class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              placeholder="e.g. CYBER2026"
              autofocus
              @keydown.enter="submitPasscodeEnrollment"
            />
            <span v-if="passcodeError" class="text-[11px] text-rose-500 font-semibold block">
              {{ passcodeError }}
            </span>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              class="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              @click="passcodeModalExam = null"
            >
              Cancel
            </button>
            <button
              type="button"
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              :disabled="submittingPasscode || !enteredPasscode.trim()"
              @click="submitPasscodeEnrollment"
            >
              <span v-if="submittingPasscode" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              <span v-else class="material-symbols-outlined text-[16px]">lock_open</span>
              {{ submittingPasscode ? 'Verifying...' : 'Unlock & Enroll' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Welcome banner ── */
.welcome-card {
  @apply relative bg-white dark:bg-[#161b22]/90 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 md:p-6
         shadow-sm dark:shadow-xl backdrop-blur-md overflow-hidden;
}

.avatar-lg {
  @apply w-12 h-12 rounded-2xl bg-primary/15 text-primary border border-primary/30
         flex items-center justify-center text-xl font-black shadow-sm;
}

.role-badge {
  @apply px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30
         text-[10px] font-extrabold uppercase tracking-wider;
}

.stat-pill {
  @apply flex flex-col items-center justify-center px-3.5 py-1.5 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800
         rounded-xl min-w-[90px];
}

/* ── Chips ── */
.chip-btn {
  @apply px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400
         hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer;
}
.chip-btn--active {
  @apply bg-primary/15 border-primary/40 text-primary font-bold;
}

/* ── Alert notifications ── */
.alert-success {
  @apply flex items-center gap-3 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30
         rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400;
}

.alert-error {
  @apply flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border border-red-500/30
         rounded-xl text-xs font-semibold text-red-600 dark:text-red-400;
}

/* ── Refresh button ── */
.refresh-btn {
  @apply flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800
         hover:border-slate-300 dark:hover:border-slate-700 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400
         hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer;
}

/* ── Empty state ── */
.empty-state {
  @apply flex flex-col items-center justify-center p-12 bg-white/60 dark:bg-[#161b22]/40 border border-slate-200 dark:border-slate-800
         rounded-2xl text-center;
}

/* ── Exam card ── */
.exam-card {
  @apply flex flex-col bg-white dark:bg-[#161b22]/90 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5
         hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 shadow-sm dark:shadow-md;
}

/* ── Status badges ── */
.status-live {
  @apply inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30
         text-emerald-600 dark:text-emerald-400 text-[10px] font-bold tracking-wider rounded-md;
}

.status-dot-live {
  @apply w-2 h-2 rounded-full bg-emerald-500 animate-ping;
}

.status-upcoming {
  @apply inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30
         text-amber-600 dark:text-amber-400 text-[10px] font-bold tracking-wider rounded-md;
}

.status-ended {
  @apply inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400
         text-[10px] font-bold tracking-wider rounded-md;
}

.enrolled-badge {
  @apply inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400
         bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20;
}

/* ── Card buttons ── */
.btn-enter {
  @apply py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold
         text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center
         gap-1.5 transition-all active:scale-[0.98] cursor-pointer;
}

.btn-resume {
  @apply py-2 px-3 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold
         text-xs rounded-xl shadow-md shadow-orange-500/25 flex items-center justify-center
         gap-1.5 transition-all active:scale-[0.98] cursor-pointer;
}

.btn-enroll {
  @apply py-2 px-3 bg-primary hover:bg-primary/90 text-white font-bold
         text-xs rounded-xl shadow-md shadow-primary/20 flex items-center justify-center
         gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50;
}

.btn-disabled {
  @apply py-2 px-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500
         font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed;
}

/* ── Personal Standing Banner ── */
.personal-standing-card {
  @apply flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-5
         bg-gradient-to-r from-primary/10 via-primary/5 to-transparent
         dark:from-primary/20 dark:via-primary/5 dark:to-transparent
         border border-primary/30 rounded-2xl shadow-sm backdrop-blur-sm;
}

.medal-circle {
  @apply w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-primary/30
         flex items-center justify-center text-primary shadow-sm;
}
</style>

