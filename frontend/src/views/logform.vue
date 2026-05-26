<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'
import { useLayout } from '../composables/useLayout'
import AppSidebar from '../components/sidebar.vue'
import AppNavbar from '../components/navbar.vue'

const router = useRouter()
const { darkMode } = useLayout()

// Form fields
const morning_in    = ref('')
const morning_out   = ref('')
const afternoon_in  = ref('')
const afternoon_out = ref('')
const description   = ref('')

// Today's existing log row id (if already punched in today)
const todayLogId = ref(null)

// Per-field saving/saved states
const fieldSaving = ref({ morning_in: false, morning_out: false, afternoon_in: false, afternoon_out: false, description: false })
const fieldSaved  = ref({ morning_in: false, morning_out: false, afternoon_in: false, afternoon_out: false, description: false })

const saveError = ref(false)
const pageLoading = ref(true)

const userId = ref(null)

const today = new Date().toLocaleDateString('en-PH', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
})

// Get current PH datetime string for the input (YYYY-MM-DDTHH:MM)
function getPHTime() {
  const ph = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
  const p = n => String(n).padStart(2, '0')
  return `${ph.getFullYear()}-${p(ph.getMonth()+1)}-${p(ph.getDate())}T${p(ph.getHours())}:${p(ph.getMinutes())}`
}

// Get YYYY-MM-DD in PH timezone
function getPHDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); 
  // 'en-CA' gives YYYY-MM-DD format
}

function stampNow(fieldName) {
  const val = getPHTime()
  if (fieldName === 'morning_in')    morning_in.value = val
  if (fieldName === 'morning_out')   morning_out.value = val
  if (fieldName === 'afternoon_in')  afternoon_in.value = val
  if (fieldName === 'afternoon_out') afternoon_out.value = val
}

function calcHours(a, b) {
  if (!a || !b) return 0
  const diff = (new Date(b) - new Date(a)) / 3600000
  return diff > 0 ? diff : 0
}

const morningHours   = computed(() => calcHours(morning_in.value, morning_out.value))
const afternoonHours = computed(() => calcHours(afternoon_in.value, afternoon_out.value))

const totalHours = computed(() => {
  const total = morningHours.value + afternoonHours.value
  return Math.round(total * 1000) / 1000
})

const completionStatus = computed(() => {
  if (totalHours.value >= 8) return 'full'
  if (totalHours.value >= 4) return 'half'
  if (totalHours.value > 0)  return 'partial'
  return 'empty'
})

const progressPct = computed(() => Math.min(100, (totalHours.value / 8) * 100))

// Convert ISO/datetime string → datetime-local input value (YYYY-MM-DDTHH:MM)
// Uses local browser time since datetime-local inputs work in local time
function toLocalDatetimeStr(iso) {
  const d = new Date(iso)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// On mount: auth check + load today's existing log if any

function resetForm() {
  todayLogId.value = null
  morning_in.value = ''
  morning_out.value = ''
  afternoon_in.value = ''
  afternoon_out.value = ''
  description.value = ''
}

// Check if we need to reset because the date changed while the tab was open
function checkDateChange() {
  const storedDate = localStorage.getItem('last_accessed_date')
  const currentDate = getPHDateString()
  
  if (storedDate !== currentDate) {
    resetForm()
    localStorage.setItem('last_accessed_date', currentDate)
    return true // Date changed
  }
  return false
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { router.push('/'); return }
  const role = user.user_metadata?.role
  router.push(role === 'company' ? '/company' : '/log')


  userId.value = user.id
  checkDateChange() // Ensure we clear old state if it's a new day
  // Query today's row using correct UTC range for PH timezone
  const { data, error } = await supabase
    .from('ojt_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', getPHDateString()) // Simple string match
    .maybeSingle()

  if (data) {
    todayLogId.value    = data.id
    morning_in.value    = data.morning_in    ? toLocalDatetimeStr(data.morning_in)    : ''
    morning_out.value   = data.morning_out   ? toLocalDatetimeStr(data.morning_out)   : ''
    afternoon_in.value  = data.afternoon_in  ? toLocalDatetimeStr(data.afternoon_in)  : ''
    afternoon_out.value = data.afternoon_out ? toLocalDatetimeStr(data.afternoon_out) : ''
    description.value   = data.description   || ''
  }

  pageLoading.value = false

})

// Save a single field — insert new row if first punch today, update if row already exists
async function saveField(fieldName) {
  if (!userId.value) return

  fieldSaving.value[fieldName] = true
  saveError.value = false

  // Get the current value for this specific field
  const fieldValue = {
    morning_in:    morning_in.value,
    morning_out:   morning_out.value,
    afternoon_in:  afternoon_in.value,
    afternoon_out: afternoon_out.value,
    description:   description.value,
  }[fieldName]

  if (!fieldValue) {
    fieldSaving.value[fieldName] = false
    return
  }

  if (todayLogId.value) {
    // Row exists — UPDATE just this field + recalculated total
    const { error } = await supabase
      .from('ojt_logs')
      .update({
        [fieldName]: fieldValue,
        total_hours: totalHours.value,
      })
      .eq('id', todayLogId.value)
      .eq('user_id', userId.value) // extra safety

    if (error) {
      console.log('Update error:', error)
      fieldSaving.value[fieldName] = false
      saveError.value = true
      setTimeout(() => saveError.value = false, 3000)
      return
    }
  } else {
    // No row yet — INSERT with just this first field
    const { data, error } = await supabase
      .from('ojt_logs')
      .insert({
        user_id: userId.value,
        date: getPHDateString(), // Use the YYYY-MM-DD string
        [fieldName]: fieldValue,
        total_hours: 0,
      })
      .select('id')
      .single()

    if (error) {
      console.log('Insert error:', error)
      fieldSaving.value[fieldName] = false
      saveError.value = true
      setTimeout(() => saveError.value = false, 3000)
      return
    }

    // Store the new row id so all subsequent saves UPDATE this same row
    todayLogId.value = data.id
  }

  fieldSaving.value[fieldName] = false
  fieldSaved.value[fieldName] = true
  setTimeout(() => fieldSaved.value[fieldName] = false, 2500)
}

// Alias for description save button
async function saveDescription() {
  await saveField('description')
}
</script>

<template>
  <div :class="['app-root', darkMode ? 'light' : 'dark']">
    <AppSidebar />

    <div class="main-wrapper">
      <AppNavbar title="Add Log">
        <template #actions>
          <router-link to="/dashboard" class="back-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Dashboard
          </router-link>
        </template>
      </AppNavbar>

      <main class="main-content">
        <!-- SKELETON LOADING STATE -->
        <div v-if="pageLoading" class="page-inner">
          <div class="page-header">
            <div class="page-header__left">
              <div class="skeleton skeleton-title"></div>
              <div class="skeleton skeleton-subtitle"></div>
            </div>
            <div class="skeleton skeleton-badge"></div>
          </div>

          <div class="log-grid">
            <div class="log-left">
              <!-- Morning Skeleton Card -->
              <div class="session-card skeleton-card">
                <div class="skeleton skeleton-session-header"></div>
                <div class="time-grid">
                  <div class="skeleton skeleton-input"></div>
                  <div class="skeleton skeleton-input"></div>
                </div>
              </div>
              <!-- Afternoon Skeleton Card -->
              <div class="session-card skeleton-card">
                <div class="skeleton skeleton-session-header"></div>
                <div class="time-grid">
                  <div class="skeleton skeleton-input"></div>
                  <div class="skeleton skeleton-input"></div>
                </div>
              </div>
            </div>

            <div class="log-right">
              <div class="summary-card skeleton-card">
                <div class="skeleton skeleton-text" style="width: 60%; height: 20px; margin-bottom: 20px;"></div>
                <div class="skeleton skeleton-text" style="height: 15px; margin-bottom: 12px;"></div>
                <div class="skeleton skeleton-text" style="height: 15px; margin-bottom: 12px;"></div>
                <div class="skeleton skeleton-text" style="height: 40px; margin-top: 20px;"></div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="page-inner">

          <!-- PAGE HEADER -->
          <div class="page-header">
            <div class="page-header__left">
              <h1 class="page-title">Daily OJT Log</h1>
              <p class="page-date">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
                  <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                {{ today }}
              </p>
            </div>
            <div :class="['hours-badge', `hours-badge--${completionStatus}`]">
              <span class="hours-badge__val">{{ totalHours }}</span>
              <span class="hours-badge__label">hrs today</span>
            </div>
          </div>

          <!-- RESUME BANNER if existing log found -->
          <div v-if="todayLogId" class="resume-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Continuing today's log — your entries are saved individually.
          </div>

          <!-- MAIN GRID: left = sessions, right = summary -->
          <div class="log-grid">

            <!-- LEFT COLUMN: time entry -->
            <div class="log-left">

              <!-- MORNING SESSION -->
              <div class="session-card">
                <div class="session-card__header am-header">
                  <div class="session-indicator am">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/>
                      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </div>
                  <div class="session-card__title-group">
                    <span class="session-card__title">Morning Session</span>
                    <span class="session-card__sub">{{ morningHours > 0 ? morningHours.toFixed(3) + ' hrs logged' : 'No time entered yet' }}</span>
                  </div>
                  <div class="session-pill am-pill" v-if="morningHours > 0">
                    {{ morningHours.toFixed(3) }}h
                  </div>
                </div>

                <div class="time-grid">
                  <!-- MORNING IN -->
                  <div class="time-field">
                    <label class="field-label">
                      <span class="field-dot in"></span> Time In
                    </label>
                    <input type="datetime-local" v-model="morning_in" class="time-input" />
                    <div class="field-actions">
                      <button class="stamp-btn" @click="stampNow('morning_in')">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                          <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        Stamp
                      </button>
                      <button
                        :class="['save-field-btn', fieldSaved.morning_in ? 'save-field-btn--saved' : '']"
                        @click="saveField('morning_in')"
                        :disabled="!morning_in || fieldSaving.morning_in"
                      >
                        <svg v-if="fieldSaved.morning_in" width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <svg v-else-if="fieldSaving.morning_in" width="11" height="11" viewBox="0 0 24 24" fill="none" class="spin">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                          <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        {{ fieldSaved.morning_in ? 'Saved!' : fieldSaving.morning_in ? 'Saving…' : 'Save' }}
                      </button>
                    </div>
                  </div>

                  <!-- MORNING OUT -->
                  <div class="time-field">
                    <label class="field-label">
                      <span class="field-dot out"></span> Time Out
                    </label>
                    <input type="datetime-local" v-model="morning_out" class="time-input" />
                    <div class="field-actions">
                      <button class="stamp-btn" @click="stampNow('morning_out')">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                          <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        Stamp
                      </button>
                      <button
                        :class="['save-field-btn', fieldSaved.morning_out ? 'save-field-btn--saved' : '']"
                        @click="saveField('morning_out')"
                        :disabled="!morning_out || fieldSaving.morning_out"
                      >
                        <svg v-if="fieldSaved.morning_out" width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <svg v-else-if="fieldSaving.morning_out" width="11" height="11" viewBox="0 0 24 24" fill="none" class="spin">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                          <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        {{ fieldSaved.morning_out ? 'Saved!' : fieldSaving.morning_out ? 'Saving…' : 'Save' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- BREAK DIVIDER -->
              <div class="break-divider">
                <span class="break-divider__line"></span>
                <span class="break-divider__badge">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Lunch Break
                </span>
                <span class="break-divider__line"></span>
              </div>

              <!-- AFTERNOON SESSION -->
              <div class="session-card">
                <div class="session-card__header pm-header">
                  <div class="session-indicator pm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="session-card__title-group">
                    <span class="session-card__title">Afternoon Session</span>
                    <span class="session-card__sub">{{ afternoonHours > 0 ? afternoonHours.toFixed(3) + ' hrs logged' : 'No time entered yet' }}</span>
                  </div>
                  <div class="session-pill pm-pill" v-if="afternoonHours > 0">
                    {{ afternoonHours.toFixed(3) }}h
                  </div>
                </div>

                <div class="time-grid">
                  <!-- AFTERNOON IN -->
                  <div class="time-field">
                    <label class="field-label">
                      <span class="field-dot in"></span> Time In
                    </label>
                    <input type="datetime-local" v-model="afternoon_in" class="time-input" />
                    <div class="field-actions">
                      <button class="stamp-btn" @click="stampNow('afternoon_in')">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                          <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        Stamp
                      </button>
                      <button
                        :class="['save-field-btn', fieldSaved.afternoon_in ? 'save-field-btn--saved' : '']"
                        @click="saveField('afternoon_in')"
                        :disabled="!afternoon_in || fieldSaving.afternoon_in"
                      >
                        <svg v-if="fieldSaved.afternoon_in" width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <svg v-else-if="fieldSaving.afternoon_in" width="11" height="11" viewBox="0 0 24 24" fill="none" class="spin">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                          <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        {{ fieldSaved.afternoon_in ? 'Saved!' : fieldSaving.afternoon_in ? 'Saving…' : 'Save' }}
                      </button>
                    </div>
                  </div>

                  <!-- AFTERNOON OUT -->
                  <div class="time-field">
                    <label class="field-label">
                      <span class="field-dot out"></span> Time Out
                    </label>
                    <input type="datetime-local" v-model="afternoon_out" class="time-input" />
                    <div class="field-actions">
                      <button class="stamp-btn" @click="stampNow('afternoon_out')">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                          <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        Stamp
                      </button>
                      <button
                        :class="['save-field-btn', fieldSaved.afternoon_out ? 'save-field-btn--saved' : '']"
                        @click="saveField('afternoon_out')"
                        :disabled="!afternoon_out || fieldSaving.afternoon_out"
                      >
                        <svg v-if="fieldSaved.afternoon_out" width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <svg v-else-if="fieldSaving.afternoon_out" width="11" height="11" viewBox="0 0 24 24" fill="none" class="spin">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                          <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        {{ fieldSaved.afternoon_out ? 'Saved!' : fieldSaving.afternoon_out ? 'Saving…' : 'Save' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- DESCRIPTION -->
              <div class="desc-card">
                <div class="desc-card__header">
                  <label class="field-label">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Work Description
                  </label>
                  <button
                    :class="['save-field-btn', fieldSaved.description ? 'save-field-btn--saved' : '']"
                    @click="saveDescription"
                    :disabled="!description.trim() || fieldSaving.description"
                  >
                    <svg v-if="fieldSaved.description" width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <svg v-else-if="fieldSaving.description" width="11" height="11" viewBox="0 0 24 24" fill="none" class="spin">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                      <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    {{ fieldSaved.description ? 'Saved!' : fieldSaving.description ? 'Saving…' : 'Save' }}
                  </button>
                </div>
                <textarea
                  class="desc-input"
                  v-model="description"
                  placeholder="What did you work on today? Tasks completed, challenges faced, learnings..."
                ></textarea>
              </div>
            </div>

            <!-- RIGHT COLUMN: summary + save -->
            <div class="log-right">

              <!-- SUMMARY CARD -->
              <div class="summary-card">
                <p class="summary-card__title">Today's Summary</p>

                <div class="summary-stat">
                  <div class="summary-stat__row">
                    <div class="summary-stat__icon am-icon">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </div>
                    <span class="summary-stat__label">Morning</span>
                    <span class="summary-stat__val">{{ morningHours.toFixed(3) }}h</span>
                  </div>
                  <div class="summary-stat__row">
                    <div class="summary-stat__icon pm-icon">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </div>
                    <span class="summary-stat__label">Afternoon</span>
                    <span class="summary-stat__val">{{ afternoonHours.toFixed(3) }}h</span>
                  </div>
                </div>

                <div class="summary-divider"></div>

                <!-- TOTAL -->
                <div class="summary-total">
                  <span class="summary-total__label">Total Hours</span>
                  <span :class="['summary-total__val', `val--${completionStatus}`]">
                    {{ totalHours }}
                    <span class="summary-total__unit">hrs</span>
                  </span>
                </div>

                <!-- PROGRESS BAR -->
                <div class="progress-wrap">
                  <div class="progress-track">
                    <div
                      :class="['progress-fill', `progress-fill--${completionStatus}`]"
                      :style="{ width: progressPct + '%' }"
                    ></div>
                  </div>
                  <div class="progress-meta">
                    <span>{{ totalHours }}h logged</span>
                    <span>8h goal</span>
                  </div>
                </div>

                <!-- PUNCH STATUS — shows what's been saved -->
                <div class="status-chips">
                  <div :class="['chip', morning_in ? 'chip--done' : 'chip--pending']">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <polyline v-if="morning_in" points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle v-else cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Morning time in
                  </div>
                  <div :class="['chip', morning_out ? 'chip--done' : 'chip--pending']">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <polyline v-if="morning_out" points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle v-else cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Morning time out
                  </div>
                  <div :class="['chip', afternoon_in ? 'chip--done' : 'chip--pending']">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <polyline v-if="afternoon_in" points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle v-else cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Afternoon time in
                  </div>
                  <div :class="['chip', afternoon_out ? 'chip--done' : 'chip--pending']">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <polyline v-if="afternoon_out" points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle v-else cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Afternoon time out
                  </div>
                  <div :class="['chip', description.trim() ? 'chip--done' : 'chip--pending']">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <polyline v-if="description.trim()" points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle v-else cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Work description
                  </div>
                </div>

                <!-- LOG ID INDICATOR -->
                <div class="log-id-row" v-if="todayLogId">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Entry active — changes save instantly
                </div>
              </div>

            </div>

          </div>
        </div>
      </main>
    </div>

    <!-- ERROR TOAST -->
    <div :class="['toast', 'toast--error', saveError ? 'toast--visible' : '']">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Failed to save log.
    </div>
  </div>
</template>

<style scoped>
/* ===== TOKENS ===== */
.app-root {
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px;
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --sidebar-width: 240px;
  --navbar-height: 60px;
  --font-sans: 'Geist', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --transition: 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: var(--font-sans);
  min-height: 100vh;
  display: flex;
}

.dark {
  --bg: #0a0a0b; --bg-secondary: #111113; --bg-tertiary: #18181b;
  --bg-elevated: #1c1c1f; --bg-hover: #222226;
  --border: rgba(255,255,255,0.07); --border-strong: rgba(255,255,255,0.12);
  --text-primary: #fafafa; --text-secondary: #a1a1aa; --text-muted: #52525b;
  --accent-blue: #3b82f6; --accent-blue-bg: rgba(59,130,246,0.1);
  --accent-green: #22c55e; --accent-green-bg: rgba(34,197,94,0.1);
  --accent-amber: #f59e0b; --accent-amber-bg: rgba(245,158,11,0.1);
  --accent-red: #ef4444; --accent-red-bg: rgba(239,68,68,0.1);
  --color-am: #10b981; --color-am-bg: rgba(16,185,129,0.12);
  --color-pm: #3b82f6; --color-pm-bg: rgba(59,130,246,0.12);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
}

.light {
  --bg: #f8f8fa; --bg-secondary: #ffffff; --bg-tertiary: #f1f1f5;
  --bg-elevated: #ffffff; --bg-hover: #f4f4f6;
  --border: rgba(0,0,0,0.07); --border-strong: rgba(0,0,0,0.12);
  --text-primary: #09090b; --text-secondary: #52525b; --text-muted: #a1a1aa;
  --accent-blue: #2563eb; --accent-blue-bg: rgba(37,99,235,0.08);
  --accent-green: #16a34a; --accent-green-bg: rgba(22,163,74,0.08);
  --accent-amber: #d97706; --accent-amber-bg: rgba(217,119,6,0.08);
  --accent-red: #dc2626; --accent-red-bg: rgba(220,38,38,0.08);
  --color-am: #059669; --color-am-bg: rgba(5,150,105,0.08);
  --color-pm: #2563eb; --color-pm-bg: rgba(37,99,235,0.08);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.1);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

/* ===== LAYOUT ===== */
.main-wrapper {
  flex: 1; display: flex; flex-direction: column;
  margin-left: var(--sidebar-width);
  min-height: 100vh; background: var(--bg);
}

.main-content {
  flex: 1;
  padding: var(--space-6) var(--space-8);
}

.page-inner {
  width: 100%;
  animation: fadeUp 0.35s ease both;
}

/* ===== PAGE HEADER ===== */
.page-header {
  display: flex; align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: 22px; font-weight: 700;
  color: var(--text-primary); letter-spacing: -0.4px;
  margin-bottom: 4px;
}

.page-date {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--text-secondary);
}

/* ===== HOURS BADGE ===== */
.hours-badge {
  display: flex; flex-direction: column; align-items: flex-end;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md); border: 1px solid var(--border);
  background: var(--bg-elevated); min-width: 88px;
  transition: all var(--transition);
}
.hours-badge__val { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; line-height: 1; font-variant-numeric: tabular-nums; }
.hours-badge__label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.hours-badge--empty .hours-badge__val   { color: var(--text-muted); }
.hours-badge--partial .hours-badge__val { color: var(--accent-amber); }
.hours-badge--half .hours-badge__val    { color: var(--accent-blue); }
.hours-badge--full .hours-badge__val    { color: var(--accent-green); }
.hours-badge--full { border-color: rgba(34,197,94,0.25); background: var(--accent-green-bg); }

/* ===== MAIN GRID ===== */
.log-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--space-5);
  align-items: start;
}

/* ===== LEFT COLUMN ===== */
.log-left {
  display: flex; flex-direction: column; gap: var(--space-4);
}

/* ===== SESSION CARDS ===== */
.session-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.session-card__header {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border);
}

.am-header { border-left: 3px solid var(--color-am); }
.pm-header { border-left: 3px solid var(--color-pm); }

.session-indicator {
  width: 34px; height: 34px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.session-indicator.am { background: var(--color-am-bg); color: var(--color-am); }
.session-indicator.pm { background: var(--color-pm-bg); color: var(--color-pm); }

.session-card__title-group { flex: 1; }
.session-card__title { display: block; font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
.session-card__sub   { font-size: 12px; color: var(--text-muted); }

.session-pill {
  font-size: 12px; font-weight: 700; padding: 3px 10px;
  border-radius: 99px; font-variant-numeric: tabular-nums;
}
.am-pill { background: var(--color-am-bg); color: var(--color-am); }
.pm-pill { background: var(--color-pm-bg); color: var(--color-pm); }

.time-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: var(--space-4); padding: var(--space-5);
}

.time-field { display: flex; flex-direction: column; gap: var(--space-2); }

.field-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-muted);
}

.field-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.field-dot.in  { background: var(--accent-green); }
.field-dot.out { background: var(--accent-red); }

.time-input {
  width: 100%; padding: 10px var(--space-3);
  background: var(--bg); border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm); color: var(--text-primary);
  font-size: 13px; font-family: var(--font-sans);
  outline: none; transition: border-color var(--transition), box-shadow var(--transition);
  color-scheme: dark;
}
.light .time-input { color-scheme: light; }
.time-input:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px var(--accent-blue-bg);
}

.stamp-btn {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 8px var(--space-3);
  background: var(--bg-tertiary); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-secondary);
  font-size: 12px; font-weight: 500; cursor: pointer;
  transition: all var(--transition); font-family: var(--font-sans);
}
.stamp-btn:hover {
  background: var(--accent-blue-bg);
  border-color: rgba(59,130,246,0.3);
  color: var(--accent-blue);
}

/* ===== BREAK DIVIDER ===== */
.break-divider {
  display: flex; align-items: center; gap: var(--space-3);
}
.break-divider__line { flex: 1; height: 1px; background: var(--border); }
.break-divider__badge {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 500; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.06em;
  background: var(--bg-tertiary); border: 1px solid var(--border);
  padding: 4px 10px; border-radius: 99px; white-space: nowrap;
}

/* ===== DESCRIPTION CARD ===== */
.desc-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-3);
  box-shadow: var(--shadow-sm);
}

.desc-input {
  width: 100%; padding: var(--space-3);
  background: var(--bg); border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm); color: var(--text-primary);
  font-size: 13.5px; font-family: var(--font-sans); line-height: 1.6;
  resize: vertical; min-height: 120px; outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}
.desc-input::placeholder { color: var(--text-muted); }
.desc-input:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px var(--accent-blue-bg);
}

/* ===== RIGHT COLUMN ===== */
.log-right {
  display: flex; flex-direction: column; gap: var(--space-4);
  position: sticky; top: calc(var(--navbar-height) + var(--space-6));
}

/* ===== SUMMARY CARD ===== */
.summary-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  display: flex; flex-direction: column; gap: var(--space-4);
}

.summary-card__title {
  font-size: 12px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted);
}

.summary-stat { display: flex; flex-direction: column; gap: var(--space-2); }

.summary-stat__row {
  display: flex; align-items: center; gap: var(--space-2);
}

.summary-stat__icon {
  width: 26px; height: 26px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.am-icon { background: var(--color-am-bg); color: var(--color-am); }
.pm-icon { background: var(--color-pm-bg); color: var(--color-pm); }

.summary-stat__label { flex: 1; font-size: 13px; color: var(--text-secondary); }
.summary-stat__val   { font-size: 13px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }

.summary-divider { height: 1px; background: var(--border); }

.summary-total {
  display: flex; align-items: center; justify-content: space-between;
}
.summary-total__label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.summary-total__val {
  font-size: 28px; font-weight: 800; letter-spacing: -1px;
  font-variant-numeric: tabular-nums; color: var(--text-primary);
  transition: color var(--transition);
}
.summary-total__unit { font-size: 14px; font-weight: 500; color: var(--text-muted); margin-left: 2px; }
.val--partial { color: var(--accent-amber); }
.val--half    { color: var(--accent-blue); }
.val--full    { color: var(--accent-green); }

/* ===== PROGRESS BAR ===== */
.progress-wrap { display: flex; flex-direction: column; gap: 6px; }
.progress-track {
  height: 6px; background: var(--bg-tertiary);
  border-radius: 99px; overflow: hidden;
}
.progress-fill {
  height: 100%; border-radius: 99px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--accent-blue);
}
.progress-fill--partial { background: var(--accent-amber); }
.progress-fill--half    { background: var(--accent-blue); }
.progress-fill--full    { background: var(--accent-green); }

.progress-meta {
  display: flex; justify-content: space-between;
  font-size: 11px; color: var(--text-muted);
}

/* ===== STATUS CHIPS ===== */
.status-chips { display: flex; flex-direction: column; gap: var(--space-2); }

.chip {
  display: flex; align-items: center; gap: 7px;
  padding: 7px var(--space-3); border-radius: var(--radius-sm);
  font-size: 12px; font-weight: 500; border: 1px solid var(--border);
  background: var(--bg-tertiary); color: var(--text-muted);
  transition: all var(--transition);
}
.chip--done {
  background: var(--accent-green-bg);
  border-color: rgba(34,197,94,0.2);
  color: var(--accent-green);
}
.chip--pending { color: var(--text-muted); }

/* ===== FIELD ACTIONS (stamp + save side by side) ===== */
.field-actions {
  display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);
}

/* ===== PER-FIELD SAVE BUTTON ===== */
.save-field-btn {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 8px var(--space-3);
  background: var(--accent-blue-bg); border: 1px solid rgba(59,130,246,0.25);
  border-radius: var(--radius-sm); color: var(--accent-blue);
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all var(--transition); font-family: var(--font-sans);
}
.save-field-btn:hover:not(:disabled) {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: #fff;
}
.save-field-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.save-field-btn--saved {
  background: var(--accent-green-bg) !important;
  border-color: rgba(34,197,94,0.25) !important;
  color: var(--accent-green) !important;
}

/* ===== RESUME BANNER ===== */
.resume-banner {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--accent-blue-bg);
  border: 1px solid rgba(59,130,246,0.2);
  border-radius: var(--radius-md);
  font-size: 12.5px; font-weight: 500; color: var(--accent-blue);
  margin-bottom: var(--space-5);
}

/* ===== DESC CARD HEADER ===== */
.desc-card__header {
  display: flex; align-items: center; justify-content: space-between;
}

/* ===== LOG ID ROW ===== */
.log-id-row {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--accent-green);
  padding: var(--space-2) var(--space-3);
  background: var(--accent-green-bg);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(34,197,94,0.2);
}

/* ===== PAGE LOADING ===== */
.page-loading {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: var(--space-3);
  color: var(--text-muted); font-size: 13px;
  min-height: calc(100vh - var(--navbar-height));
}

.spinner {
  width: 28px; height: 28px; border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent-blue);
  animation: spin 0.7s linear infinite;
}

.save-btn {
  display: flex; align-items: center; justify-content: center; gap: var(--space-2);
  width: 100%; padding: var(--space-4);
  background: var(--accent-blue); color: #fff;
  border: none; border-radius: var(--radius-md);
  font-size: 14px; font-weight: 600; cursor: pointer;
  font-family: var(--font-sans);
  transition: opacity var(--transition), transform var(--transition), box-shadow var(--transition);
  box-shadow: 0 2px 8px rgba(59,130,246,0.3);
}
.save-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(59,130,246,0.4);
}
.save-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; box-shadow: none; }

.save-hint {
  text-align: center; font-size: 11.5px; color: var(--text-muted);
}

/* ===== BACK BUTTON ===== */
.back-btn {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
  background: none; color: var(--text-secondary);
  font-size: 13px; font-weight: 500; text-decoration: none;
  transition: all var(--transition);
}
.back-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ===== TOASTS ===== */
.toast {
  position: fixed; bottom: var(--space-6); right: var(--space-6);
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md); font-size: 13px; font-weight: 600;
  box-shadow: var(--shadow-md);
  transform: translateY(16px); opacity: 0; pointer-events: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); z-index: 200;
}
.toast--success { background: var(--accent-green); color: #fff; }
.toast--error   { background: var(--accent-red);   color: #fff; }
.toast--visible { transform: translateY(0); opacity: 1; }
/* ===== SKELETON ANIMATIONS ===== */
.skeleton {
  background: var(--bg-tertiary);
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 25%,
    var(--bg-hover) 50%,
    var(--bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Skeleton Shapes */
.skeleton-title {
  width: 200px;
  height: 32px;
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
}

.skeleton-subtitle {
  width: 140px;
  height: 16px;
}

.skeleton-badge {
  width: 80px;
  height: 60px;
  border-radius: var(--radius-md);
}

.skeleton-card {
  padding: var(--space-4);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  overflow: hidden;
}

.skeleton-session-header {
  height: 40px;
  width: 100%;
  margin-bottom: var(--space-4);
  border-radius: var(--radius-sm);
}

.skeleton-input {
  height: 80px;
  width: 100%;
  border-radius: var(--radius-sm);
}

.skeleton-text {
  width: 100%;
  border-radius: 2px;
}

/* Adjustments to make skeleton cards look like your real ones */
.log-left .skeleton-card {
  margin-bottom: var(--space-6);
  border-radius: var(--radius-lg);
}
/* ===== ANIMATIONS ===== */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

/* ===== RESPONSIVE ===== */
@media (max-width: 900px) {
  .log-grid { grid-template-columns: 1fr; }
  .log-right { position: static; }
  .main-content { padding: var(--space-5) var(--space-4); }
}

@media (max-width: 768px) {
  .main-wrapper { margin-left: 0; }
  .time-grid    { grid-template-columns: 1fr; }
  .page-title   { font-size: 20px; }
  .toast { bottom: var(--space-4); right: var(--space-4); left: var(--space-4); justify-content: center; }
}
</style>