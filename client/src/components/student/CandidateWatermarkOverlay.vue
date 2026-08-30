<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();

const watermarkText = computed(() => {
  const u = authStore.user;
  const fullName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
  const name = fullName || u?.email || 'Candidate';
  const roll = u?.rollNumber || `ID-${u?.id || '00'}`;
  return `${name} · ${roll}`;
});

// Generates enough items to densely cover any screen diagonally
const items = computed(() => Array.from({ length: 96 }, (_, i) => i));
</script>

<template>
  <div
    class="fixed inset-0 pointer-events-none select-none z-30 overflow-hidden flex flex-wrap items-center justify-around gap-x-10 gap-y-8 p-4 opacity-[0.06] dark:opacity-[0.08] transform -rotate-12 scale-125"
    aria-hidden="true"
  >
    <div
      v-for="item in items"
      :key="item"
      class="text-[10px] md:text-[11px] font-bold font-mono tracking-wider text-slate-800 dark:text-white whitespace-nowrap"
    >
      {{ watermarkText }}
    </div>
  </div>
</template>
