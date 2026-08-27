<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import type { User } from '../../types';
import api from '../../services/api';
import { brand } from '../../config/brand';

interface AuthResponse {
  accessToken?: string;
  user?: User;
}

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const mode = ref<'login' | 'signup'>((route.name === 'register' ? 'signup' : 'login'));
const email = ref('');
const password = ref('');
const rollNumber = ref('');
const firstName = ref('');
const lastName = ref('');
const qaRoleOptIn = ref(false);
const error = ref('');
const loading = ref(false);

const redirectTarget = computed(() => {
  const q = route.query.redirect;
  return typeof q === 'string' && q.startsWith('/') ? q : '/dashboard';
});

onMounted(() => {
  if (authStore.isAuthenticated) {
    void router.replace(redirectTarget.value);
  }
});

async function submitLogin() {
  error.value = '';
  if (!email.value.trim() || !password.value) {
    error.value = 'Email and password are required.';
    return;
  }

  loading.value = true;
  try {
    const { data } = await api.post<AuthResponse>('/auth/login', {
      email: email.value.trim(),
      password: password.value,
    });

    if (!data.accessToken) throw new Error('No token received');
    authStore.setToken(data.accessToken);

    if (data.user) {
      authStore.setUser(data.user);
    } else {
      const me = await api.get<User>('/auth/me');
      authStore.setUser(me.data);
    }

    void router.replace(redirectTarget.value);
  } catch (err: unknown) {
    const res = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
    if (res?.status === 401) {
      error.value = 'Invalid email or password.';
    } else if (res?.data?.message) {
      error.value = Array.isArray(res.data.message) ? res.data.message.join(', ') : res.data.message;
    } else {
      error.value = 'Login failed. Please try again.';
    }
  } finally {
    loading.value = false;
  }
}

async function submitSignup() {
  error.value = '';
  if (
    !rollNumber.value.trim() ||
    !firstName.value.trim() ||
    !lastName.value.trim() ||
    !email.value.trim() ||
    !password.value
  ) {
    error.value = 'Please fill in all required fields.';
    return;
  }

  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters long.';
    return;
  }

  loading.value = true;
  try {
    const { data } = await api.post<AuthResponse>('/auth/register', {
      rollNumber: rollNumber.value.trim(),
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      email: email.value.trim(),
      password: password.value,
      qaRoleOptIn: qaRoleOptIn.value,
    });

    if (data.accessToken) {
      authStore.setToken(data.accessToken);
      if (data.user) authStore.setUser(data.user);
      void router.replace(redirectTarget.value);
    } else {
      // Fallback: log in with the new credentials
      const loginRes = await api.post<AuthResponse>('/auth/login', {
        email: email.value.trim(),
        password: password.value,
      });
      if (loginRes.data.accessToken) {
        authStore.setToken(loginRes.data.accessToken);
        if (loginRes.data.user) authStore.setUser(loginRes.data.user);
        void router.replace(redirectTarget.value);
      }
    }
  } catch (err: unknown) {
    const res = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
    if (res?.status === 409) {
      error.value = 'An account with this email or roll number already exists.';
    } else if (res?.data?.message) {
      error.value = Array.isArray(res.data.message) ? res.data.message.join(', ') : res.data.message;
    } else {
      error.value = 'Registration failed. Please check your inputs and try again.';
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-root">
    <!-- Background grid + glow -->
    <div class="bg-grid" aria-hidden="true" />
    <div class="bg-glow" aria-hidden="true" />

    <!-- Back to home navigation -->
    <div class="absolute top-6 left-6 z-20">
      <router-link
        to="/"
        class="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Home
      </router-link>
    </div>

    <div class="card">
      <!-- Logo + heading -->
      <div class="card-header">
        <router-link to="/">
          <img
            :src="brand.logoPath"
            :alt="brand.appName"
            class="logo"
            style="filter: drop-shadow(0 0 12px rgb(var(--color-primary) / 0.6))"
          />
        </router-link>
        <p class="subtitle">Student Examination Portal</p>
      </div>

      <!-- Mode tabs -->
      <div class="tabs">
        <button
          class="tab"
          :class="mode === 'login' ? 'tab-active' : 'tab-inactive'"
          @click="
            mode = 'login';
            error = '';
          "
        >
          Sign In
        </button>
        <button
          class="tab"
          :class="mode === 'signup' ? 'tab-active' : 'tab-inactive'"
          @click="
            mode = 'signup';
            error = '';
          "
        >
          Create Account
        </button>
      </div>

      <!-- Error banner -->
      <div v-if="error" class="error-banner" role="alert">
        <span class="material-symbols-outlined error-icon">error</span>
        <span>{{ error }}</span>
      </div>

      <!-- Login form -->
      <form v-if="mode === 'login'" class="form" @submit.prevent="submitLogin">
        <div class="field">
          <label for="login-email" class="label">Email Address</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="student@example.com"
            class="input"
            required
          />
        </div>

        <div class="field">
          <label for="login-password" class="label">Password</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            class="input"
            required
          />
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          <span
            v-if="loading"
            class="material-symbols-outlined text-[16px] animate-spin"
            >progress_activity</span
          >
          {{ loading ? 'Signing In…' : 'Sign In to Portal' }}
        </button>
      </form>

      <!-- Signup form -->
      <form v-else class="form" @submit.prevent="submitSignup">
        <div class="field">
          <label for="signup-roll" class="label">Roll Number / Student ID</label>
          <input
            id="signup-roll"
            v-model="rollNumber"
            type="text"
            placeholder="e.g. CS2026001"
            class="input"
            required
          />
        </div>

        <div class="field-row">
          <div class="field">
            <label for="signup-first" class="label">First Name</label>
            <input
              id="signup-first"
              v-model="firstName"
              type="text"
              placeholder="John"
              class="input"
              required
            />
          </div>
          <div class="field">
            <label for="signup-last" class="label">Last Name</label>
            <input
              id="signup-last"
              v-model="lastName"
              type="text"
              placeholder="Doe"
              class="input"
              required
            />
          </div>
        </div>

        <div class="field">
          <label for="signup-email" class="label">Email Address</label>
          <input
            id="signup-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="student@example.com"
            class="input"
            required
          />
        </div>

        <div class="field">
          <label for="signup-password" class="label">Password (min 6 chars)</label>
          <input
            id="signup-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            placeholder="••••••••"
            class="input"
            minlength="6"
            required
          />
        </div>

        <div class="flex items-start gap-2.5 pt-1 text-xs text-slate-400">
          <input
            id="qa-opt-in"
            v-model="qaRoleOptIn"
            type="checkbox"
            class="mt-0.5 rounded border-slate-700 bg-slate-800 text-primary focus:ring-primary cursor-pointer"
          />
          <label for="qa-opt-in" class="cursor-pointer select-none leading-relaxed">
            Consider me for QA Engineering opportunities if not selected for the primary developer track.
          </label>
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          <span
            v-if="loading"
            class="material-symbols-outlined text-[16px] animate-spin"
            >progress_activity</span
          >
          {{ loading ? 'Creating Account…' : 'Register & Enter Portal' }}
        </button>
      </form>

      <!-- Footer navigation -->
      <div class="card-footer">
        <p class="text-xs text-slate-500 text-center">
          Administrator?
          <router-link to="/admin/login" class="text-primary hover:underline ml-1">
            Admin Panel Login
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-root {
  @apply relative min-h-screen flex items-center justify-center p-4
         bg-[#0d1117] font-display text-slate-100 overflow-hidden;
}

/* ── Background decoration ── */
.bg-grid {
  @apply absolute inset-0 pointer-events-none;
  background-image: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.04) 1px,
    transparent 1px
  );
  background-size: 24px 24px;
}

.bg-glow {
  @apply absolute pointer-events-none;
  top: 30%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgb(var(--color-primary) / 0.12) 0%,
    transparent 70%
  );
}

/* ── Card ── */
.card {
  @apply relative w-full max-w-md bg-[#161b22]/90 border border-slate-800
         rounded-2xl p-8 shadow-2xl backdrop-blur-xl flex flex-col gap-6 z-10;
}

.card-header {
  @apply flex flex-col items-center gap-2;
}

.logo {
  @apply h-9 object-contain;
}

.subtitle {
  @apply text-xs font-semibold uppercase tracking-widest text-slate-400;
}

/* ── Mode tabs ── */
.tabs {
  @apply flex p-1 bg-slate-900/80 rounded-xl border border-slate-800;
}

.tab {
  @apply flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer;
}

.tab-active {
  @apply bg-primary text-white shadow-lg;
}

.tab-inactive {
  @apply text-slate-400 hover:text-slate-200;
}

/* ── Error banner ── */
.error-banner {
  @apply flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border border-red-500/30
         rounded-xl text-xs text-red-400 font-medium;
}

.error-icon {
  @apply text-[16px] text-red-400 flex-shrink-0;
}

/* ── Form ── */
.form {
  @apply flex flex-col gap-4;
}

.field {
  @apply flex flex-col gap-1.5 flex-1;
}

.field-row {
  @apply flex gap-3;
}

.label {
  @apply text-xs font-medium text-slate-300;
}

.input {
  @apply w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700/80 rounded-xl
         text-sm text-slate-100 placeholder-slate-500
         focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
         transition-all;
}

.submit-btn {
  @apply mt-2 w-full py-3 px-4 bg-primary hover:bg-primary/90 text-white font-bold
         text-sm rounded-xl shadow-lg shadow-primary/20 transition-all
         active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
         flex items-center justify-center gap-2 cursor-pointer;
}

.card-footer {
  @apply pt-2 border-t border-slate-800/80;
}
</style>
