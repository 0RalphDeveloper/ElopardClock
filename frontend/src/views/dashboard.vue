<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'
import { useLayout } from '../composables/useLayout'
import AppSidebar from '../components/sidebar.vue'
import AppNavbar from '../components/navbar.vue'

const logs = ref([])
const progress = ref(null)
const userId = ref(null)
const router = useRouter()
const required_hours = ref('')
const loading = ref(true)
const savingHours = ref(false)
const saveSuccess = ref(false)
const editingTarget = ref(false)

const { closeSidebar, darkMode } = useLayout()

async function fetchUser() {
  loading.value = true
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    router.push('/')
    return
  }

  const role = user.user_metadata?.role
  router.push(role === 'company' ? '/company' : '/dashboard')
  closeSidebar()

  userId.value = user.id
  await fetchProgress(user.id)
  await fetchLogs(user.id)
  loading.value = false
}

async function fetchLogs(uid) {
  const { data, error } = await supabase
    .from('ojt_logs')
    .select('*')
    .eq('user_id', uid)
    .order('date', { ascending: false })
  if (error) { console.log(error); return }
  logs.value = data
  await updateProgressTotals()
}

async function fetchProgress(uid) {
  const { data, error } = await supabase
    .from('ojt_progress')
    .select('*')
    .eq('user_id', uid)
  if (error) { console.log(error); return }
  progress.value = data[0] || null
  required_hours.value = progress.value?.required_hours || ''
}

// First-time setup — inserts a new row
async function saveRequiredHours() {
  if (!userId.value || !required_hours.value) return
  savingHours.value = true
  const { error } = await supabase
    .from('ojt_progress')
    .upsert({ user_id: userId.value, required_hours: required_hours.value })
  if (error) { savingHours.value = false; return }
  await fetchProgress(userId.value)
  savingHours.value = false
  saveSuccess.value = true
  setTimeout(() => saveSuccess.value = false, 2500)
}

const renderedHours = computed(() => {
  const total = logs.value.reduce((sum, log) => sum + (Number(log.total_hours) || 0), 0)
  return Math.round(total * 1000) / 1000
})

const remainingHours = computed(() =>
  (progress.value?.required_hours || 0) - renderedHours.value
)

const completionPercent = computed(() => {
  const req = progress.value?.required_hours || 0
  if (!req) return 0
  return Math.min(100, Math.round((renderedHours.value / req) * 100))
})

async function updateProgressTotals() {
  if (!userId.value || !progress.value) return
  await supabase.from('ojt_progress')
    .update({ rendered_hours: renderedHours.value, remaining_hours: remainingHours.value })
    .eq('user_id', userId.value)
}

// Edit existing target — only updates the required_hours column, never inserts
async function saveTarget() {
  if (!required_hours.value) { editingTarget.value = false; return }
  savingHours.value = true
  const { error } = await supabase
    .from('ojt_progress')
    .update({ required_hours: required_hours.value })
    .eq('user_id', userId.value)
  savingHours.value = false
  if (error) { console.log(error); return }
  await fetchProgress(userId.value)
  editingTarget.value = false
  saveSuccess.value = true
  setTimeout(() => saveSuccess.value = false, 2500)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getStatusColor(hours) {
  if (hours >= 8) return 'status-high'
  if (hours >= 4) return 'status-mid'
  return 'status-low'
}


onMounted(fetchUser)
</script>

<template>
  <div :class="['app-root', darkMode ? 'light' : 'dark']">

    <!-- REUSABLE SIDEBAR -->
    <AppSidebar />

    <!-- MAIN CONTENT -->
    <div class="main-wrapper">

      <!-- REUSABLE NAVBAR — title prop + #actions slot for page-specific buttons -->
      <AppNavbar title="Dashboard">
        <template #actions>
          <router-link to="/log" class="add-log-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            Add Log
          </router-link>
        </template>
      </AppNavbar>

      <main class="main-content">

        <!-- LOADING SKELETON -->
        <div v-if="loading" class="skeleton-wrapper">
          <div class="skeleton-header">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-subtitle"></div>
          </div>
          <div class="stats-grid">
            <div class="skeleton skeleton-card" v-for="n in 3" :key="n"></div>
          </div>
          <div class="skeleton skeleton-table"></div>
        </div>

        <div v-else class="dashboard-inner">

          <!-- HERO -->
          <div class="hero-section">
            <div class="hero-text">
              <h1 class="hero-title">Your OJT Progress</h1>
              <p class="hero-subtitle">Track your on-the-job training hours in real time.</p>
            </div>

            <!-- SETUP REQUIRED HOURS (first time) -->
            <div v-if="!progress || progress.required_hours === null" class="setup-card">
              <div class="setup-card__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="setup-card__body">
                <p class="setup-card__title">Set your required hours</p>
                <p class="setup-card__desc">Enter the total hours required to complete your OJT.</p>
                <div class="setup-input-row">
                  <input
                    class="setup-input"
                    type="number"
                    v-model="required_hours"
                    placeholder="e.g. 600"
                    min="1"
                    @keyup.enter="saveRequiredHours"
                  />
                  <button class="primary-btn" @click="saveRequiredHours" :disabled="savingHours">
                    <span v-if="savingHours">Saving…</span>
                    <span v-else>Save</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- STATS CARDS -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-card__label">Required Hours</div>

              <!-- DISPLAY MODE -->
              <div v-if="!editingTarget" class="stat-card__value">
                {{ progress?.required_hours || '—' }}
              </div>

              <!-- EDIT MODE -->
              <div v-else class="target-edit-wrap">
                <input
                  class="target-edit-input"
                  type="number"
                  v-model="required_hours"
                  min="1"
                  @keyup.enter="saveTarget"
                  @keyup.escape="editingTarget = false"
                  autofocus
                />
                <div class="target-edit-actions">
                  <button class="target-save-btn" @click="saveTarget" :disabled="savingHours">
                    <svg v-if="!savingHours" width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" class="spin">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    {{ savingHours ? 'Saving…' : 'Save' }}
                  </button>
                  <button class="target-cancel-btn" @click="editingTarget = false">Cancel</button>
                </div>
              </div>

              <div class="stat-card__sub" style="display:flex; align-items:center; justify-content:space-between;">
                <span>Total target</span>
                <button
                  v-if="!editingTarget && progress?.required_hours"
                  class="edit-target-btn"
                  @click="editingTarget = true"
                  title="Edit required hours"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Edit
                </button>
              </div>

            <div class="stat-card__icon stat-icon--blue" v-if="!editingTarget">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                  <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
            </div>

            <div class="stat-card stat-card--accent">
              <div class="stat-card__label">Hours Rendered</div>
              <div class="stat-card__value">{{ renderedHours }}</div>
              <div class="stat-card__sub">Completed so far</div>
              <div class="stat-card__icon stat-icon--green">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-card__label">Hours Remaining</div>
              <div class="stat-card__value" :class="remainingHours <= 0 ? 'value--done' : ''">
                {{ remainingHours <= 0 ? 'Done!' : remainingHours }}
              </div>
              <div class="stat-card__sub">Until completion</div>
              <div class="stat-card__icon stat-icon--amber">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          <!-- PROGRESS BAR -->
          <div class="progress-section" v-if="progress?.required_hours">
            <div class="progress-header">
              <span class="progress-label">Overall Completion</span>
              <span class="progress-pct">{{ completionPercent }}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: completionPercent + '%' }"></div>
            </div>
            <div class="progress-meta">
              <span>{{ renderedHours }} hrs logged</span>
              <span>{{ progress.required_hours }} hrs total</span>
            </div>
          </div>

          <!-- LOGS SECTION -->
          <div class="logs-section">
            <div class="section-header">
              <div>
                <h2 class="section-title">Activity Log</h2>
                <p class="section-desc">All your submitted OJT sessions</p>
              </div>
              <router-link to="/log" class="ghost-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                New Entry
              </router-link>
            </div>

            <!-- EMPTY STATE -->
            <div v-if="logs.length === 0" class="empty-state">
              <div class="empty-state__icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                  <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
              <p class="empty-state__title">No logs yet</p>
              <p class="empty-state__desc">Start tracking your OJT hours by adding your first log entry.</p>
              <router-link to="/log" class="primary-btn">Add First Log</router-link>
            </div>

            <!-- LOGS LIST -->
            <div v-else class="logs-list">
              <div
                v-for="(log, i) in logs"
                :key="log.id"
                class="log-item"
                :style="{ animationDelay: i * 40 + 'ms' }"
              >
                <div class="log-item__left">
                  <div :class="['log-dot', getStatusColor(log.total_hours)]"></div>
                  <div>
                    <p class="log-date">{{ formatDate(log.date) }}</p>
                    <p class="log-note" v-if="log.notes">{{ log.notes }}</p>
                  </div>
                </div>
                <div class="log-item__right">
                  <span class="log-hours">{{ log.total_hours }} hrs</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>

    <!-- TOAST -->
    <div :class="['toast', saveSuccess ? 'toast--visible' : '']">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Required hours saved!
    </div>
  </div>
</template>

<style scoped>
/* ===== DESIGN TOKENS ===== */
.app-root {
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-xl: 20px;
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px;
  --space-10: 40px; --space-12: 48px;
  --sidebar-width: 240px;
  --navbar-height: 60px;
  --font-sans: 'Geist', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --transition: 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: var(--font-sans);
  min-height: 100vh;
  display: flex;
}

/* ===== DARK THEME ===== */
.dark {
  --bg: #0a0a0b; --bg-secondary: #111113; --bg-tertiary: #18181b;
  --bg-elevated: #1c1c1f; --bg-hover: #222226;
  --border: rgba(255,255,255,0.07); --border-strong: rgba(255,255,255,0.12);
  --text-primary: #fafafa; --text-secondary: #a1a1aa; --text-muted: #52525b;
  --accent-blue: #3b82f6; --accent-blue-bg: rgba(59,130,246,0.1);
  --accent-green: #22c55e; --accent-green-bg: rgba(34,197,94,0.1);
  --accent-amber: #f59e0b; --accent-amber-bg: rgba(245,158,11,0.1);
  --progress-track: #27272a;
  --progress-fill: linear-gradient(90deg, #3b82f6, #6366f1);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.6);
}

/* ===== LIGHT THEME ===== */
.light {
  --bg: #f8f8fa; --bg-secondary: #ffffff; --bg-tertiary: #f1f1f5;
  --bg-elevated: #ffffff; --bg-hover: #f4f4f6;
  --border: rgba(0,0,0,0.07); --border-strong: rgba(0,0,0,0.12);
  --text-primary: #09090b; --text-secondary: #52525b; --text-muted: #a1a1aa;
  --accent-blue: #2563eb; --accent-blue-bg: rgba(37,99,235,0.08);
  --accent-green: #16a34a; --accent-green-bg: rgba(22,163,74,0.08);
  --accent-amber: #d97706; --accent-amber-bg: rgba(217,119,6,0.08);
  --progress-track: #e4e4e7;
  --progress-fill: linear-gradient(90deg, #2563eb, #7c3aed);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.12);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

.main-wrapper {
  flex: 1; display: flex; flex-direction: column;
  margin-left: var(--sidebar-width);
  min-height: 100vh; background: var(--bg);
  transition: margin var(--transition);
}

.main-content {
  flex: 1; padding: var(--space-8);
  max-width: 960px; width: 100%; margin: 0 auto;
}

.dashboard-inner { animation: fadeUp 0.4s ease both; }

.hero-section { margin-bottom: var(--space-8); }
.hero-title { font-size: 26px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px; margin: 0 0 var(--space-1); }
.hero-subtitle { font-size: 14px; color: var(--text-secondary); margin: 0 0 var(--space-5); }

.setup-card {
  display: flex; gap: var(--space-4); align-items: flex-start;
  padding: var(--space-5); background: var(--bg-elevated);
  border: 1px solid var(--border-strong); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm); margin-top: var(--space-4);
}
.setup-card__icon {
  width: 40px; height: 40px; border-radius: var(--radius-sm);
  background: var(--accent-blue-bg); color: var(--accent-blue);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.setup-card__title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0 0 var(--space-1); }
.setup-card__desc  { font-size: 13px; color: var(--text-secondary); margin: 0 0 var(--space-4); }
.setup-input-row { display: flex; gap: var(--space-2); align-items: center; }
.setup-input {
  padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong); background: var(--bg); color: var(--text-primary);
  font-size: 14px; width: 140px; outline: none;
  transition: border-color var(--transition); font-family: var(--font-sans);
}
.setup-input:focus { border-color: var(--accent-blue); }

.stats-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4); margin-bottom: var(--space-6);
}
.stat-card {
  position: relative; background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: var(--space-5); box-shadow: var(--shadow-sm);
  transition: transform var(--transition), box-shadow var(--transition); overflow: hidden;
}
.stat-card { overflow: visible; }

.stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.stat-card--accent {
  border-color: rgba(59,130,246,0.2);
  background: linear-gradient(135deg, var(--bg-elevated), var(--accent-blue-bg));
}
.stat-card__label {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: var(--space-2);
}
.stat-card__value {
  font-size: 32px; font-weight: 800; color: var(--text-primary);
  letter-spacing: -1px; line-height: 1; margin-bottom: var(--space-1);
}
.value--done { color: var(--accent-green); }
.stat-card__sub { font-size: 12px; color: var(--text-secondary); }
.stat-card__icon {
  position: absolute; top: var(--space-5); right: var(--space-5);
  width: 36px; height: 36px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
}
.stat-icon--blue  { background: var(--accent-blue-bg);  color: var(--accent-blue); }
.stat-icon--green { background: var(--accent-green-bg); color: var(--accent-green); }
.stat-icon--amber { background: var(--accent-amber-bg); color: var(--accent-amber); }

.progress-section {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: var(--space-5);
  margin-bottom: var(--space-6); box-shadow: var(--shadow-sm);
}
.progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); }
.progress-label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.progress-pct   { font-size: 20px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px; }
.progress-track { height: 8px; background: var(--progress-track); border-radius: 99px; overflow: hidden; margin-bottom: var(--space-3); }
.progress-fill  { height: 100%; background: var(--progress-fill); border-radius: 99px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
.progress-meta  { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); }

.logs-section {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);
}
.section-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-5) var(--space-5) var(--space-4);
  border-bottom: 1px solid var(--border);
}
.section-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0 0 var(--space-1); letter-spacing: -0.3px; }
.section-desc  { font-size: 12px; color: var(--text-muted); margin: 0; }

.empty-state {
  display: flex; flex-direction: column; align-items: center;
  text-align: center; padding: var(--space-12) var(--space-6); gap: var(--space-3);
}
.empty-state__icon {
  width: 64px; height: 64px; border-radius: var(--radius-lg);
  background: var(--bg-tertiary); color: var(--text-muted);
  display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-2);
}
.empty-state__title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0; }
.empty-state__desc  { font-size: 13px; color: var(--text-secondary); margin: 0; max-width: 280px; }

.logs-list { padding: var(--space-2) 0; }
.log-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-3) var(--space-5); border-bottom: 1px solid var(--border);
  transition: background var(--transition); animation: fadeUp 0.3s ease both;
}
.log-item:last-child { border-bottom: none; }
.log-item:hover { background: var(--bg-hover); }
.log-item__left { display: flex; align-items: center; gap: var(--space-3); }
.log-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-high { background: var(--accent-green); }
.status-mid  { background: var(--accent-blue); }
.status-low  { background: var(--accent-amber); }
.log-date { font-size: 13.5px; font-weight: 500; color: var(--text-primary); margin: 0 0 2px; }
.log-note { font-size: 12px; color: var(--text-muted); margin: 0; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.log-hours {
  font-size: 13px; font-weight: 700; color: var(--text-secondary);
  font-variant-numeric: tabular-nums; background: var(--bg-tertiary);
  padding: 3px var(--space-3); border-radius: 99px; border: 1px solid var(--border);
}

.primary-btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4); background: var(--accent-blue); color: #fff;
  border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600;
  cursor: pointer; text-decoration: none;
  transition: opacity var(--transition), transform var(--transition);
  font-family: var(--font-sans);
}
.primary-btn:hover { opacity: 0.88; transform: translateY(-1px); }
.primary-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.ghost-btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong); background: none; color: var(--text-secondary);
  font-size: 12.5px; font-weight: 500; text-decoration: none; cursor: pointer;
  transition: all var(--transition);
}
.ghost-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.add-log-btn {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4); background: var(--accent-blue); color: #fff;
  border-radius: var(--radius-sm); font-size: 13px; font-weight: 600;
  text-decoration: none; transition: opacity var(--transition), transform var(--transition);
}
.add-log-btn:hover { opacity: 0.88; transform: translateY(-1px); }

/* ===== TARGET EDIT ===== */
.target-edit-wrap {
  display: flex; flex-direction: column; gap: var(--space-2);
  margin-bottom: var(--space-1);
  padding-right: 0; /* remove any right padding that was pushing into icon space */
}

.target-edit-input {
  width: 100%; padding: var(--space-2) var(--space-3);
  background: var(--bg); border: 1px solid var(--accent-blue);
  border-radius: var(--radius-sm); color: var(--text-primary);
  font-size: 22px; font-weight: 800; letter-spacing: -0.5px;
  outline: none; font-family: var(--font-sans);
  box-shadow: 0 0 0 3px var(--accent-blue-bg);
  box-sizing: border-box;
}

.target-edit-actions {
  display: flex; gap: var(--space-2);
}

.target-save-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 5px var(--space-3); background: var(--accent-blue); color: #fff;
  border: none; border-radius: var(--radius-sm);
  font-size: 12px; font-weight: 600; cursor: pointer;
  font-family: var(--font-sans); transition: opacity var(--transition);
}
.target-save-btn:hover { opacity: 0.88; }
.target-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.target-cancel-btn {
  padding: 5px var(--space-3); background: none;
  border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  color: var(--text-secondary); font-size: 12px; font-weight: 500;
  cursor: pointer; font-family: var(--font-sans);
  transition: all var(--transition);
}
.target-cancel-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.edit-target-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 8px; background: none;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  color: var(--text-muted); font-size: 11px; font-weight: 500;
  cursor: pointer; font-family: var(--font-sans);
  transition: all var(--transition);
}
.edit-target-btn:hover {
  background: var(--accent-blue-bg);
  border-color: rgba(59,130,246,0.3);
  color: var(--accent-blue);
}

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

.toast {
  position: fixed; bottom: var(--space-6); right: var(--space-6);
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-3) var(--space-4); background: var(--accent-green); color: #fff;
  border-radius: var(--radius-md); font-size: 13px; font-weight: 600;
  box-shadow: var(--shadow-md); transform: translateY(16px); opacity: 0;
  pointer-events: none; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); z-index: 200;
}
.toast--visible { transform: translateY(0); opacity: 1; }

.skeleton-wrapper { animation: fadeUp 0.3s ease both; }
.skeleton {
  background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%);
  background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-md);
}
.skeleton-header { margin-bottom: var(--space-8); }
.skeleton-title  { height: 32px; width: 260px; margin-bottom: var(--space-2); }
.skeleton-subtitle { height: 16px; width: 180px; }
.skeleton-card   { height: 120px; }
.skeleton-table  { height: 280px; margin-top: var(--space-6); }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes shimmer {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}

@media (max-width: 768px) {
  .main-wrapper  { margin-left: 0; }
  .main-content  { padding: var(--space-5) var(--space-4); }
  .stats-grid    { grid-template-columns: 1fr; gap: var(--space-3); }
  .stat-card__value { font-size: 28px; }
  .hero-title    { font-size: 22px; }
  .section-header { flex-direction: column; align-items: flex-start; gap: var(--space-3); }
  .toast { bottom: var(--space-4); right: var(--space-4); left: var(--space-4); justify-content: center; }
}
@media (min-width: 769px) and (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1400px) {
  .main-content { max-width: 1100px; padding: var(--space-10) var(--space-12); }
}
</style>