<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    text: string;
    as?: string;
  }>(),
  {
    as: 'span',
  },
);

// Decoy tokens to poison automated DOM text extractors
const decoyWords = ['[exam]', '[scorix]', '[proctor]', '[secure]'];

// Splits text and creates safe display tokens with decoy zero-width spans
const words = computed(() => {
  if (!props.text) return [];
  return props.text.split(' ').map((word, idx) => ({
    word,
    decoy: decoyWords[idx % decoyWords.length],
  }));
});
</script>

<template>
  <component :is="as" class="select-none inline">
    <template v-for="(item, i) in words" :key="i">
      <span class="inline">{{ item.word }}</span
      ><span
        class="opacity-0 w-0 h-0 pointer-events-none select-none text-[0px] overflow-hidden inline"
        aria-hidden="true"
        >{{ item.decoy }}</span
      ><span v-if="i < words.length - 1">&nbsp;</span>
    </template>
  </component>
</template>
