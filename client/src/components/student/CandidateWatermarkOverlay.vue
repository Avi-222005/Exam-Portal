<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useAuthStore } from '../../stores/auth';
import dayjs from 'dayjs';

const authStore = useAuthStore();

const currentTime = ref(dayjs().format('HH:mm:ss'));
let timer: number | null = null;

onMounted(() => {
  timer = window.setInterval(() => {
    currentTime.value = dayjs().format('HH:mm:ss');
  }, 1000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const watermarkText = computed(() => {
  const u = authStore.user;
  const fullName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
  const name = fullName || u?.email || 'Candidate';
  const roll = u?.rollNumber || `ID-${u?.id || '00'}`;
  return `${name} · ${roll} · ${currentTime.value}`;
});

// Grid rows/cols to cover the entire screen
const items = computed(() => Array.from({ length: 24 }, (_, i) => i));
</script>

<template>
  <div
    class="fixed inset-0 pointer-events-none select-none z-30 overflow-hidden flex flex-wrap items-center justify-around gap-16 p-8 opacity-[0.045] dark:opacity-[0.065] transform -rotate-12 scale-110"
    aria-hidden="true"
  >
    <div
      v-for="item in items"
      :key="item"
      class="text-xs md:text-sm font-black font-mono tracking-widest text-slate-900 dark:text-white whitespace-nowrap"
    >
      {{ watermarkText }}
    </div>
  </div>
</template>
