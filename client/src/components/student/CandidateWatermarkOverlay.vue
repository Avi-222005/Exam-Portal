<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();

const candidateInfo = computed(() => {
  const u = authStore.user;
  const fullName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
  const name = fullName || u?.email || 'Candidate';
  const roll = u?.rollNumber || `ID-${u?.id || '00'}`;
  return `${name} · ${roll}`;
});

// A row of repeated name and roll number in continuous pattern
const watermarkRow = computed(() => {
  const item = candidateInfo.value;
  return Array.from({ length: 8 }, () => item).join('   ·   ');
});

// Multi-row array to ensure full diagonal coverage across all viewports
const rows = computed(() => Array.from({ length: 28 }, (_, i) => i));
</script>

<template>
  <div
    class="fixed inset-0 pointer-events-none select-none z-30 overflow-hidden flex flex-col justify-around gap-10 p-4 opacity-[0.045] dark:opacity-[0.065] transform -rotate-12 scale-125"
    aria-hidden="true"
  >
    <div
      v-for="row in rows"
      :key="row"
      class="text-xs md:text-sm font-black font-mono tracking-widest text-slate-900 dark:text-white whitespace-nowrap overflow-hidden flex"
      :style="{ transform: row % 2 === 0 ? 'translateX(-60px)' : 'translateX(60px)' }"
    >
      <span>{{ watermarkRow }}</span>
    </div>
  </div>
</template>
