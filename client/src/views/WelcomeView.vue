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
  python: `def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i

# Example
print(two_sum([2, 7, 11, 15], 9))  # [0, 1]`,

  cpp: `#include <vector>
#include <unordered_map>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> seen;
    for (int i = 0; i < nums.size(); i++) {
        int complement = target - nums[i];
        if (seen.count(complement))
            return {seen[complement], i};
        seen[nums[i]] = i;
    }
    return {};
}`,

  java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (seen.containsKey(complement))
                return new int[]{seen.get(complement), i};
            seen.put(nums[i], i);
        }
        return new int[]{};
    }
}`,

  javascript: `function twoSum(nums, target) {
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (seen.has(complement))
            return [seen.get(complement), i];
        seen.set(nums[i], i);
    }
}

console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]`,
};

function runDemoCode() {
  isRunningDemo.value = true;
  demoOutputReady.value = false;
  setTimeout(() => {
    isRunningDemo.value = false;
    demoOutputReady.value = true;
  }, 600);
}

// ── Feature Data (product-focused) ───────────────────────────────────────
const mainFeatures = [
  {
    icon: 'code',
    title: 'Code in 15+ languages',
    desc: 'Python, C++, Java, JavaScript, and more — each running in its own secure sandbox with instant feedback.',
  },
  {
    icon: 'visibility',
    title: 'Built-in proctoring',
    desc: 'Fullscreen lock, tab-switch detection, and clipboard monitoring keep every assessment fair and honest.',
  },
  {
    icon: 'leaderboard',
    title: 'Live leaderboards',
    desc: 'Rankings update the moment a submission is graded. Candidates and admins see results in real time.',
  },
];

const extraFeatures = [
  { icon: 'save', title: 'Auto-save', desc: 'Every keystroke is saved. No work is ever lost.' },
  { icon: 'quiz', title: 'MCQ + Coding', desc: 'Mix question types in one exam.' },
  { icon: 'palette', title: 'Your brand', desc: 'Custom logo, colors, and name.' },
  { icon: 'timer', title: 'Precise timing', desc: 'Server-synced countdown, no client tricks.' },
];

// ── How It Works ─────────────────────────────────────────────────────────
const steps = [
  {
    num: '01',
    title: 'Create an exam',
    desc: 'Add coding problems or MCQs, set time limits, and choose which languages to allow.',
  },
  {
    num: '02',
    title: 'Invite candidates',
    desc: 'Share a link or register participants directly. They log in and see their exams.',
  },
  {
    num: '03',
    title: 'Candidates code',
    desc: 'They write and test solutions in a real code editor — proctored and secure.',
  },
  {
    num: '04',
    title: 'Review results',
    desc: 'Scores, rankings, and submissions are available the moment the exam ends.',
  },
];

// ── Fair Play Rules ──────────────────────────────────────────────────────
const rules = [
  {
    num: '01',
    title: 'Solo work only',
    desc: 'No collaboration, screen sharing, or external help during an exam.',
  },
  {
    num: '02',
    title: 'No external pasting',
    desc: 'The editor blocks paste from outside sources to ensure originality.',
  },
  {
    num: '03',
    title: 'Stay in fullscreen',
    desc: 'Leaving fullscreen or switching tabs triggers a warning and is logged.',
  },
  {
    num: '04',
    title: 'Time is server-synced',
    desc: 'The countdown runs on the server clock — no local clock manipulation.',
  },
];
</script>

<template>
  <div
    class="relative flex w-full flex-col overflow-y-auto overflow-x-hidden bg-white dark:bg-[#09090b] font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 min-h-screen"
  >
    <!-- ── Subtle Background Gradient ────────────────────────────────── -->
    <div class="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      <div class="hero-gradient"></div>
    </div>

    <!-- ── Header ─────────────────────────────────────────────────────── -->
    <AppHeader>
      <template #nav>
        <button
          class="nav-link"
          @click="scrollTo('features')"
        >
          Features
        </button>
        <button
          class="nav-link"
          @click="scrollTo('sandbox')"
        >
          Editor
        </button>
        <button
          class="nav-link"
          @click="scrollTo('how-it-works')"
        >
          How It Works
        </button>
        <button
          class="nav-link"
          @click="scrollTo('contests')"
        >
          Exams
        </button>
      </template>

      <template #mobile-toggle>
        <button
          class="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <span class="material-symbols-outlined text-[20px]">{{ mobileMenuOpen ? 'close' : 'menu' }}</span>
        </button>
      </template>
    </AppHeader>

    <!-- ── Mobile Menu ────────────────────────────────────────────────── -->
    <Transition name="slide">
      <div
        v-if="mobileMenuOpen"
        class="md:hidden fixed inset-x-0 top-[49px] z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.06] p-5 flex flex-col gap-3 shadow-2xl"
      >
        <router-link
          v-if="authStore.isAuthenticated"
          to="/dashboard"
          class="flex items-center gap-2 text-xs font-bold text-primary py-2"
        >
          <span class="material-symbols-outlined text-[18px]">dashboard</span>
          Dashboard
        </router-link>
        <button class="mobile-nav-link" @click="scrollTo('features')">Features</button>
        <button class="mobile-nav-link" @click="scrollTo('sandbox')">Editor</button>
        <button class="mobile-nav-link" @click="scrollTo('how-it-works')">How It Works</button>
        <button class="mobile-nav-link" @click="scrollTo('contests')">Exams</button>
        <button class="mobile-nav-link" @click="scrollTo('rules')">Fair Play</button>
      </div>
    </Transition>

    <main class="relative z-10 flex-1">
      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- HERO SECTION                                                  -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <section class="max-w-[1100px] mx-auto px-5 sm:px-8 pt-16 md:pt-28 pb-20 md:pb-32">
        <!-- Tagline Pill -->
        <div class="flex justify-center mb-8 animate-fade-in">
          <div class="pill">
            <span class="text-primary dark:text-primary">✦</span>
            <span>The smarter way to run coding exams</span>
          </div>
        </div>

        <!-- Headline -->
        <div class="text-center max-w-3xl mx-auto mb-6 animate-fade-in-up">
          <h1 class="text-5xl sm:text-6xl lg:text-[4.5rem] font-extrabold tracking-tight leading-[1.1] text-slate-900 dark:text-white">
            Run coding exams<br />
            <span class="hero-gradient-text">your candidates</span><br class="hidden sm:block" />
            <span class="hero-gradient-text">actually respect.</span>
          </h1>
        </div>

        <!-- Subtitle -->
        <p class="text-center text-lg sm:text-xl text-slate-500 dark:text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed animate-fade-in-up delay-1">
          Create, proctor, and evaluate coding assessments in minutes — not weeks. Built-in code editor, instant grading, and live leaderboards.
        </p>

        <!-- CTAs -->
        <div class="flex flex-wrap items-center justify-center gap-4 mb-16 animate-fade-in-up delay-2">
          <template v-if="loading">
            <div class="h-12 w-40 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-xl" />
          </template>
          <template v-else-if="viewingExam">
            <button
              class="btn-primary group"
              :disabled="entering || isUpcoming"
              @click="() => enterContest()"
            >
              <span class="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5">
                {{ isUpcoming ? 'schedule' : 'arrow_forward' }}
              </span>
              <span>
                {{
                  entering
                    ? 'Launching…'
                    : isUpcoming
                      ? `Starts in ${preStartRemaining}`
                      : 'Enter Exam'
                }}
              </span>
            </button>
          </template>
          <template v-else>
            <router-link
              v-if="authStore.isAuthenticated"
              to="/dashboard"
              class="btn-primary no-underline"
            >
              <span>Go to Dashboard</span>
              <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            </router-link>
            <button v-else class="btn-primary" @click="scrollTo('sandbox')">
              <span>Get Started</span>
              <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </template>

          <button
            class="btn-ghost"
            @click="scrollTo('sandbox')"
          >
            See it in action
          </button>
        </div>

        <!-- Hero Product Mockup -->
        <div class="relative max-w-4xl mx-auto animate-fade-in-up delay-3">
          <div class="hero-mockup-glow"></div>
          <div class="hero-mockup">
            <!-- Window Chrome -->
            <div class="flex items-center gap-2 px-4 py-3 bg-slate-100/80 dark:bg-[#18181b] border-b border-slate-200/60 dark:border-white/[0.06]">
              <span class="w-2.5 h-2.5 rounded-full bg-red-400/60"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-amber-400/60"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400/60"></span>
              <span class="ml-3 text-[11px] font-mono text-slate-400 dark:text-slate-500">{{ brand.appName }} — Workspace</span>
            </div>

            <!-- Split Pane Mockup -->
            <div class="grid grid-cols-1 lg:grid-cols-12">
              <!-- Left: Problem Panel -->
              <div class="lg:col-span-5 p-5 border-b lg:border-b-0 lg:border-r border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-[#09090b]">
                <div class="flex items-center gap-2 mb-3">
                  <span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">Easy</span>
                  <span class="text-xs text-slate-400">Problem 1 of 3</span>
                </div>
                <h3 class="text-sm font-bold text-slate-800 dark:text-white mb-2">Two Sum</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  Given an array of integers <code class="text-[11px] px-1 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">nums</code> and an integer <code class="text-[11px] px-1 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">target</code>, return indices of the two numbers that add up to target.
                </p>
                <div class="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06] text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <div><span class="text-slate-400 dark:text-slate-500">Input:</span> nums = [2,7,11,15], target = 9</div>
                  <div><span class="text-slate-400 dark:text-slate-500">Output:</span> [0, 1]</div>
                </div>
              </div>

              <!-- Right: Code Editor -->
              <div class="lg:col-span-7 flex flex-col">
                <div class="px-4 py-2 border-b border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#0f0f12] flex items-center justify-between">
                  <span class="text-[11px] font-mono text-slate-400 dark:text-slate-500">solution.py</span>
                  <span class="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-500">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Connected
                  </span>
                </div>
                <div class="p-4 bg-white dark:bg-[#0a0a0d] font-mono text-xs text-slate-600 dark:text-slate-300 space-y-0.5 flex-1">
                  <div><span class="text-slate-400 dark:text-slate-600 select-none mr-3">1</span><span class="text-purple-500 dark:text-purple-400 font-medium">def</span> <span class="text-sky-600 dark:text-sky-400">two_sum</span>(nums, target):</div>
                  <div><span class="text-slate-400 dark:text-slate-600 select-none mr-3">2</span>    seen = {}</div>
                  <div><span class="text-slate-400 dark:text-slate-600 select-none mr-3">3</span>    <span class="text-purple-500 dark:text-purple-400 font-medium">for</span> i, num <span class="text-purple-500 dark:text-purple-400 font-medium">in</span> enumerate(nums):</div>
                  <div><span class="text-slate-400 dark:text-slate-600 select-none mr-3">4</span>        comp = target - num</div>
                  <div><span class="text-slate-400 dark:text-slate-600 select-none mr-3">5</span>        <span class="text-purple-500 dark:text-purple-400 font-medium">if</span> comp <span class="text-purple-500 dark:text-purple-400 font-medium">in</span> seen:</div>
                  <div><span class="text-slate-400 dark:text-slate-600 select-none mr-3">6</span>            <span class="text-purple-500 dark:text-purple-400 font-medium">return</span> [seen[comp], i]</div>
                  <div><span class="text-slate-400 dark:text-slate-600 select-none mr-3">7</span>        seen[num] = i</div>
                </div>

                <!-- Results Bar -->
                <div class="px-4 py-3 bg-slate-50 dark:bg-[#0f0f12] border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between">
                  <div class="flex items-center gap-2 text-[11px]">
                    <span class="material-symbols-outlined text-emerald-500 text-[16px]">check_circle</span>
                    <span class="text-emerald-600 dark:text-emerald-400 font-semibold">All tests passed</span>
                    <span class="text-slate-400">· 12ms · 14.2 MB</span>
                  </div>
                  <span class="px-2.5 py-1 rounded-lg bg-primary/10 text-primary dark:text-primary text-[10px] font-bold">
                    +100 pts
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- FEATURES (#features)                                          -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <section id="features" class="py-20 md:py-28">
        <div class="max-w-[1100px] mx-auto px-5 sm:px-8">
          <div class="text-center max-w-2xl mx-auto mb-16">
            <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              Everything you need to run<br class="hidden sm:block" /> secure coding exams
            </h2>
            <p class="text-base text-slate-500 dark:text-slate-400">
              From the code editor to the leaderboard — it's all built in.
            </p>
          </div>

          <!-- Main 3 Features -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <div
              v-for="(feat, i) in mainFeatures"
              :key="i"
              class="feature-card group"
            >
              <div class="w-10 h-10 rounded-xl bg-primary/8 dark:bg-primary/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <span class="material-symbols-outlined text-primary dark:text-primary text-[22px]">{{ feat.icon }}</span>
              </div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">{{ feat.title }}</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{{ feat.desc }}</p>
            </div>
          </div>

          <!-- Extra Features Grid -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              v-for="(feat, i) in extraFeatures"
              :key="i"
              class="extra-feature-card"
            >
              <span class="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[18px] mb-2">{{ feat.icon }}</span>
              <h4 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">{{ feat.title }}</h4>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ feat.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- INTERACTIVE DEMO (#sandbox)                                   -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <section id="sandbox" class="py-20 md:py-28 bg-slate-50/80 dark:bg-[#0c0c0f] border-y border-slate-200/60 dark:border-white/[0.04]">
        <div class="max-w-[1100px] mx-auto px-5 sm:px-8">
          <div class="text-center max-w-2xl mx-auto mb-12">
            <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              Try the editor
            </h2>
            <p class="text-base text-slate-500 dark:text-slate-400">
              This is what your candidates will see. Pick a language and hit Run.
            </p>
          </div>

          <div class="max-w-3xl mx-auto">
            <div class="demo-editor">
              <!-- Tab Bar -->
              <div class="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-[#18181b] border-b border-slate-200/60 dark:border-white/[0.06] gap-3">
                <div class="flex items-center gap-1">
                  <button
                    v-for="lang in (['python', 'cpp', 'java', 'javascript'] as const)"
                    :key="lang"
                    class="lang-tab"
                    :class="activeLang === lang ? 'lang-tab--active' : ''"
                    @click="activeLang = lang"
                  >
                    {{ lang === 'cpp' ? 'C++' : lang === 'javascript' ? 'JS' : lang.charAt(0).toUpperCase() + lang.slice(1) }}
                  </button>
                </div>

                <button
                  class="run-btn"
                  :disabled="isRunningDemo"
                  @click="runDemoCode"
                >
                  <span class="material-symbols-outlined text-[16px]" :class="{ 'animate-spin': isRunningDemo }">
                    {{ isRunningDemo ? 'refresh' : 'play_arrow' }}
                  </span>
                  <span>{{ isRunningDemo ? 'Running…' : 'Run' }}</span>
                </button>
              </div>

              <!-- Code -->
              <div class="p-5 font-mono text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 bg-white dark:bg-[#0a0a0d] overflow-x-auto min-h-[200px]">
                <pre><code>{{ codeSnippets[activeLang] }}</code></pre>
              </div>

              <!-- Output -->
              <div class="px-5 py-3 bg-slate-50 dark:bg-[#18181b] border-t border-slate-200/60 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                <div class="flex items-center gap-2">
                  <span class="text-slate-400 font-semibold">Output:</span>
                  <span v-if="demoOutputReady" class="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">check_circle</span>
                    Accepted · [0, 1] · 14ms
                  </span>
                  <span v-else class="text-amber-500 animate-pulse">Running…</span>
                </div>
                <span class="text-slate-400 text-[11px]">Memory: 14.4 MB</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- HOW IT WORKS (#how-it-works)                                  -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <section id="how-it-works" class="py-20 md:py-28">
        <div class="max-w-[1100px] mx-auto px-5 sm:px-8">
          <div class="text-center max-w-2xl mx-auto mb-16">
            <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              How it works
            </h2>
            <p class="text-base text-slate-500 dark:text-slate-400">
              From setup to results in four simple steps.
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div
              v-for="(s, i) in steps"
              :key="i"
              class="step-card"
            >
              <span class="text-4xl font-black text-primary/20 dark:text-primary/25 font-mono mb-3 block">{{ s.num }}</span>
              <h3 class="text-base font-bold text-slate-900 dark:text-white mb-2">{{ s.title }}</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{{ s.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- LIVE EXAMS (#contests)                                        -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <section id="contests" class="py-20 md:py-28 bg-slate-50/80 dark:bg-[#0c0c0f] border-y border-slate-200/60 dark:border-white/[0.04]">
        <div class="max-w-[1100px] mx-auto px-5 sm:px-8">
          <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                Your upcoming exams
              </h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Jump into an active assessment or check what's coming next.
              </p>
            </div>
            <router-link
              v-if="authStore.isAuthenticated"
              to="/dashboard"
              class="text-sm font-semibold text-primary dark:text-primary hover:underline no-underline flex items-center gap-1"
            >
              View dashboard
              <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </router-link>
          </div>

          <!-- Loading -->
          <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div v-for="i in 3" :key="i" class="h-48 rounded-2xl bg-white dark:bg-[#18181b] border border-slate-200/60 dark:border-white/[0.06] animate-pulse" />
          </div>

          <!-- Exam Cards -->
          <div v-else-if="examStore.activeExams.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div
              v-for="exam in examStore.activeExams"
              :key="exam.id"
              class="exam-card group"
            >
              <div class="flex items-center justify-between mb-4">
                <span
                  v-if="dayjs(exam.startTime).valueOf() > Date.now() + examStore.serverDrift"
                  class="status-pill status-pill--upcoming"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Upcoming
                </span>
                <span v-else class="status-pill status-pill--live">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live
                </span>
                <span class="text-xs font-mono text-slate-400 dark:text-slate-500">{{ exam.durationMinutes }}m</span>
              </div>

              <h3 class="text-base font-bold text-slate-900 dark:text-white mb-1 group-hover:text-primary dark:group-hover:text-primary transition-colors">
                {{ exam.title }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mb-6">{{ formatSchedule(exam) }}</p>

              <div class="mt-auto pt-4 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between">
                <span class="text-xs text-slate-400 dark:text-slate-500">
                  {{ exam.allowedLanguages?.length || 'All' }} languages
                </span>
                <button
                  class="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                  @click="enterContest(exam)"
                >
                  Enter
                  <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-16 px-8 bg-white dark:bg-[#18181b] border border-slate-200/60 dark:border-white/[0.06] rounded-2xl max-w-md mx-auto">
            <span class="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-4 block">event_available</span>
            <h3 class="text-base font-bold text-slate-900 dark:text-white mb-2">No exams scheduled</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">Check back soon or head to your dashboard.</p>
            <router-link
              to="/dashboard"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all no-underline"
            >
              Go to Dashboard
              <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </router-link>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- FAIR PLAY RULES (#rules)                                      -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <section id="rules" class="py-20 md:py-28">
        <div class="max-w-[1100px] mx-auto px-5 sm:px-8">
          <div class="text-center max-w-2xl mx-auto mb-14">
            <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              Fair play guidelines
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Simple rules to keep every exam honest and equal.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            <div
              v-for="(rule, i) in rules"
              :key="i"
              class="rule-card"
            >
              <span class="w-7 h-7 rounded-lg bg-primary/8 dark:bg-primary/10 text-primary dark:text-primary text-xs font-bold font-mono flex items-center justify-center flex-shrink-0">
                {{ rule.num }}
              </span>
              <div>
                <h4 class="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">{{ rule.title }}</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{{ rule.desc }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- BOTTOM CTA                                                    -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <section class="py-20 md:py-24">
        <div class="max-w-[1100px] mx-auto px-5 sm:px-8">
          <div class="cta-card">
            <h2 class="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Ready to run your first exam?
            </h2>
            <p class="text-base text-white/70 mb-8 max-w-md mx-auto">
              Set up in minutes. No credit card required.
            </p>
            <div class="flex flex-wrap items-center justify-center gap-3">
              <router-link
                v-if="!authStore.isAuthenticated"
                to="/register"
                class="px-6 py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-semibold text-sm transition-all active:scale-95 cursor-pointer no-underline"
              >
                Get Started Free
              </router-link>
              <router-link
                v-else
                to="/dashboard"
                class="px-6 py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-semibold text-sm transition-all active:scale-95 cursor-pointer no-underline"
              >
                Go to Dashboard
              </router-link>
              <button
                class="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition-all cursor-pointer"
                @click="scrollTo('sandbox')"
              >
                Try the editor
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- ── Footer ─────────────────────────────────────────────────────── -->
    <footer class="relative z-10 border-t border-slate-200/60 dark:border-white/[0.04] py-8 px-5 sm:px-8 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md">
      <div class="max-w-[1100px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div class="flex items-center gap-3">
          <img
            :src="brand.logoPath"
            :alt="brand.appName"
            class="h-5 object-contain"
            style="filter: drop-shadow(0 0 4px rgb(var(--color-primary) / 0.4))"
          />
          <span class="font-semibold text-slate-700 dark:text-slate-300">{{ brand.appName }}</span>
          <span class="text-slate-300 dark:text-slate-700">·</span>
          <span>© {{ new Date().getFullYear() }}</span>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500 text-[11px] font-medium">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            All systems operational
          </div>
          <span class="text-slate-300 dark:text-slate-700">·</span>
          <router-link to="/admin/login" class="hover:text-primary dark:hover:text-primary transition-colors">
            Admin
          </router-link>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ── Hero Background ── */
.hero-gradient {
  position: absolute;
  top: -40%;
  left: 50%;
  transform: translateX(-50%);
  width: 900px;
  height: 900px;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(var(--color-primary) / 0.08) 0%, transparent 70%);
  pointer-events: none;
}
.dark .hero-gradient {
  background: radial-gradient(circle, rgb(var(--color-primary) / 0.12) 0%, transparent 70%);
}

/* ── Typography ── */
.hero-gradient-text {
  background: linear-gradient(135deg, rgb(var(--color-primary)) 0%, #a855f7 50%, #6366f1 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* ── Pill ── */
.pill {
  @apply inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium
         bg-slate-100 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.06]
         text-slate-600 dark:text-slate-400;
}

/* ── Nav Links ── */
.nav-link {
  @apply text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer;
}
.mobile-nav-link {
  @apply text-left text-sm font-medium py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer;
}

/* ── Buttons ── */
.btn-primary {
  @apply inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-primary hover:bg-primary/90
         text-white font-semibold text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30
         transition-all active:scale-[0.97] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed;
}
.btn-ghost {
  @apply inline-flex items-center gap-2 h-11 px-5 rounded-xl
         text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white
         font-medium text-sm transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.04];
}

/* ── Hero Mockup ── */
.hero-mockup {
  @apply relative rounded-2xl overflow-hidden border border-slate-200/60 dark:border-white/[0.08] shadow-2xl shadow-slate-200/50 dark:shadow-black/30;
}
.hero-mockup-glow {
  @apply absolute -inset-4 rounded-3xl pointer-events-none;
  background: radial-gradient(ellipse at 50% 0%, rgb(var(--color-primary) / 0.12), transparent 70%);
  filter: blur(40px);
}

/* ── Feature Cards ── */
.feature-card {
  @apply p-7 rounded-2xl bg-white dark:bg-[#18181b]/80 border border-slate-200/60 dark:border-white/[0.06]
         transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/40 dark:hover:shadow-none
         hover:border-slate-300 dark:hover:border-white/[0.1];
}
.extra-feature-card {
  @apply p-5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/40 dark:border-white/[0.04]
         flex flex-col;
}

/* ── Demo Editor ── */
.demo-editor {
  @apply rounded-2xl overflow-hidden border border-slate-200/60 dark:border-white/[0.08] shadow-xl shadow-slate-200/30 dark:shadow-black/20;
}
.lang-tab {
  @apply px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
         text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04];
}
.lang-tab--active {
  @apply bg-primary text-white hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white shadow-sm;
}
.run-btn {
  @apply px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold
         flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95
         disabled:opacity-50 disabled:cursor-not-allowed;
}

/* ── Step Cards ── */
.step-card {
  @apply p-6 rounded-2xl bg-white dark:bg-[#18181b]/60 border border-slate-200/60 dark:border-white/[0.04];
}

/* ── Exam Cards ── */
.exam-card {
  @apply flex flex-col p-6 rounded-2xl bg-white dark:bg-[#18181b]/80 border border-slate-200/60 dark:border-white/[0.06]
         hover:border-primary/30 dark:hover:border-primary/20 transition-all duration-200;
}
.status-pill {
  @apply inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider;
}
.status-pill--live {
  @apply bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400;
}
.status-pill--upcoming {
  @apply bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400;
}

/* ── Rule Cards ── */
.rule-card {
  @apply flex items-start gap-3 p-5 rounded-xl bg-white dark:bg-[#18181b]/60 border border-slate-200/60 dark:border-white/[0.04];
}

/* ── CTA Card ── */
.cta-card {
  @apply relative text-center p-12 md:p-16 rounded-3xl overflow-hidden;
  background: linear-gradient(145deg, rgb(var(--color-primary)) 0%, #4c1d95 50%, #1e1b4b 100%);
}

/* ── Animations ── */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.6s ease-out both;
}
.animate-fade-in-up {
  animation: fade-in-up 0.7s ease-out both;
}
.delay-1 { animation-delay: 0.1s; }
.delay-2 { animation-delay: 0.2s; }
.delay-3 { animation-delay: 0.35s; }

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
