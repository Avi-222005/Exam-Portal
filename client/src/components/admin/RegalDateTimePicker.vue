<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue?: string; // Format: "YYYY-MM-DDTHH:mm" or ISO
    placeholder?: string;
    disabled?: boolean;
    hasError?: boolean;
  }>(),
  {
    modelValue: '',
    placeholder: 'Select date & time…',
    disabled: false,
    hasError: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  change: [value: string];
}>();

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);

// Internal working state
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth()); // 0-indexed
const selectedDay = ref<number | null>(null);
const selectedHour12 = ref(12); // 1 - 12
const selectedMinute = ref(0); // 0 - 59
const selectedPeriod = ref<'AM' | 'PM'>('AM');

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Sync from modelValue prop
function parseModelValue(val?: string) {
  if (!val) {
    const now = new Date();
    currentYear.value = now.getFullYear();
    currentMonth.value = now.getMonth();
    selectedDay.value = null;
    let h = now.getHours();
    selectedPeriod.value = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    selectedHour12.value = h;
    selectedMinute.value = Math.floor(now.getMinutes() / 5) * 5;
    return;
  }

  const d = new Date(val);
  if (isNaN(d.getTime())) return;

  currentYear.value = d.getFullYear();
  currentMonth.value = d.getMonth();
  selectedDay.value = d.getDate();

  let hours = d.getHours();
  selectedPeriod.value = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  selectedHour12.value = hours;
  selectedMinute.value = d.getMinutes();
}

watch(() => props.modelValue, (newVal) => {
  parseModelValue(newVal);
}, { immediate: true });

// Formatted display value
const displayValue = computed(() => {
  if (!props.modelValue) return '';
  const d = new Date(props.modelValue);
  if (isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const year = d.getFullYear();

  let hours = d.getHours();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  const mins = pad(d.getMinutes());
  return `${month}/${day}/${year} ${pad(hours)}:${mins} ${period}`;
});

// Calendar grid days computation
interface CalendarCell {
  day: number;
  monthOffset: number; // -1 = prev month, 0 = current, 1 = next
  date: Date;
  isToday: boolean;
  isSelected: boolean;
}

const calendarGrid = computed<CalendarCell[]>(() => {
  const cells: CalendarCell[] = [];
  const year = currentYear.value;
  const month = currentMonth.value;

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  // Leading days from prev month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    cells.push({
      day,
      monthOffset: -1,
      date: new Date(year, month - 1, day),
      isToday: false,
      isSelected: false,
    });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = isCurrentMonth && today.getDate() === d;
    const isSelected = selectedDay.value === d;
    cells.push({
      day: d,
      monthOffset: 0,
      date: new Date(year, month, d),
      isToday,
      isSelected,
    });
  }

  // Trailing days from next month to complete 6 rows (42 cells) or 5 rows
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let n = 1; n <= remaining; n++) {
    cells.push({
      day: n,
      monthOffset: 1,
      date: new Date(year, month + 1, n),
      isToday: false,
      isSelected: false,
    });
  }

  return cells;
});

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
}

function selectDay(cell: CalendarCell) {
  if (cell.monthOffset === -1) {
    prevMonth();
  } else if (cell.monthOffset === 1) {
    nextMonth();
  }
  selectedDay.value = cell.day;
  emitDateTime();
}

function selectHour(h: number) {
  selectedHour12.value = h;
  if (!selectedDay.value) selectedDay.value = new Date().getDate();
  emitDateTime();
}

function selectMinute(m: number) {
  selectedMinute.value = m;
  if (!selectedDay.value) selectedDay.value = new Date().getDate();
  emitDateTime();
}

function togglePeriod(p: 'AM' | 'PM') {
  selectedPeriod.value = p;
  if (!selectedDay.value) selectedDay.value = new Date().getDate();
  emitDateTime();
}

function emitDateTime() {
  const day = selectedDay.value || new Date().getDate();
  let hours24 = selectedHour12.value % 12;
  if (selectedPeriod.value === 'PM') hours24 += 12;

  const pad = (n: number) => String(n).padStart(2, '0');
  const str = `${currentYear.value}-${pad(currentMonth.value + 1)}-${pad(day)}T${pad(hours24)}:${pad(selectedMinute.value)}`;
  emit('update:modelValue', str);
  emit('change', str);
}

function setNow() {
  const now = new Date();
  currentYear.value = now.getFullYear();
  currentMonth.value = now.getMonth();
  selectedDay.value = now.getDate();

  let hours = now.getHours();
  selectedPeriod.value = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  selectedHour12.value = hours;
  selectedMinute.value = now.getMinutes();

  emitDateTime();
}

function clear() {
  selectedDay.value = null;
  emit('update:modelValue', '');
  emit('change', '');
  isOpen.value = false;
}

function toggleDropdown() {
  if (props.disabled) return;
  if (isOpen.value) {
    isOpen.value = false;
  } else {
    parseModelValue(props.modelValue);
    isOpen.value = true;
  }
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

const minutePresets = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const hourPresets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
</script>

<template>
  <div ref="containerRef" class="relative w-full">
    <!-- Trigger Input -->
    <div
      class="flex items-center justify-between w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs transition-all cursor-pointer select-none"
      :class="[
        hasError
          ? 'border-red-500 ring-1 ring-red-500/20'
          : isOpen
            ? 'border-primary ring-2 ring-primary/20 shadow-xs'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ]"
      @click="toggleDropdown"
    >
      <span
        :class="displayValue ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400 dark:text-slate-500'"
      >
        {{ displayValue || placeholder }}
      </span>
      <div class="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
        <span class="material-symbols-outlined text-[18px]">calendar_month</span>
      </div>
    </div>

    <!-- Dropdown Modal / Picker -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="transform scale-95 opacity-0 -translate-y-1"
      enter-to-class="transform scale-100 opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="transform scale-100 opacity-100 translate-y-0"
      leave-to-class="transform scale-95 opacity-0 -translate-y-1"
    >
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="absolute left-0 top-full mt-2 z-50 bg-white dark:bg-[#12131a] border border-slate-200 dark:border-white/[0.1] rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row gap-4 w-full sm:w-[480px] max-w-[calc(100vw-32px)] backdrop-blur-xl animate-in"
      >
        <!-- Left Side: Date Picker -->
        <div class="flex-1 flex flex-col gap-3 min-w-[220px]">
          <!-- Month & Year Navigation -->
          <div class="flex items-center justify-between px-1">
            <span class="text-xs font-bold text-slate-900 dark:text-white">
              {{ monthNames[currentMonth] }} {{ currentYear }}
            </span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                @click="prevMonth"
              >
                <span class="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button
                type="button"
                class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                @click="nextMonth"
              >
                <span class="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>

          <!-- Days Header -->
          <div class="grid grid-cols-7 gap-1 text-center">
            <span
              v-for="dayName in daysOfWeek"
              :key="dayName"
              class="text-[11px] font-semibold text-slate-400 dark:text-slate-500 py-1"
            >
              {{ dayName }}
            </span>
          </div>

          <!-- Calendar Grid -->
          <div class="grid grid-cols-7 gap-1">
            <button
              v-for="(cell, index) in calendarGrid"
              :key="index"
              type="button"
              class="h-8 rounded-lg flex items-center justify-center text-xs transition-all font-medium cursor-pointer"
              :class="[
                cell.monthOffset !== 0
                  ? 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                  : cell.isSelected
                    ? 'bg-primary text-white font-bold shadow-md shadow-primary/30 scale-105'
                    : cell.isToday
                      ? 'text-primary font-bold border border-primary/40 bg-primary/5 hover:bg-primary/10'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]',
              ]"
              @click="selectDay(cell)"
            >
              {{ cell.day }}
            </button>
          </div>

          <!-- Footer Actions -->
          <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/[0.06] mt-auto">
            <button
              type="button"
              class="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
              @click="setNow"
            >
              Today
            </button>
            <button
              type="button"
              class="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              @click="clear"
            >
              Clear
            </button>
          </div>
        </div>

        <!-- Divider -->
        <div class="hidden sm:block w-px bg-slate-200 dark:bg-white/[0.08]"></div>

        <!-- Right Side: Time Picker -->
        <div class="flex flex-col gap-3 min-w-[140px] pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-white/[0.06]">
          <span class="text-xs font-bold text-slate-900 dark:text-white px-1">
            Time Selection
          </span>

          <!-- AM / PM Selector -->
          <div class="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-white/[0.06]">
            <button
              type="button"
              class="py-1 text-xs font-bold rounded-lg transition-all cursor-pointer"
              :class="selectedPeriod === 'AM' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
              @click="togglePeriod('AM')"
            >
              AM
            </button>
            <button
              type="button"
              class="py-1 text-xs font-bold rounded-lg transition-all cursor-pointer"
              :class="selectedPeriod === 'PM' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
              @click="togglePeriod('PM')"
            >
              PM
            </button>
          </div>

          <!-- Hours & Minutes Columns -->
          <div class="flex gap-2">
            <!-- Hours Column -->
            <div class="flex-1 flex flex-col gap-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase text-center">Hour</span>
              <div class="max-h-[140px] overflow-y-auto flex flex-col gap-1 pr-1 scrollbar-thin">
                <button
                  v-for="h in hourPresets"
                  :key="h"
                  type="button"
                  class="py-1 rounded-md text-xs font-medium text-center transition-colors cursor-pointer"
                  :class="selectedHour12 === h ? 'bg-primary/10 dark:bg-primary/20 text-primary font-bold border border-primary/30' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
                  @click="selectHour(h)"
                >
                  {{ String(h).padStart(2, '0') }}
                </button>
              </div>
            </div>

            <!-- Minutes Column -->
            <div class="flex-1 flex flex-col gap-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase text-center">Minute</span>
              <div class="max-h-[140px] overflow-y-auto flex flex-col gap-1 pr-1 scrollbar-thin">
                <button
                  v-for="m in minutePresets"
                  :key="m"
                  type="button"
                  class="py-1 rounded-md text-xs font-medium text-center transition-colors cursor-pointer"
                  :class="selectedMinute === m ? 'bg-primary/10 dark:bg-primary/20 text-primary font-bold border border-primary/30' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
                  @click="selectMinute(m)"
                >
                  {{ String(m).padStart(2, '0') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Done Button -->
          <button
            type="button"
            class="w-full py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer active:scale-98 mt-auto"
            @click="isOpen = false"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(150, 150, 150, 0.2);
  border-radius: 4px;
}
</style>
