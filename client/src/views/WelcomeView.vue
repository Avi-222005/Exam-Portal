<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import AppHeader from '../components/layout/AppHeader.vue';
import { useExamStore } from '../stores/exam';
import { useAuthStore } from '../stores/auth';
import type { Exam } from '../types';
import { brand } from '../config/brand';

const router = useRouter();
const examStore = useExamStore();
const authStore = useAuthStore();
const mobileMenuOpen = ref(false);
const entering = ref(false);
const loading = ref(true);

// The exam currently featured in the hero
const viewingExam = computed(() => examStore.activeExam || examStore.activeExams[0] || null);

// --- Pre-start countdown ---
const preStartRemaining = ref('--:--:--');
let preStartInterval: ReturnType<typeof setInterval> | null = null;

const isUpcoming = computed(() => {
  const exam = viewingExam.value;
  if (!exam) return false;
  return dayjs(exam.startTime).valueOf() > Date.now() + examStore.serverDrift;
});

function tickPreStart() {
  const startTime = viewingExam.value?.startTime;
  if (!startTime) return;
  const diff =
    dayjs(startTime).valueOf() - (Date.now() + examStore.serverDrift);
  if (diff <= 0) {
    preStartRemaining.value = '00:00:00';
    stopPreStart();
    void examStore.fetchActiveExam();
    return;
  }
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  preStartRemaining.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function stopPreStart() {
  if (preStartInterval) {
    clearInterval(preStartInterval);
    preStartInterval = null;
  }
}

watch(isUpcoming, (upcoming) => {
  if (upcoming && !preStartInterval) {
    tickPreStart();
    preStartInterval = setInterval(tickPreStart, 1000);
  } else if (!upcoming) {
    stopPreStart();
  }
});

onMounted(async () => {
  await examStore.fetchActiveExam();
  loading.value = false;
  if (isUpcoming.value) {
    tickPreStart();
    preStartInterval = setInterval(tickPreStart, 1000);
  }
});

onUnmounted(stopPreStart);

function formatSchedule(exam: Exam): string {
  const start = new Date(exam.startTime);
  const end = new Date(exam.endTime);
  const dateStr = start.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
  const startTime = start
    .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    .replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
  const endTime = end
    .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    .replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
  return `${dateStr} · ${startTime} – ${endTime}`;
}

async function enterContest(examParam?: Exam) {
  const target = examParam || viewingExam.value;
  if (!target) return;
  examStore.selectExam(target);
  entering.value = true;
  try {
    await router.push({
      name: 'workspace',
      params: { id: target.id },
    });
  } finally {
    entering.value = false;
  }
}

function scrollTo(id: string) {
  mobileMenuOpen.value = false;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// ── Interactive Playground State ──────────────────────────────────────────
const activeLang = ref<'python' | 'cpp' | 'java' | 'javascript'>('python');
const isRunningDemo = ref(false);
const demoOutputReady = ref(true);

const codeSnippets = {
  python: `def max_subarray_sum(nums: list[int]) -> int:
    # Kadane's Algorithm for optimal O(N) evaluation
    max_so_far = current_max = nums[0]
    for x in nums[1:]:
        current_max = max(x, current_max + x)
        max_so_far = max(max_so_far, current_max)
    return max_so_far

# Run test cases
print(max_subarray_sum([-2, 1, -3, 4, -1, 2, 1, -5, 4])) # Output: 6`,

  cpp: `#include <vector>
#include <algorithm>
#include <iostream>

int maxSubArray(const std::vector<int>& nums) {
    int maxSoFar = nums[0], currentMax = nums[0];
    for (size_t i = 1; i < nums.size(); ++i) {
        currentMax = std::max(nums[i], currentMax + nums[i]);
        maxSoFar = std::max(maxSoFar, currentMax);
    }
    return maxSoFar;
}`,

  java: `class Solution {
    public int maxSubArray(int[] nums) {
        int maxSoFar = nums[0];
        int currentMax = nums[0];
        for (int i = 1; i < nums.length; i++) {
            currentMax = Math.max(nums[i], currentMax + nums[i]);
            maxSoFar = Math.max(maxSoFar, currentMax);
        }
        return maxSoFar;
    }
}`,

  javascript: `function maxSubArray(nums) {
    let maxSoFar = nums[0];
    let currentMax = nums[0];
    for (let i = 1; i < nums.length; i++) {
        currentMax = Math.max(nums[i], currentMax + nums[i]);
        maxSoFar = Math.max(maxSoFar, currentMax);
    }
    return maxSoFar;
}`,
};

function runDemoCode() {
  isRunningDemo.value = true;
  demoOutputReady.value = false;
  setTimeout(() => {
    isRunningDemo.value = false;
    demoOutputReady.value = true;
  }, 600);
}

// ── Feature Bento Data ───────────────────────────────────────────────────
const bentoFeatures = [
  {
    icon: 'terminal',
    title: 'Isolated Judge0 Sandbox',
    tag: 'High Performance',
    desc: 'Code runs in dedicated sandbox containers with sub-second execution, memory thresholds, and strict isolation.',
    highlight: '15+ Compilers',
  },
  {
    icon: 'shield',
    title: 'Anti-Cheat Proctoring',
    tag: 'Integrity Guard',
    desc: 'Fullscreen enforcement, clipboard isolation, focus monitoring, and audit logs prevent unfair advantages.',
    highlight: 'Zero Plagiarism',
  },
  {
    icon: 'leaderboard',
    title: 'Real-Time ICPC Scoring',
    tag: 'Live Standings',
    desc: 'Sub-second rank updates driven by PostgreSQL materialized views with deterministic penalty scoring.',
    highlight: 'O(1) Rank Queries',
  },
  {
    icon: 'quiz',
    title: 'Hybrid Assessment Suite',
    tag: 'Versatile',
    desc: 'Create mixed tests with algorithmic programming problems, multi-choice questions (MCQs), and custom test suites.',
    highlight: 'Coding + MCQ',
  },
  {
    icon: 'cloud_sync',
    title: 'Resilient Autosave',
    tag: 'Zero Data Loss',
    desc: 'Every keystroke and code draft is debounced and synchronized to the server automatically.',
    highlight: 'Real-Time Sync',
  },
  {
    icon: 'palette',
    title: 'White-Label Theming',
    tag: 'Brand Ready',
    desc: 'Easily customize platform branding, colors, logos, titles, and certificates via environment variables.',
    highlight: 'Full Control',
  },
];

// ── Candidate Journey Steps ──────────────────────────────────────────────
const journeySteps = [
  {
    step: '01',
    icon: 'badge',
    title: 'Authenticate & Register',
    desc: 'Candidates sign in securely via roll number or email credentials with instant JWT authorization.',
  },
  {
    step: '02',
    icon: 'fullscreen',
    title: 'Proctored Lock-In',
    desc: 'A secure full-screen assessment environment activates, isolating the editor and preventing external leakage.',
  },
  {
    step: '03',
    icon: 'code_blocks',
    title: 'Monaco IDE & Run Tests',
    desc: 'Solve challenges with VSCode-quality editor, syntax highlighting, sample testing, and starter code.',
  },
  {
    step: '04',
    icon: 'military_tech',
    title: 'Automated ICPC Verdict',
    desc: 'Submissions are verified against hidden test suites and immediately ranked on the real-time leaderboard.',
  },
];

// ── Official Rules ───────────────────────────────────────────────────────
const platformRules = [
  {
    num: '01',
    title: 'Individual & Solo Work Only',
    desc: 'No collaboration, screen sharing, or third-party consultation is permitted during assessment sessions.',
  },
  {
    num: '02',
    title: 'Restricted External Paste Policy',
    desc: 'The Monaco editor blocks pasting code from external applications, websites, and external tabs.',
  },
  {
    num: '03',
    title: 'Fullscreen Violation Thresholds',
    desc: 'Exiting fullscreen or switching focus triggers security warnings and logs violation timestamps.',
  },
  {
    num: '04',
    title: 'Server-Synchronized Time Limits',
    desc: 'Contest timers synchronize with the atomic server clock to guarantee an unbiased, accurate countdown.',
  },
];
</script>

<template>
  <div
    class="relative flex w-full flex-col overflow-y-auto overflow-x-hidden bg-background-light dark:bg-[#0a0c10] font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 min-h-screen"
  >
    <!-- ── Ambient Glow & Grid Layer ───────────────────────────────────── -->
    <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div class="absolute inset-0 dot-grid opacity-[0.08] dark:opacity-[0.04]"></div>
      <div class="ambient-glow glow-1"></div>
      <div class="ambient-glow glow-2"></div>
      <div class="ambient-glow glow-3"></div>
    </div>

    <!-- ── Header ─────────────────────────────────────────────────────── -->
    <AppHeader>
      <template #nav>
        <button
          class="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-white transition-colors cursor-pointer"
          @click="scrollTo('contests')"
        >
          Live Contests
        </button>
        <button
          class="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-white transition-colors cursor-pointer"
          @click="scrollTo('features')"
        >
          Features
        </button>
        <button
          class="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-white transition-colors cursor-pointer"
          @click="scrollTo('sandbox')"
        >
          Interactive IDE
        </button>
        <button
          class="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-white transition-colors cursor-pointer"
          @click="scrollTo('how-it-works')"
        >
          How It Works
        </button>
        <button
          class="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-white transition-colors cursor-pointer"
          @click="scrollTo('rules')"
        >
          Rules
        </button>
      </template>

      <template #mobile-toggle>
        <button
          class="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <span class="material-symbols-outlined text-[20px]">{{ mobileMenuOpen ? 'close' : 'menu' }}</span>
        </button>
      </template>
    </AppHeader>

    <!-- ── Mobile Slide Navigation ─────────────────────────────────────── -->
    <Transition name="slide">
      <div
        v-if="mobileMenuOpen"
        class="md:hidden fixed inset-x-0 top-[49px] z-40 bg-white/95 dark:bg-[#0d1117]/95 backdrop-blur-xl border-b border-slate-200 dark:border-white/[0.08] p-5 flex flex-col gap-3 shadow-2xl"
      >
        <router-link
          v-if="authStore.isAuthenticated"
          to="/dashboard"
          class="flex items-center gap-2 text-xs font-bold text-primary py-2"
        >
          <span class="material-symbols-outlined text-[18px]">dashboard</span>
          Student Dashboard
        </router-link>
        <button
          class="text-left text-xs font-semibold py-2 text-slate-700 dark:text-slate-300 hover:text-primary"
          @click="scrollTo('contests')"
        >
          Live Contests
        </button>
        <button
          class="text-left text-xs font-semibold py-2 text-slate-700 dark:text-slate-300 hover:text-primary"
          @click="scrollTo('features')"
        >
          Features
        </button>
        <button
          class="text-left text-xs font-semibold py-2 text-slate-700 dark:text-slate-300 hover:text-primary"
          @click="scrollTo('sandbox')"
        >
          Interactive IDE
        </button>
        <button
          class="text-left text-xs font-semibold py-2 text-slate-700 dark:text-slate-300 hover:text-primary"
          @click="scrollTo('how-it-works')"
        >
          How It Works
        </button>
        <button
          class="text-left text-xs font-semibold py-2 text-slate-700 dark:text-slate-300 hover:text-primary"
          @click="scrollTo('rules')"
        >
          Rules
        </button>
      </div>
    </Transition>

    <main class="relative z-10 flex-1">
      <!-- ════════════════════════════════════════════════════════════════ -->
      <!-- HERO SECTION                                                     -->
      <!-- ════════════════════════════════════════════════════════════════ -->
      <section class="max-w-[1240px] mx-auto px-4 sm:px-6 pt-12 md:pt-20 pb-16 md:pb-24">
        <!-- Top Pill Badge -->
        <div class="flex justify-center mb-6">
          <div
            class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 dark:bg-primary/15 border border-primary/30 text-xs font-semibold text-primary dark:text-slate-200 shadow-sm backdrop-blur-md"
          >
            <span class="flex h-2 w-2 relative">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span>Next-Gen Technical Assessment Platform · {{ brand.appName }} v1.0</span>
          </div>
        </div>

        <!-- Main Headline & Subtitle -->
        <div class="text-center max-w-4xl mx-auto mb-10 space-y-4">
          <h1
            class="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] text-slate-900 dark:text-white"
          >
            Assess Engineers With
            <span class="hero-gradient-text block sm:inline"> Precision & Integrity</span>
          </h1>
          <p class="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            A production-grade online examination platform built with isolated Judge0 execution, Monaco IDE, strict
            proctoring guards, and real-time ICPC leaderboards.
          </p>

          <!-- Dual CTA Buttons -->
          <div class="flex flex-wrap items-center justify-center gap-3 pt-4">
            <template v-if="loading">
              <div class="h-12 w-44 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-xl" />
            </template>
            <template v-else-if="viewingExam">
              <button
                class="btn-hero-primary group"
                :disabled="entering || isUpcoming"
                @click="() => enterContest()"
              >
                <span class="material-symbols-outlined text-[20px] transition-transform group-hover:scale-110">
                  {{ isUpcoming ? 'schedule' : 'rocket_launch' }}
                </span>
                <span>
                  {{
                    entering
                      ? 'Launching Workspace…'
                      : isUpcoming
                        ? `Starts in ${preStartRemaining}`
                        : 'Enter Live Contest'
                  }}
                </span>
                <span v-if="!isUpcoming" class="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </template>
            <template v-else>
              <button class="btn-hero-primary" @click="scrollTo('contests')">
                <span class="material-symbols-outlined text-[20px]">explore</span>
                <span>Explore Contests</span>
              </button>
            </template>

            <router-link
              v-if="authStore.isAuthenticated"
              to="/dashboard"
              class="btn-hero-secondary"
            >
              <span class="material-symbols-outlined text-[18px]">dashboard</span>
              <span>Student Dashboard</span>
            </router-link>
            <button
              v-else
              class="btn-hero-secondary"
              @click="scrollTo('sandbox')"
            >
              <span class="material-symbols-outlined text-[18px]">code</span>
              <span>Try Code Sandbox</span>
            </button>
          </div>
        </div>

        <!-- Metric Trust Bar -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto mb-14">
          <div class="metric-card">
            <span class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">&lt; 250ms</span>
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Execution Latency</span>
          </div>
          <div class="metric-card">
            <span class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">15+ Compilers</span>
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Multi-Language Sandbox</span>
          </div>
          <div class="metric-card">
            <span class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">99.99%</span>
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Evaluation Reliability</span>
          </div>
          <div class="metric-card">
            <span class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">Air-Tight</span>
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Proctoring Guard</span>
          </div>
        </div>

        <!-- Hero IDE Mockup Frame -->
        <div class="relative max-w-5xl mx-auto">
          <div class="hero-glow-box"></div>
          <div class="relative bg-slate-950 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden">
            <!-- Window Top Bar -->
            <div class="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-[#ff5f57]/80"></span>
                <span class="w-3 h-3 rounded-full bg-[#febc2e]/80"></span>
                <span class="w-3 h-3 rounded-full bg-[#28c840]/80"></span>
                <span class="ml-2 text-xs font-mono text-slate-400">solution.py — Scorix Monaco Sandbox</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-bold">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Judge0 Online
                </span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/20 text-slate-200 text-[10px] font-mono font-bold">
                  🛡️ Guard Active
                </span>
              </div>
            </div>

            <!-- Editor & Verdict Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-12 font-mono text-xs">
              <!-- Left: Code Editor Window -->
              <div class="lg:col-span-7 p-5 bg-[#090d13] text-slate-300 border-b lg:border-b-0 lg:border-r border-slate-800/80 space-y-1">
                <div class="text-slate-600 select-none">1  <span class="text-purple-400 font-bold">def</span> <span class="text-sky-300">maxSubArray</span>(nums: <span class="text-emerald-400">list[int]</span>) -> <span class="text-emerald-400">int</span>:</div>
                <div class="text-slate-600 select-none">2      <span class="text-slate-500 italic"># Kadane's dynamic optimization</span></div>
                <div class="text-slate-600 select-none">3      max_sum = cur_sum = nums[<span class="text-amber-300">0</span>]</div>
                <div class="text-slate-600 select-none">4      <span class="text-purple-400 font-bold">for</span> x <span class="text-purple-400 font-bold">in</span> nums[<span class="text-amber-300">1</span>:]:</div>
                <div class="text-slate-600 select-none">5          cur_sum = <span class="text-sky-300">max</span>(x, cur_sum + x)</div>
                <div class="text-slate-600 select-none">6          max_sum = <span class="text-sky-300">max</span>(max_sum, cur_sum)</div>
                <div class="text-slate-600 select-none">7      <span class="text-purple-400 font-bold">return</span> max_sum</div>
                <div class="text-slate-600 select-none">8  </div>
                <div class="text-slate-600 select-none">9  <span class="text-slate-500 italic"># Automated test execution</span></div>
                <div class="text-slate-600 select-none">10 print(maxSubArray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))</div>
              </div>

              <!-- Right: Execution Verdicts & Live Rank Preview -->
              <div class="lg:col-span-5 p-5 bg-slate-950 flex flex-col justify-between gap-4">
                <div class="space-y-3">
                  <div class="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                    <span class="font-bold uppercase tracking-wider text-slate-300">Test Case Results</span>
                    <span class="text-emerald-400 font-bold">3/3 Passed</span>
                  </div>

                  <div class="space-y-2">
                    <div class="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
                      <span class="text-emerald-300 flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[14px]">check_circle</span>
                        Case 1 (Standard input)
                      </span>
                      <span class="text-slate-400 font-bold">12ms · 14.2MB</span>
                    </div>
                    <div class="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
                      <span class="text-emerald-300 flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[14px]">check_circle</span>
                        Case 2 (Single element)
                      </span>
                      <span class="text-slate-400 font-bold">8ms · 14.1MB</span>
                    </div>
                    <div class="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
                      <span class="text-emerald-300 flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[14px]">check_circle</span>
                        Case 3 (Large array n=10⁵)
                      </span>
                      <span class="text-slate-400 font-bold">24ms · 16.8MB</span>
                    </div>
                  </div>
                </div>

                <!-- Floating Score Banner -->
                <div class="p-3 rounded-xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[20px] text-primary dark:text-slate-100">military_tech</span>
                    <div>
                      <div class="text-[11px] font-bold text-white">ICPC Accepted</div>
                      <div class="text-[10px] text-slate-400">+100 Pts · 0 Penalty</div>
                    </div>
                  </div>
                  <span class="px-2 py-1 rounded bg-primary text-white text-[10px] font-bold uppercase">
                    Rank #1
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ════════════════════════════════════════════════════════════════ -->
      <!-- LIVE CONTESTS SECTION (#contests)                               -->
      <!-- ════════════════════════════════════════════════════════════════ -->
      <section id="contests" class="py-20 bg-slate-100/70 dark:bg-[#0d1117]/80 border-y border-slate-200 dark:border-white/[0.06]">
        <div class="max-w-[1240px] mx-auto px-4 sm:px-6">
          <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-bold uppercase tracking-widest text-primary dark:text-slate-200 mb-3">
                <span class="material-symbols-outlined text-[14px]">sports_esports</span>
                Examination Arena
              </div>
              <h2 class="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Live & Upcoming Contests
              </h2>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Select an examination to view rules, schedule, allowed runtimes, and enter the proctored assessment.
            </p>
          </div>

          <!-- Loading Skeletons -->
          <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div v-for="i in 3" :key="i" class="h-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse p-6" />
          </div>

          <!-- Multiple Active Exams Cards -->
          <div v-else-if="examStore.activeExams.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              v-for="exam in examStore.activeExams"
              :key="exam.id"
              class="exam-hub-card group"
            >
              <div class="flex items-center justify-between mb-4">
                <span
                  v-if="dayjs(exam.startTime).valueOf() > Date.now() + examStore.serverDrift"
                  class="status-pill status-pill--upcoming"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Starting Soon
                </span>
                <span v-else class="status-pill status-pill--live">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Contest
                </span>

                <span class="text-xs font-mono text-slate-400 flex items-center gap-1">
                  <span class="material-symbols-outlined text-[14px]">timer</span>
                  {{ exam.durationMinutes }}m
                </span>
              </div>

              <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary dark:group-hover:text-slate-100 transition-colors">
                {{ exam.title }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-6">
                {{ formatSchedule(exam) }}
              </p>

              <div class="pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-3 mt-auto">
                <div class="text-[11px] text-slate-500 dark:text-slate-400">
                  <span class="font-bold text-slate-700 dark:text-slate-200">{{ exam.allowedLanguages?.length || 'All' }}</span> Languages
                </div>

                <button
                  class="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-md shadow-primary/20 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  @click="enterContest(exam)"
                >
                  <span>Enter Contest</span>
                  <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center p-12 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl mx-auto space-y-4">
            <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary dark:text-slate-200 flex items-center justify-center mx-auto">
              <span class="material-symbols-outlined text-2xl">event_busy</span>
            </div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">No Scheduled Contests Currently</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              There are no active exam windows right now. You can log into your Student Dashboard to review your solved problems and past performance history.
            </p>
            <router-link
              to="/dashboard"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              <span>Go to Student Dashboard</span>
              <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </router-link>
          </div>
        </div>
      </section>

      <!-- ════════════════════════════════════════════════════════════════ -->
      <!-- BENTO FEATURES GRID (#features)                                  -->
      <!-- ════════════════════════════════════════════════════════════════ -->
      <section id="features" class="py-20 md:py-28 max-w-[1240px] mx-auto px-4 sm:px-6">
        <div class="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-bold uppercase tracking-widest text-primary dark:text-slate-200">
            <span class="material-symbols-outlined text-[14px]">auto_awesome</span>
            Engineered For Scale
          </div>
          <h2 class="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Everything Required for High-Stakes Assessments
          </h2>
          <p class="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            From classroom coding challenges to company-wide technical hiring screens, Scorix delivers institutional power.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="(item, i) in bentoFeatures"
            :key="i"
            class="bento-card group"
          >
            <div class="flex items-center justify-between mb-4">
              <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary dark:text-slate-200 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span class="material-symbols-outlined text-[20px]">{{ item.icon }}</span>
              </div>
              <span class="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
                {{ item.tag }}
              </span>
            </div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary dark:group-hover:text-slate-100 transition-colors">
              {{ item.title }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              {{ item.desc }}
            </p>
            <div class="mt-auto pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-1.5 text-xs font-bold text-primary dark:text-slate-200">
              <span>{{ item.highlight }}</span>
              <span class="material-symbols-outlined text-[14px]">check</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ════════════════════════════════════════════════════════════════ -->
      <!-- INTERACTIVE CODE PLAYGROUND (#sandbox)                          -->
      <!-- ════════════════════════════════════════════════════════════════ -->
      <section id="sandbox" class="py-20 bg-slate-900/40 dark:bg-[#07090d] border-t border-slate-200 dark:border-white/[0.06]">
        <div class="max-w-[1240px] mx-auto px-4 sm:px-6">
          <div class="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-bold uppercase tracking-widest text-primary dark:text-slate-200">
              <span class="material-symbols-outlined text-[14px]">play_circle</span>
              Interactive Sandbox
            </div>
            <h2 class="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Test Drive the Execution Engine
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Switch languages, explore algorithms, and run code directly in your browser.
            </p>
          </div>

          <div class="max-w-4xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <!-- Language Select Tabs & Run CTA -->
            <div class="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 gap-3">
              <div class="flex items-center gap-1">
                <button
                  v-for="lang in (['python', 'cpp', 'java', 'javascript'] as const)"
                  :key="lang"
                  class="px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer"
                  :class="activeLang === lang ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'"
                  @click="activeLang = lang"
                >
                  {{ lang.toUpperCase() }}
                </button>
              </div>

              <button
                class="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold font-mono flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer transition-all active:scale-95"
                :disabled="isRunningDemo"
                @click="runDemoCode"
              >
                <span class="material-symbols-outlined text-[16px]" :class="{ 'animate-spin': isRunningDemo }">
                  {{ isRunningDemo ? 'refresh' : 'play_arrow' }}
                </span>
                <span>{{ isRunningDemo ? 'Executing…' : 'Run Test Cases' }}</span>
              </button>
            </div>

            <!-- Code Body -->
            <div class="p-5 font-mono text-xs leading-relaxed text-slate-200 bg-[#090d13] overflow-x-auto">
              <pre><code>{{ codeSnippets[activeLang] }}</code></pre>
            </div>

            <!-- Output Console Bar -->
            <div class="px-5 py-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div class="flex items-center gap-2">
                <span class="text-slate-500 font-bold">Output:</span>
                <span v-if="demoOutputReady" class="text-emerald-400 font-semibold flex items-center gap-1">
                  <span class="material-symbols-outlined text-[14px]">task_alt</span>
                  Accepted · Max Subarray Sum = 6 (Execution: 14ms)
                </span>
                <span v-else class="text-amber-400 animate-pulse">Running Judge0 batch container…</span>
              </div>
              <span class="text-slate-500 text-[11px]">Memory: 14.4MB · Exit code: 0</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ════════════════════════════════════════════════════════════════ -->
      <!-- HOW IT WORKS CANDIDATE PIPELINE (#how-it-works)                 -->
      <!-- ════════════════════════════════════════════════════════════════ -->
      <section id="how-it-works" class="py-20 md:py-28 max-w-[1240px] mx-auto px-4 sm:px-6">
        <div class="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-bold uppercase tracking-widest text-primary dark:text-slate-200">
            <span class="material-symbols-outlined text-[14px]">route</span>
            Smooth Journey
          </div>
          <h2 class="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            How The Assessment Runs
          </h2>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            A frictionless candidate experience designed for focus, speed, and zero confusion.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          <div
            v-for="(step, i) in journeySteps"
            :key="i"
            class="journey-step-card"
          >
            <div class="flex items-center justify-between mb-4">
              <span class="text-3xl font-black text-primary/40 dark:text-primary/60 font-mono">{{ step.step }}</span>
              <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary dark:text-slate-200 border border-primary/20 flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">{{ step.icon }}</span>
              </div>
            </div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white mb-2">
              {{ step.title }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {{ step.desc }}
            </p>
          </div>
        </div>
      </section>

      <!-- ════════════════════════════════════════════════════════════════ -->
      <!-- OFFICIAL RULES (#rules)                                         -->
      <!-- ════════════════════════════════════════════════════════════════ -->
      <section id="rules" class="py-20 bg-slate-100/70 dark:bg-[#0d1117]/80 border-t border-slate-200 dark:border-white/[0.06]">
        <div class="max-w-[1240px] mx-auto px-4 sm:px-6">
          <div class="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-bold uppercase tracking-widest text-primary dark:text-slate-200">
              <span class="material-symbols-outlined text-[14px]">gavel</span>
              Integrity Standards
            </div>
            <h2 class="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Assessment Code of Conduct
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Please review our strict assessment parameters to ensure fair and accredited evaluation.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            <div
              v-for="(rule, i) in platformRules"
              :key="i"
              class="rule-card"
            >
              <div class="w-8 h-8 rounded-lg bg-primary text-white font-mono font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/20">
                {{ rule.num }}
              </div>
              <div>
                <h4 class="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  {{ rule.title }}
                </h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {{ rule.desc }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ════════════════════════════════════════════════════════════════ -->
      <!-- BOTTOM CALL TO ACTION                                            -->
      <!-- ════════════════════════════════════════════════════════════════ -->
      <section class="py-20 md:py-24 max-w-[1240px] mx-auto px-4 sm:px-6">
        <div class="cta-banner">
          <div class="relative z-10 max-w-2xl mx-auto text-center space-y-5">
            <h2 class="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Ready for Your Next Coding Milestone?
            </h2>
            <p class="text-sm sm:text-base text-slate-300">
              Jump into active challenges, track your ranking live on the ICPC scoreboard, and prove your engineering mastery.
            </p>
            <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                class="px-6 py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-sm shadow-xl transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                @click="scrollTo('contests')"
              >
                <span class="material-symbols-outlined text-[18px]">rocket_launch</span>
                <span>Enter Contests</span>
              </button>
              <router-link
                to="/login"
                class="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm transition-all"
              >
                Sign In to Account
              </router-link>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- ── SaaS Footer ─────────────────────────────────────────────────── -->
    <footer class="relative z-10 border-t border-slate-200 dark:border-white/[0.06] py-8 px-4 sm:px-6 bg-white/80 dark:bg-[#07090d]/80 backdrop-blur-md">
      <div class="max-w-[1240px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div class="flex items-center gap-3">
          <img
            :src="brand.logoPath"
            :alt="brand.appName"
            class="h-6 object-contain"
            style="filter: drop-shadow(0 0 6px rgb(var(--color-primary)))"
          />
          <span class="font-bold text-slate-800 dark:text-slate-200">{{ brand.appName }}</span>
          <span>·</span>
          <span>© {{ new Date().getFullYear() }} All Rights Reserved.</span>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5 text-emerald-500 font-bold text-[11px]">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            All Systems Operational
          </div>
          <span>·</span>
          <router-link to="/admin/login" class="hover:text-primary dark:hover:text-white transition-colors">
            Admin Portal
          </router-link>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ── Ambient Glows ── */
.ambient-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
}
.glow-1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgb(var(--color-primary) / 0.25) 0%, transparent 70%);
  top: -200px;
  left: -150px;
}
.glow-2 {
  width: 700px;
  height: 700px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, transparent 70%);
  bottom: 10%;
  right: -200px;
}
.glow-3 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgb(var(--color-primary) / 0.15) 0%, transparent 70%);
  top: 40%;
  left: 20%;
}

.dot-grid {
  background-image: radial-gradient(circle, currentColor 1.5px, transparent 1.5px);
  background-size: 24px 24px;
}

/* ── Typography & Gradients ── */
.hero-gradient-text {
  background: linear-gradient(135deg, rgb(var(--color-primary)) 0%, #8b5cf6 50%, #38bdf8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* ── Buttons ── */
.btn-hero-primary {
  @apply inline-flex items-center gap-2.5 h-12 px-6 rounded-xl bg-primary hover:bg-primary/90
         text-white font-bold text-sm shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35
         transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-hero-secondary {
  @apply inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-white dark:bg-white/[0.04]
         border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.08]
         text-slate-800 dark:text-slate-200 font-bold text-sm transition-all active:scale-95 no-underline cursor-pointer;
}

/* ── Cards & Bento ── */
.metric-card {
  @apply p-4 rounded-2xl bg-white/70 dark:bg-[#161b22]/70 border border-slate-200 dark:border-slate-800/80
         backdrop-blur-md flex flex-col items-center justify-center text-center gap-1 shadow-sm;
}

.hero-glow-box {
  @apply absolute -inset-1 rounded-3xl opacity-50 blur-xl pointer-events-none;
  background: linear-gradient(135deg, rgb(var(--color-primary) / 0.4), rgba(99, 102, 241, 0.2), transparent);
}

.exam-hub-card {
  @apply flex flex-col p-6 rounded-2xl bg-white dark:bg-[#161b22]/90 border border-slate-200 dark:border-slate-800
         hover:border-primary/40 dark:hover:border-primary/40 transition-all duration-200 shadow-sm hover:shadow-xl hover:shadow-primary/5;
}

.status-pill {
  @apply inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider;
}
.status-pill--live {
  @apply bg-emerald-500/15 border border-emerald-500/30 text-emerald-500;
}
.status-pill--upcoming {
  @apply bg-amber-500/15 border border-amber-500/30 text-amber-500;
}

.bento-card {
  @apply flex flex-col p-6 rounded-2xl bg-white dark:bg-[#161b22]/70 border border-slate-200 dark:border-slate-800/80
         hover:border-primary/40 dark:hover:border-primary/40 transition-all duration-200 shadow-sm hover:shadow-lg backdrop-blur-md;
}

.journey-step-card {
  @apply p-6 rounded-2xl bg-white dark:bg-[#161b22]/70 border border-slate-200 dark:border-slate-800/80
         flex flex-col shadow-sm;
}

.rule-card {
  @apply flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-[#161b22]/70 border border-slate-200 dark:border-slate-800/80
         shadow-sm;
}

.cta-banner {
  @apply relative p-10 md:p-14 rounded-3xl overflow-hidden shadow-2xl;
  background: linear-gradient(135deg, rgb(var(--color-primary)) 0%, #4c1d95 60%, #1e1b4b 100%);
}

/* ── Mobile menu transition ── */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateY(-8px);
  opacity: 0;
}
</style>
