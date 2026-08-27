<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import RegalButton from '../../components/admin/RegalButton.vue';
import {
  getExamEnrollments,
  batchEnrollCandidates,
  removeCandidateEnrollment,
  listUsers,
  type CandidateEnrollmentRow,
} from '../../services/adminApi';
import type { AdminUser } from '../../types/admin';

const props = defineProps<{
  examId: number;
  examTitle: string;
  accessType?: string;
}>();

const emit = defineEmits<{
  close: [];
  updated: [];
}>();

const activeTab = ref<'list' | 'batch'>('list');
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const successMsg = ref('');
const searchQuery = ref('');

const enrollments = ref<CandidateEnrollmentRow[]>([]);
const registeredStudents = ref<AdminUser[]>([]);
const selectedUserIds = ref<number[]>([]);
const rawInput = ref('');
const studentSearch = ref('');

const filteredEnrollments = computed(() => {
  if (!searchQuery.value.trim()) return enrollments.value;
  const q = searchQuery.value.toLowerCase().trim();
  return enrollments.value.filter(
    (e) =>
      e.user?.firstName?.toLowerCase().includes(q) ||
      e.user?.lastName?.toLowerCase().includes(q) ||
      e.user?.rollNumber?.toLowerCase().includes(q) ||
      e.user?.email?.toLowerCase().includes(q),
  );
});

const enrolledUserIdSet = computed(
  () => new Set(enrollments.value.map((e) => e.userId)),
);

const availableStudents = computed(() => {
  const q = studentSearch.value.toLowerCase().trim();
  return registeredStudents.value
    .filter((s) => !enrolledUserIdSet.value.has(s.id))
    .filter(
      (s) =>
        !q ||
        s.firstName?.toLowerCase().includes(q) ||
        s.lastName?.toLowerCase().includes(q) ||
        s.rollNumber?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q),
    );
});

async function loadData() {
  loading.value = true;
  error.value = '';
  try {
    const [enrollmentData, usersRes] = await Promise.all([
      getExamEnrollments(props.examId),
      listUsers({ limit: 500 }),
    ]);
    enrollments.value = enrollmentData;
    registeredStudents.value = (usersRes?.data || []).filter(
      (u) => u.role === 'STUDENT',
    );
  } catch (err: unknown) {
    const res = (err as { response?: { data?: { message?: string } } })?.response;
    error.value = res?.data?.message || 'Failed to load enrollment data';
  } finally {
    loading.value = false;
  }
}

async function handleBatchEnroll() {
  saving.value = true;
  error.value = '';
  successMsg.value = '';

  const tokens = rawInput.value
    .split(/[\n,;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const rollNumbers: string[] = [];
  const emails: string[] = [];

  for (const token of tokens) {
    if (token.includes('@')) {
      emails.push(token);
    } else {
      rollNumbers.push(token);
    }
  }

  const payload = {
    userIds: selectedUserIds.value.length ? selectedUserIds.value : undefined,
    rollNumbers: rollNumbers.length ? rollNumbers : undefined,
    emails: emails.length ? emails : undefined,
  };

  if (!payload.userIds?.length && !payload.rollNumbers?.length && !payload.emails?.length) {
    error.value = 'Please select students or paste Roll Numbers / Email addresses to enroll.';
    saving.value = false;
    return;
  }

  try {
    const result = await batchEnrollCandidates(props.examId, payload);
    successMsg.value = `Successfully enrolled ${result.enrolledCount} candidates (${result.alreadyEnrolledCount} were already enrolled).`;
    rawInput.value = '';
    selectedUserIds.value = [];
    await loadData();
    emit('updated');
  } catch (err: unknown) {
    const res = (err as { response?: { data?: { message?: string } } })?.response;
    error.value = res?.data?.message || 'Failed to enroll candidates';
  } finally {
    saving.value = false;
  }
}

async function handleRemove(userId: number, studentName: string) {
  if (!confirm(`Are you sure you want to remove ${studentName} from this exam?`)) {
    return;
  }

  try {
    await removeCandidateEnrollment(props.examId, userId);
    enrollments.value = enrollments.value.filter((e) => e.userId !== userId);
    emit('updated');
  } catch (err: unknown) {
    const res = (err as { response?: { data?: { message?: string } } })?.response;
    alert(res?.data?.message || 'Failed to remove candidate');
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '–';
  const d = new Date(dateStr);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toggleSelectAllAvailable() {
  const currentAvailableIds = availableStudents.value.map((s) => s.id);
  const allSelected = currentAvailableIds.every((id) =>
    selectedUserIds.value.includes(id),
  );
  if (allSelected) {
    selectedUserIds.value = selectedUserIds.value.filter(
      (id) => !currentAvailableIds.includes(id),
    );
  } else {
    const nextSet = new Set([...selectedUserIds.value, ...currentAvailableIds]);
    selectedUserIds.value = Array.from(nextSet);
  }
}

onMounted(() => {
  void loadData();
});
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
    @click.self="$emit('close')"
  >
    <div
      class="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/[0.08] rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]"
      >
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">
              Exam Candidate Enrollments
            </h3>
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
              :class="
                accessType === 'whitelist'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : accessType === 'passcode'
                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              "
            >
              {{ accessType || 'Open' }}
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {{ examTitle }}
          </p>
        </div>

        <button
          type="button"
          class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          @click="$emit('close')"
        >
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div
        class="flex items-center gap-2 px-6 pt-3 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/30 dark:bg-white/[0.01]"
      >
        <button
          type="button"
          class="pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5"
          :class="
            activeTab === 'list'
              ? 'border-primary text-primary dark:text-primary-light'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          "
          @click="activeTab = 'list'"
        >
          <span class="material-symbols-outlined text-[16px]">how_to_reg</span>
          Enrolled Candidates
          <span
            class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
          >
            {{ enrollments.length }}
          </span>
        </button>

        <button
          type="button"
          class="pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5"
          :class="
            activeTab === 'batch'
              ? 'border-primary text-primary dark:text-primary-light'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          "
          @click="activeTab = 'batch'"
        >
          <span class="material-symbols-outlined text-[16px]">group_add</span>
          Batch Whitelist / Enroll
        </button>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto p-6 space-y-4">
        <!-- Error Alert -->
        <div
          v-if="error"
          class="p-3 text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-[16px]">error</span>
          <span>{{ error }}</span>
        </div>

        <!-- Success Alert -->
        <div
          v-if="successMsg"
          class="p-3 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-[16px]">check_circle</span>
          <span>{{ successMsg }}</span>
        </div>

        <!-- Loading State -->
        <div
          v-if="loading"
          class="py-12 flex flex-col items-center justify-center text-slate-400 gap-2"
        >
          <span class="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
          <span class="text-xs">Loading candidates...</span>
        </div>

        <!-- TAB 1: Enrolled Candidates List -->
        <div v-else-if="activeTab === 'list'" class="space-y-3">
          <!-- Search Bar -->
          <div class="flex items-center justify-between gap-3">
            <div class="relative flex-1">
              <span
                class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]"
              >
                search
              </span>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search by candidate name, roll number, or email..."
                class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
              />
            </div>
            <RegalButton size="xs" variant="secondary" @click="loadData">
              <span class="material-symbols-outlined text-[14px]">refresh</span>
              Refresh
            </RegalButton>
          </div>

          <!-- Candidates Table -->
          <div
            v-if="filteredEnrollments.length > 0"
            class="border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden shadow-sm"
          >
            <table class="w-full text-left text-xs border-collapse">
              <thead
                class="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-white/[0.06] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase"
              >
                <tr>
                  <th class="px-3 py-2.5">Candidate Name</th>
                  <th class="px-3 py-2.5 font-mono">Roll Number</th>
                  <th class="px-3 py-2.5">Email</th>
                  <th class="px-3 py-2.5">Enrolled At</th>
                  <th class="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody
                class="divide-y divide-slate-100 dark:divide-white/[0.04] text-slate-700 dark:text-slate-300"
              >
                <tr
                  v-for="e in filteredEnrollments"
                  :key="e.id"
                  class="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td class="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                    {{ e.user?.firstName }} {{ e.user?.lastName }}
                  </td>
                  <td class="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-400">
                    {{ e.user?.rollNumber }}
                  </td>
                  <td class="px-3 py-2.5 text-slate-500">
                    {{ e.user?.email }}
                  </td>
                  <td class="px-3 py-2.5 text-slate-400 text-[11px]">
                    {{ formatDate(e.enrolledAt) }}
                  </td>
                  <td class="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      class="px-2 py-1 rounded text-[11px] font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 transition-colors cursor-pointer"
                      title="Remove candidate from exam"
                      @click="handleRemove(e.userId, `${e.user?.firstName} ${e.user?.lastName}`)"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-else
            class="text-center py-10 border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-400 space-y-1.5"
          >
            <span class="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">group_off</span>
            <p class="text-xs font-semibold">No candidates enrolled yet</p>
            <p class="text-[11px] text-slate-400">
              Use the "Batch Whitelist / Enroll" tab to add candidates by Roll Numbers or Emails.
            </p>
          </div>
        </div>

        <!-- TAB 2: Batch Whitelist / Enroll Candidates -->
        <div v-else class="space-y-5">
          <!-- Method 1: Paste Roll Numbers / Emails -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Paste Roll Numbers or Emails</span>
              <span class="text-[11px] font-normal text-slate-400">Comma, space, or newline separated</span>
            </label>
            <textarea
              v-model="rawInput"
              rows="4"
              placeholder="e.g. CS202601, CS202602, student3@college.edu"
              class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-3 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
            />
          </div>

          <!-- Method 2: Select Registered Students -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">
                Or Select from Registered Students ({{ availableStudents.length }} available)
              </label>
              <button
                v-if="availableStudents.length > 0"
                type="button"
                class="text-[11px] text-primary hover:underline font-semibold"
                @click="toggleSelectAllAvailable"
              >
                Toggle Select All Filtered
              </button>
            </div>

            <div class="relative">
              <span
                class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]"
              >
                search
              </span>
              <input
                v-model="studentSearch"
                type="text"
                placeholder="Filter registered students..."
                class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
              />
            </div>

            <div
              class="max-h-48 overflow-y-auto border border-slate-200 dark:border-white/[0.08] rounded-xl p-2 divide-y divide-slate-100 dark:divide-white/[0.04] bg-slate-50/50 dark:bg-slate-900/50"
            >
              <div
                v-for="s in availableStudents"
                :key="s.id"
                class="flex items-center justify-between py-1.5 px-2 hover:bg-slate-100 dark:hover:bg-white/[0.03] rounded-lg transition-colors cursor-pointer"
                @click="
                  selectedUserIds.includes(s.id)
                    ? (selectedUserIds = selectedUserIds.filter((id) => id !== s.id))
                    : selectedUserIds.push(s.id)
                "
              >
                <div class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    :checked="selectedUserIds.includes(s.id)"
                    class="rounded text-primary focus:ring-0 cursor-pointer"
                    @click.stop
                    @change="
                      selectedUserIds.includes(s.id)
                        ? (selectedUserIds = selectedUserIds.filter((id) => id !== s.id))
                        : selectedUserIds.push(s.id)
                    "
                  />
                  <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {{ s.firstName }} {{ s.lastName }}
                  </span>
                  <span class="text-[11px] font-mono text-slate-400">
                    ({{ s.rollNumber }})
                  </span>
                </div>
                <span class="text-[11px] text-slate-500">{{ s.email }}</span>
              </div>

              <div
                v-if="availableStudents.length === 0"
                class="py-4 text-center text-xs text-slate-400"
              >
                All registered students are already enrolled or match no filter.
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]"
      >
        <span class="text-xs text-slate-500">
          {{ enrollments.length }} total candidates enrolled
        </span>

        <div class="flex items-center gap-2">
          <RegalButton size="sm" variant="secondary" @click="$emit('close')">
            Done
          </RegalButton>
          <RegalButton
            v-if="activeTab === 'batch'"
            size="sm"
            variant="primary"
            :disabled="saving"
            @click="handleBatchEnroll"
          >
            <span v-if="saving" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            <span v-else class="material-symbols-outlined text-[16px]">person_add</span>
            Enroll Selected Candidates
          </RegalButton>
        </div>
      </div>
    </div>
  </div>
</template>
