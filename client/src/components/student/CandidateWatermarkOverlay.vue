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

// Generates enough items to densely cover any 4K/FullHD/tablet screen diagonally
const items = computed(() => Array.from({ length: 48 }, (_, i) => i));
</script>

<template>
  <div
    class="fixed inset-0 pointer-events-none select-none z-30 overflow-hidden flex flex-wrap items-center justify-around gap-x-20 gap-y-16 p-8 opacity-[0.07] dark:opacity-[0.10] transform -rotate-12 scale-125"
    aria-hidden="true"
  >
    <div
      v-for="item in items"
      :key="item"
      class="text-xs md:text-sm font-black font-mono tracking-widest text-slate-800 dark:text-white whitespace-nowrap"
    >
      {{ watermarkText }}
    </div>
  </div>
</template>
