<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

const props = withDefaults(defineProps<{
  /** Unique HTML id so multiple instances on different pages don't conflict */
  dropdownId?: string;
}>(), {
  dropdownId: 'user-profile-dropdown-root',
});

const router = useRouter();
const authStore = useAuthStore();

const userMenuOpen = ref(false);

function handleLogout() {
  userMenuOpen.value = false;
  authStore.logout();
  void router.push('/login');
}

function onDocClick(e: MouseEvent) {
  const el = document.getElementById(props.dropdownId);
  if (el && !el.contains(e.target as Node)) {
    userMenuOpen.value = false;
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick));
onUnmounted(() => document.removeEventListener('mousedown', onDocClick));
</script>

<template>
  <div :id="dropdownId" class="relative flex items-center">
    <!-- Avatar trigger button -->
    <button
      class="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
      title="Account profile"
      @click="userMenuOpen = !userMenuOpen"
    >
      <div class="profile-avatar">
        {{ authStore.user?.firstName?.charAt(0) || 'U' }}
      </div>
      <div class="hidden sm:flex flex-col text-left">
        <span class="text-[12px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">
          {{ authStore.user?.firstName }} {{ authStore.user?.lastName }}
        </span>
        <span v-if="authStore.user?.rollNumber" class="text-[10px] text-slate-500 font-mono leading-tight">
          {{ authStore.user?.rollNumber }}
        </span>
        <span v-else class="text-[10px] text-slate-500 truncate max-w-[140px] leading-tight">
          {{ authStore.user?.email }}
        </span>
      </div>
      <span class="material-symbols-outlined text-[16px] text-slate-400">
        arrow_drop_down
      </span>
    </button>

    <!-- Dropdown menu -->
    <Transition name="profile-dropdown">
      <div v-if="userMenuOpen" class="profile-menu">
        <!-- Header: name + email + role badge -->
        <div class="px-3.5 py-3 border-b border-slate-100 dark:border-white/[0.06]">
          <p class="text-xs font-bold text-slate-900 dark:text-white truncate">
            {{ authStore.user?.firstName }} {{ authStore.user?.lastName }}
          </p>
          <p class="text-[11px] text-slate-500 truncate mt-0.5">
            {{ authStore.user?.email }}
          </p>
          <span
            class="inline-block mt-1.5 px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-extrabold uppercase"
          >
            {{ authStore.user?.role || 'STUDENT' }}
          </span>
        </div>

        <!-- Navigation links -->
        <div class="py-1">
          <router-link
            to="/"
            class="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors no-underline"
            @click="userMenuOpen = false"
          >
            <span class="material-symbols-outlined text-[16px] text-primary">home</span>
            Home
          </router-link>

          <router-link
            to="/dashboard"
            class="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors no-underline"
            @click="userMenuOpen = false"
          >
            <span class="material-symbols-outlined text-[16px] text-primary">dashboard</span>
            Student Dashboard
          </router-link>

          <router-link
            v-if="authStore.user?.role === 'ADMIN' || authStore.user?.role === 'SUPER_ADMIN'"
            to="/admin/dashboard"
            class="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors no-underline"
            @click="userMenuOpen = false"
          >
            <span class="material-symbols-outlined text-[16px] text-amber-400">admin_panel_settings</span>
            Admin Panel
          </router-link>
        </div>

        <!-- Sign out -->
        <div class="pt-1 border-t border-slate-100 dark:border-white/[0.06]">
          <button
            class="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-500 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
            @click="handleLogout"
          >
            <span class="material-symbols-outlined text-[16px]">logout</span>
            Sign Out
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.profile-avatar {
  @apply w-7 h-7 rounded-md bg-primary/15 text-primary
         flex items-center justify-center text-[11px] font-bold flex-shrink-0;
}

.profile-menu {
  @apply absolute right-0 top-full mt-2 w-56
         bg-white dark:bg-[#161b22]
         border border-slate-200 dark:border-white/[0.08] rounded-xl
         shadow-2xl z-50 overflow-hidden;
}

/* Dropdown animation */
.profile-dropdown-enter-active,
.profile-dropdown-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.profile-dropdown-enter-from,
.profile-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
