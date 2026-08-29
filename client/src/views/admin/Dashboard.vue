<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { getStats } from '../../services/adminApi';
import type { AdminStats } from '../../types/admin';
import RegalButton from '../../components/admin/RegalButton.vue';

const router = useRouter();
const authStore = useAuthStore();
const stats = ref<AdminStats | null>(null);
const loading = ref(true);
const error = ref('');

const isSuperAdmin = computed(() => authStore.user?.role === 'SUPER_ADMIN');

onMounted(async () => {
  try {
    stats.value = await getStats();
  } catch {
    error.value = 'Failed to load dashboard statistics.';
  } finally {
    loading.value = false;
  }
});

const verdictBadge = (verdict: string) => {
  const map: Record<string, { label: string; class: string }> = {
    accepted: {
      label: 'Accepted',
      class: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    },
    wrong_answer: {
      label: 'Wrong Answer',
      class: 'bg-red-500/10 text-red-400 border-red-500/20',
    },
    time_limit_exceeded: {
      label: 'TLE',
      class: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    },
    compilation_error: {
      label: 'Compile Error',
      class: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    },
    runtime_error: {
      label: 'Runtime Error',
      class: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    },
    pending: {
      label: 'Evaluating',
      class: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse',
    },
  };
  return (
    map[verdict] ?? {
      label: verdict?.replace(/_/g, ' ') || 'Unknown',
      class: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    }
  );
};

function formatTimeAgo(iso: string) {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(iso: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div class="w-full pb-16">
    <!-- Header Welcome & Actions -->
    <div
      class="flex flex-col md:flex-row md:items-center md:justify-between mb-6 pb-6 border-b border-slate-200 dark:border-white/[0.06] gap-4"
    >
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Dashboard
          </h1>
          <span
            v-if="isSuperAdmin"
            class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500 dark:text-amber-300 border border-amber-500/30"
          >
            Super Admin
          </span>
          <span
            v-else
            class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20"
          >
            Administrator
          </span>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Welcome back<span v-if="authStore.user?.firstName">, {{ authStore.user.firstName }}</span
          >. Real-time system metrics, live tests & candidate activity.
        </p>
      </div>

      <!-- Quick Header Action Buttons -->
      <div class="flex items-center flex-wrap gap-2.5">
        <RegalButton
          variant="primary"
          @click="router.push({ name: 'admin-exam-create' })"
        >
          <span class="material-symbols-outlined text-[17px] mr-1">add_circle</span>
          Create Exam
        </RegalButton>
        <RegalButton
          @click="router.push({ name: 'admin-all-problem-create' })"
        >
          <span class="material-symbols-outlined text-[17px] mr-1">quiz</span>
          Add Problem
        </RegalButton>
        <RegalButton
          @click="router.push({ name: 'admin-user-create' })"
        >
          <span class="material-symbols-outlined text-[17px] mr-1">person_add</span>
          Add User
        </RegalButton>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-slate-400">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
      <p class="text-sm">Loading platform overview…</p>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-center gap-2"
    >
      <span class="material-symbols-outlined">error</span>
      {{ error }}
    </div>

    <!-- Main Content -->
    <template v-else-if="stats">
      <!-- Active / Live Exams Monitor Banner -->
      <div v-if="stats.activeExams && stats.activeExams.length > 0" class="mb-8 space-y-3">
        <div
          v-for="exam in stats.activeExams"
          :key="exam.id"
          class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-emerald-500/[0.06] border border-emerald-500/30 rounded-2xl gap-4 shadow-sm"
        >
          <div class="flex items-center gap-3.5">
            <span class="relative flex h-3.5 w-3.5">
              <span
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
              ></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-500 font-mono">
                  Live Exam Active
                </span>
                <span
                  v-if="exam.accessType"
                  class="px-2 py-0.2 rounded text-[10px] font-semibold uppercase bg-slate-500/10 text-slate-400"
                >
                  {{ exam.accessType }}
                </span>
                <span
                  v-if="exam.maxViolations"
                  class="px-2 py-0.2 rounded text-[10px] font-semibold text-amber-400 bg-amber-500/10"
                >
                  Max {{ exam.maxViolations }} Violations
                </span>
              </div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {{ exam.title }}
              </h3>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 transition-colors cursor-pointer"
              @click="router.push({ name: 'admin-leaderboard', params: { examId: exam.id } })"
            >
              <span class="material-symbols-outlined text-[16px]">leaderboard</span>
              Live Leaderboard
            </button>
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors cursor-pointer"
              @click="router.push({ name: 'admin-exam-edit', params: { id: exam.id } })"
            >
              <span class="material-symbols-outlined text-[16px]">edit</span>
              Manage
            </button>
          </div>
        </div>
      </div>

      <!-- KPI Metrics Grid -->
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <!-- Exams -->
        <div
          class="p-4 rounded-2xl bg-white dark:bg-surface-dark/50 border border-slate-200 dark:border-white/[0.06] shadow-sm hover:border-primary/40 transition-all cursor-pointer"
          @click="router.push({ name: 'admin-exams' })"
        >
          <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span class="text-xs font-semibold uppercase tracking-wider">Total Exams</span>
            <div class="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">assignment</span>
            </div>
          </div>
          <div class="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {{ stats.totalExams }}
          </div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span class="text-emerald-500 font-medium">{{ stats.activeExams?.length ?? 0 }} active</span>
            <span>· All time</span>
          </div>
        </div>

        <!-- Students -->
        <div
          class="p-4 rounded-2xl bg-white dark:bg-surface-dark/50 border border-slate-200 dark:border-white/[0.06] shadow-sm hover:border-primary/40 transition-all cursor-pointer"
          @click="router.push({ name: 'admin-users' })"
        >
          <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span class="text-xs font-semibold uppercase tracking-wider">Registered Users</span>
            <div class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">group</span>
            </div>
          </div>
          <div class="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {{ stats.totalStudents }}
          </div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span class="text-blue-500 font-medium">{{ stats.totalAdmins ?? 1 }} Admins</span>
            <span>· Verified</span>
          </div>
        </div>

        <!-- Submissions -->
        <div
          class="p-4 rounded-2xl bg-white dark:bg-surface-dark/50 border border-slate-200 dark:border-white/[0.06] shadow-sm hover:border-primary/40 transition-all cursor-pointer"
          @click="router.push({ name: 'admin-submissions' })"
        >
          <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span class="text-xs font-semibold uppercase tracking-wider">Submissions</span>
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">send</span>
            </div>
          </div>
          <div class="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {{ stats.totalSubmissions }}
          </div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span class="text-emerald-500 font-medium">{{ stats.acceptedSubmissions ?? 0 }} passed</span>
            <span>({{ stats.acceptanceRate ?? 0 }}%)</span>
          </div>
        </div>

        <!-- Problems -->
        <div
          class="p-4 rounded-2xl bg-white dark:bg-surface-dark/50 border border-slate-200 dark:border-white/[0.06] shadow-sm hover:border-primary/40 transition-all cursor-pointer"
          @click="router.push({ name: 'admin-all-problems' })"
        >
          <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span class="text-xs font-semibold uppercase tracking-wider">Problem Bank</span>
            <div class="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">code_blocks</span>
            </div>
          </div>
          <div class="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {{ stats.totalProblems ?? 0 }}
          </div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Coding & MCQ questions
          </div>
        </div>

        <!-- Executions / Run Logs -->
        <div
          class="p-4 rounded-2xl bg-white dark:bg-surface-dark/50 border border-slate-200 dark:border-white/[0.06] shadow-sm hover:border-primary/40 transition-all cursor-pointer col-span-2 md:col-span-1"
          @click="router.push({ name: 'admin-run-logs' })"
        >
          <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span class="text-xs font-semibold uppercase tracking-wider">Judge Runs</span>
            <div class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">terminal</span>
            </div>
          </div>
          <div class="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {{ stats.totalRunLogs ?? 0 }}
          </div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sandbox code executions
          </div>
        </div>
      </div>

      <!-- Main Two-Column Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <!-- Left: Recent Activity Feed (2 Cols) -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Recent Submissions -->
          <div
            class="p-5 rounded-2xl bg-white dark:bg-surface-dark/50 border border-slate-200 dark:border-white/[0.06] shadow-sm"
          >
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-[20px]">history</span>
                <h2 class="text-base font-bold text-slate-900 dark:text-white">Recent Submissions</h2>
              </div>
              <button
                class="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                @click="router.push({ name: 'admin-submissions' })"
              >
                View all
                <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>

            <div v-if="!stats.recentSubmissions || stats.recentSubmissions.length === 0" class="py-8 text-center text-slate-400 text-sm">
              No recent submissions recorded.
            </div>

            <div v-else class="divide-y divide-slate-100 dark:divide-white/[0.04]">
              <div
                v-for="sub in stats.recentSubmissions"
                :key="sub.id"
                class="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] px-2 rounded-lg transition-colors cursor-pointer"
                @click="router.push({ name: 'admin-submission-view', params: { id: sub.id } })"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border flex-shrink-0"
                    :class="verdictBadge(sub.verdict).class"
                  >
                    {{ verdictBadge(sub.verdict).label }}
                  </span>
                  <div class="min-w-0">
                    <div class="text-xs font-medium text-slate-900 dark:text-white truncate">
                      {{ sub.problem?.title ?? 'Problem' }}
                      <span class="text-slate-400 font-normal text-[11px] ml-1">· {{ sub.exam?.title ?? 'Exam' }}</span>
                    </div>
                    <div class="text-[11px] text-slate-500 font-mono">
                      {{ sub.user?.rollNumber ?? 'Candidate' }} ({{ sub.user?.firstName }} {{ sub.user?.lastName }})
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-3 flex-shrink-0 text-right">
                  <span class="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {{ Number(sub.score).toFixed(1) }} pts
                  </span>
                  <span class="text-[11px] text-slate-400 whitespace-nowrap">
                    {{ formatTimeAgo(sub.submittedAt) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Exams Overview -->
          <div
            class="p-5 rounded-2xl bg-white dark:bg-surface-dark/50 border border-slate-200 dark:border-white/[0.06] shadow-sm"
          >
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-indigo-500 text-[20px]">inventory_2</span>
                <h2 class="text-base font-bold text-slate-900 dark:text-white">Recent Exams</h2>
              </div>
              <button
                class="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                @click="router.push({ name: 'admin-exams' })"
              >
                View all exams
                <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>

            <div v-if="!stats.recentExams || stats.recentExams.length === 0" class="py-8 text-center text-slate-400 text-sm">
              No exams created yet.
            </div>

            <div v-else class="space-y-2.5">
              <div
                v-for="e in stats.recentExams"
                :key="e.id"
                class="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between gap-4 hover:border-primary/40 transition-colors"
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      :class="
                        e.isActive
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      "
                    >
                      {{ e.isActive ? 'Active' : 'Draft' }}
                    </span>
                    <span class="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {{ e.title }}
                    </span>
                  </div>
                  <div class="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                    <span>Window: {{ formatDate(e.startTime) }} → {{ formatDate(e.endTime) }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    title="Leaderboard"
                    @click="router.push({ name: 'admin-leaderboard', params: { examId: e.id } })"
                  >
                    <span class="material-symbols-outlined text-[18px]">leaderboard</span>
                  </button>
                  <button
                    class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    title="Edit Exam"
                    @click="router.push({ name: 'admin-exam-edit', params: { id: e.id } })"
                  >
                    <span class="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: System Health & Toolkit (1 Col) -->
        <div class="space-y-6">
          <!-- Platform & Security Status -->
          <div
            class="p-5 rounded-2xl bg-white dark:bg-surface-dark/50 border border-slate-200 dark:border-white/[0.06] shadow-sm"
          >
            <div class="flex items-center gap-2 mb-4">
              <span class="material-symbols-outlined text-emerald-500 text-[20px]">verified_user</span>
              <h2 class="text-base font-bold text-slate-900 dark:text-white">Security & Engines</h2>
            </div>

            <div class="space-y-3 text-xs">
              <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span class="font-medium text-slate-700 dark:text-slate-300">Judge0 Code Sandbox</span>
                </div>
                <span class="text-[11px] font-semibold text-emerald-500">Ready</span>
              </div>

              <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span class="font-medium text-slate-700 dark:text-slate-300">Anti-Cheat Proctoring</span>
                </div>
                <span class="text-[11px] font-semibold text-emerald-500">Enforced</span>
              </div>

              <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span class="font-medium text-slate-700 dark:text-slate-300">Super Admin RBAC</span>
                </div>
                <span class="text-[11px] font-semibold text-amber-500">Protected</span>
              </div>

              <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span class="font-medium text-slate-700 dark:text-slate-300">PostgreSQL Database</span>
                </div>
                <span class="text-[11px] font-semibold text-emerald-500">Connected</span>
              </div>
            </div>
          </div>

          <!-- Quick Management Toolkit -->
          <div
            class="p-5 rounded-2xl bg-white dark:bg-surface-dark/50 border border-slate-200 dark:border-white/[0.06] shadow-sm"
          >
            <div class="flex items-center gap-2 mb-4">
              <span class="material-symbols-outlined text-primary text-[20px]">dashboard_customize</span>
              <h2 class="text-base font-bold text-slate-900 dark:text-white">Admin Toolkit</h2>
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <button
                class="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] hover:border-primary/50 text-left transition-all cursor-pointer group"
                @click="router.push({ name: 'admin-exams' })"
              >
                <span class="material-symbols-outlined text-indigo-500 text-[20px] mb-1 block group-hover:scale-110 transition-transform">assignment</span>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Exams</div>
                <div class="text-[10px] text-slate-500">Manage tests</div>
              </button>

              <button
                class="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] hover:border-primary/50 text-left transition-all cursor-pointer group"
                @click="router.push({ name: 'admin-all-problems' })"
              >
                <span class="material-symbols-outlined text-purple-500 text-[20px] mb-1 block group-hover:scale-110 transition-transform">code_blocks</span>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Problems</div>
                <div class="text-[10px] text-slate-500">Question bank</div>
              </button>

              <button
                class="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] hover:border-primary/50 text-left transition-all cursor-pointer group"
                @click="router.push({ name: 'admin-users' })"
              >
                <span class="material-symbols-outlined text-blue-500 text-[20px] mb-1 block group-hover:scale-110 transition-transform">group</span>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Users</div>
                <div class="text-[10px] text-slate-500">Roles & candidates</div>
              </button>

              <button
                class="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] hover:border-primary/50 text-left transition-all cursor-pointer group"
                @click="router.push({ name: 'admin-submissions' })"
              >
                <span class="material-symbols-outlined text-emerald-500 text-[20px] mb-1 block group-hover:scale-110 transition-transform">send</span>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Submissions</div>
                <div class="text-[10px] text-slate-500">Verdicts & logs</div>
              </button>

              <button
                class="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] hover:border-primary/50 text-left transition-all cursor-pointer group"
                @click="router.push({ name: 'admin-autosaves' })"
              >
                <span class="material-symbols-outlined text-cyan-500 text-[20px] mb-1 block group-hover:scale-110 transition-transform">save</span>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">AutoSave</div>
                <div class="text-[10px] text-slate-500">Draft recovery</div>
              </button>

              <button
                class="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] hover:border-primary/50 text-left transition-all cursor-pointer group"
                @click="router.push({ name: 'admin-run-logs' })"
              >
                <span class="material-symbols-outlined text-amber-500 text-[20px] mb-1 block group-hover:scale-110 transition-transform">terminal</span>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Run Logs</div>
                <div class="text-[10px] text-slate-500">Execution traces</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
