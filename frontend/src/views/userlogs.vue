<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'
import { useLayout } from '../composables/useLayout'
import AppSidebar from '../components/sidebar.vue'
import AppNavbar from '../components/navbar.vue'

import * as XLSX from 'xlsx'


const router  = useRouter()
const { darkMode } = useLayout()

const exporting = ref(false)
// State Management
const logs          = ref([])
const loading       = ref(true)
const userId        = ref(null)
const searchQuery   = ref('')
const sortOrder     = ref('desc')    // 'desc' | 'asc'
const filterMin     = ref('')        // minimum hours filter

// Pagination State
const currentPage   = ref(1)
const itemsPerPage  = 15
const totalItems    = ref(0)

// Total Overall Stats (Separate Fetch so stats stay accurate to all historical data)
const overallTotalHours = ref(0)
const overallLogCount   = ref(0)
const bestLog           = ref(null)

// Custom Delete Modal state
const isDeleteModalOpen = ref(false)
const targetDeleteId    = ref(null)
const deletingId        = ref(null)
const deleteSuccess     = ref(false)

const fullname = ref('')
// Tracks which descriptions are expanded in-line
const expandedLogIds = ref([])
/**
 * Fetches and transforms logs for a specific user into a structured Excel file.
 * @param {string} userId - The target trainee user ID identifier.
 * @param {string} displayName - The student or trainee's name (used for naming the file).
 * @param {string} companyRoomName - The room context name.
 */
async function exportUserLogsToExcel(userId, displayName) {
  if (exporting.value) return
  exporting.value = true

  try {
    // 1. Fetch raw logs data specifically linked to this user structure
    const { data: logs, error } = await supabase
      .from('ojt_logs') // Ensure this matches your exact table name (e.g., user_logs, attendance_logs)
      .select('date, morning_in, morning_out,afternoon_in, afternoon_out, total_hours, description')
      .eq('user_id', userId)
      .order('date', { ascending: true })

    if (error) throw error

    if (!logs || logs.length === 0) {
      alert('No logged records found for this trainee to export.')
      return
    }

    // 2. Map and format JSON data keys into human-readable Excel headers
        const formattedRows = logs.map((log, index) => ({
        'No. Days': index + 1,
        'Date': log.date ? new Date(log.date).toLocaleDateString('en-PH') : '—',
        'Morning In': formatTimeExcel(log.morning_in),    // Wrapped with formatTime
        'Morning Out': formatTimeExcel(log.morning_out),  // Wrapped with formatTime
        'Afternoon In': formatTimeExcel(log.afternoon_in), // Wrapped with formatTime
        'Afternoon Out': formatTimeExcel(log.afternoon_out),// Wrapped with formatTime
        'Rendered Hours': log.total_hours ?? 0,
        'Accomplished Tasks': log.description || 'No entry details.',
        }))
    // 3. Initialize SheetJS parsing workbook structures
    const worksheet = XLSX.utils.json_to_sheet(formattedRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'OJT Attendance Logs')

    // 4. Calculate dynamic column widths so text content doesn't truncate visually
    const columnWidths = [
      { wch: 6 },   // No.
      { wch: 15 },  // Date
      { wch: 12 },  // Time In
      { wch: 12 },  // Time Out
      { wch: 20 },  // Rendered Hours
      { wch: 45 },  // Tasks Accomplished
      { wch: 12 }   // Status
    ]
    worksheet['!cols'] = columnWidths

    // 5. Build file string names safely
const cleanFileName = `${displayName.replace(/[^a-zA-Z0-9]/g, '_')}_Elopard_OJT_Logs.xlsx`
    // 6. Write and trigger automatic browser attachment pipeline down-stream download
    XLSX.writeFile(workbook, cleanFileName)

  } catch (error) {
    console.error('Failed processing compilation download stream export:', error)
    alert('An operational failure occurred while converting spreadsheet records.')
  } finally {
    exporting.value = false
  }
}

 function formatTimeExcel(iso) {
  if (!iso) return '—'
  
  // If your Supabase column only stores a raw time string like "08:00:00" instead of a full ISO timestamp,
  // we prepend a fake date string to ensure the Native JavaScript Date object parses it correctly.
  const referenceDate = iso.includes('T') ? iso : `1970-01-01T${iso}`
  
  return new Date(referenceDate).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  })
}


onMounted(async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) { router.push('/'); return }
  const role = user.user_metadata?.role
  router.push(role === 'company' ? '/company' : '/userlogs')

  userId.value = user.id
  fullname.value = user.user_metadata?.full_name

  
  // Load statistical summary once, then get the paginated list
  await fetchOverallStats(user.id)
  await fetchLogs()
})

// Calculate pagination range ceilings
const totalPages = computed(() => Math.ceil(totalItems.value / itemsPerPage) || 1)
const rangeFrom  = computed(() => (currentPage.value - 1) * itemsPerPage)
const rangeTo    = computed(() => rangeFrom.value + itemsPerPage - 1)

// Fetch targeted 15 records using Supabase Pagination
async function fetchLogs() {
  if (!userId.value) return
  loading.value = true
  expandedLogIds.value = [] // Reset expanded views on page change

  let query = supabase
    .from('ojt_logs')
    .select('*', { count: 'exact' }) // Request total row count matching criteria
    .eq('user_id', userId.value)

  // Server-side filtering for Search
  if (searchQuery.value.trim()) {
    query = query.ilike('description', `%${searchQuery.value.trim()}%`)
  }

  // Server-side filtering for Min Hours
  if (filterMin.value !== '') {
    query = query.gte('total_hours', Number(filterMin.value))
  }

  // Server-side sorting
  query = query.order('date', { ascending: sortOrder.value === 'asc' })

  // Slice chunk (0-14, 15-29, etc.)
  const { data, count, error } = await query.range(rangeFrom.value, rangeTo.value)
  
  loading.value = false
  if (error) { console.error(error); return }
  
  logs.value = data || []
  totalItems.value = count || 0
}

// Fetch historical meta stats independent of active page window
async function fetchOverallStats(uid) {
  const { data, error } = await supabase
    .from('ojt_logs')
    .select('date, total_hours')
    .eq('user_id', uid)

  if (error) { console.error(error); return }
  if (!data || data.length === 0) return

  overallLogCount.value = data.length
  overallTotalHours.value = data.reduce((s, l) => s + (Number(l.total_hours) || 0), 0)
  
  bestLog.value = data.reduce((a, b) => 
    (Number(a.total_hours) || 0) >= (Number(b.total_hours) || 0) ? a : b
  )
}

// Page Navigation Controllers
function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++
}

function prevPage() {
  if (currentPage.value > 1) currentPage.value--
}

// Watch filters — reset back to page 1 whenever search criteria mutates
watch([searchQuery, filterMin, sortOrder], () => {
  currentPage.value = 1
  fetchLogs()
})

// Watch explicit manual page changes
watch(currentPage, () => {
  fetchLogs()
})

function toggleDescription(id) {
  if (expandedLogIds.value.includes(id)) {
    expandedLogIds.value = expandedLogIds.value.filter(itemId => itemId !== id)
  } else {
    expandedLogIds.value.push(id)
  }
}

function confirmDelete(id) {
  targetDeleteId.value = id
  isDeleteModalOpen.value = true
}

async function executeDelete() {
  if (!targetDeleteId.value) return
  const id = targetDeleteId.value
  deletingId.value = id
  
  const { error } = await supabase.from('ojt_logs').delete().eq('id', id)
  deletingId.value = null
  isDeleteModalOpen.value = false
  targetDeleteId.value = null
  
  if (error) { console.error(error); return }
  
  deleteSuccess.value = true
  setTimeout(() => deleteSuccess.value = false, 2500)
  
  // Refresh page lists and dashboard counters sync
  await fetchOverallStats(userId.value)
  await fetchLogs()
}

// Stats Calculations
const avgHours = computed(() =>
  overallLogCount.value ? Math.round((overallTotalHours.value / overallLogCount.value) * 100) / 100 : 0
)

// Helpers
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  })
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

function getStatusClass(hours) {
  if (hours >= 8) return 'dot--green'
  if (hours >= 4) return 'dot--blue'
  return 'dot--amber'
}

function toggleSort() {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
}

function clearFilters() {
  searchQuery.value = ''
  filterMin.value   = ''
  sortOrder.value   = 'desc'
  currentPage.value = 1
}
</script>

<template>
  <div :class="['app-root', darkMode ? 'light' : 'dark']">
    <AppSidebar />

    <div class="main-wrapper">
      <AppNavbar title="All Logs">
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

        <!-- ═══ LOADING SKELETON ═══ -->
        <div v-if="loading && logs.length === 0" class="skeleton-wrap">
          <div class="sk-header">
            <div class="skeleton sk-title"></div>
            <div class="skeleton sk-sub"></div>
          </div>
          <div class="sk-stats">
            <div class="skeleton sk-stat" v-for="n in 4" :key="n"></div>
          </div>
          <div class="skeleton sk-toolbar"></div>
          <div class="sk-rows">
            <div class="skeleton sk-row" v-for="n in 6" :key="n"></div>
          </div>
        </div>

        <!-- ═══ CONTENT ═══ -->
        <div v-else class="page-inner">

          <!-- PAGE HEADER -->
          <div class="page-header">
            <div>
              <h1 class="page-title">Activity Log</h1>
              <p class="page-subtitle">All your OJT log entries in one place.</p>
                <button 
                    class="export-excel-btn" 
                    :disabled="exporting"
                    @click="exportUserLogsToExcel(userId, fullname  || 'User')">
                    <!-- Loading Spinner Indicator state toggle -->
                    <svg v-if="exporting" class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <!-- Native document asset vector icon matching layout engine -->
                    <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                        <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                        <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <polyline points="10 9 9 9 8 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    
                    {{ exporting ? 'Generating File...' : 'Export to Excel' }}
                </button>
            </div>
            <router-link to="/dashboard" class="back-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Dashboard
            </router-link>
          </div>

          <!-- STATS ROW -->
          <div class="stats-row">
            <div class="stat-card">
              <p class="stat-card__label">Total Entries</p>
              <p class="stat-card__val">{{ overallLogCount }}</p>
              <p class="stat-card__sub">logs submitted</p>
            </div>
            <div class="stat-card stat-card--accent">
              <p class="stat-card__label">Total Hours</p>
              <p class="stat-card__val">{{ Math.round(overallTotalHours * 100) / 100 }}</p>
              <p class="stat-card__sub">hrs rendered</p>
            </div>
            <div class="stat-card">
              <p class="stat-card__label">Average Per Log</p>
              <p class="stat-card__val">{{ avgHours }}</p>
              <p class="stat-card__sub">hrs per session</p>
            </div>
            <div class="stat-card">
              <p class="stat-card__label">Best Session</p>
              <p class="stat-card__val">{{ bestLog ? bestLog.total_hours : '—' }}</p>
              <p class="stat-card__sub">{{ bestLog ? formatDate(bestLog.date) : 'no logs yet' }}</p>
            </div>
          </div>

          <!-- TOOLBAR -->
          <div class="toolbar">
            <div class="search-wrap">
              <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <input
                class="search-input"
                v-model.lazy="searchQuery"
                placeholder="Press Enter to search description…"
                @keyup.enter="currentPage = 1"
              />
              <button v-if="searchQuery" class="search-clear" @click="clearFilters">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <div class="toolbar-right">
              <div class="filter-wrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <select class="filter-select" v-model="filterMin">
                  <option value="">All hours</option>
                  <option value="4">4+ hrs</option>
                  <option value="6">6+ hrs</option>
                  <option value="8">8+ hrs</option>
                </select>
              </div>

              <button class="sort-btn" @click="toggleSort" :title="sortOrder === 'desc' ? 'Newest first' : 'Oldest first'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path v-if="sortOrder === 'desc'" d="M3 6h18M6 12h12M9 18h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path v-else d="M9 6h12M6 12h15M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                {{ sortOrder === 'desc' ? 'Newest' : 'Oldest' }}
              </button>

              <button v-if="searchQuery || filterMin || sortOrder !== 'desc'" class="clear-btn" @click="clearFilters">
                Clear
              </button>
            </div>
          </div>

          <!-- RESULTS COUNT -->
          <p class="results-count" v-if="searchQuery || filterMin">
            {{ totalItems }} filtered log matches found
          </p>

          <!-- EMPTY STATE (no logs at all) -->
          <div v-if="overallLogCount === 0" class="empty-state">
            <div class="empty-state__icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </div>
            <p class="empty-state__title">No logs yet</p>
            <p class="empty-state__desc">Start tracking your OJT hours by adding your first log entry.</p>
            <router-link to="/log" class="primary-btn">Add First Log</router-link>
          </div>

          <!-- EMPTY STATE (filter returned nothing) -->
          <div v-else-if="logs.length === 0" class="empty-state">
            <div class="empty-state__icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.5"/>
                <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="empty-state__title">No results</p>
            <p class="empty-state__desc">No logs match your current query filters.</p>
            <button class="ghost-btn" @click="clearFilters">Clear Filters</button>
          </div>

          <!-- LOGS TABLE WITH PAGINATION FOOTER -->
          <div v-else class="logs-card" :class="{ 'logs-card--loading': loading }">
            <div class="table-responsive-container">
              <div class="table-head">
                <span class="col col--date">Date</span>
                <span class="col col--time">Morning In</span>
                <span class="col col--time">Morning Out</span>
                <span class="col col--time">Afternoon In</span>
                <span class="col col--time">Afternoon Out</span>
                <span class="col col--desc">Description</span>
                <span class="col col--hours">Hours</span>
                <span class="col col--actions"></span>
              </div>

              <!-- TABLE ROWS -->
              <div
                v-for="(log, i) in logs"
                :key="log.id"
                class="table-row"
                :class="{ 'table-row--expanded': expandedLogIds.includes(log.id) }"
                :style="{ animationDelay: i * 20 + 'ms' }"
              >
                <div class="col col--date">
                  <span :class="['dot', getStatusClass(log.total_hours)]"></span>
                  <p class="row-date">{{ formatDate(log.date) }}</p>
                </div>

                <div class="col col--time"><span class="time-badge time-badge--in">{{ formatTime(log.morning_in) }}</span></div>
                <div class="col col--time"><span class="time-badge time-badge--out">{{ formatTime(log.morning_out) }}</span></div>
                <div class="col col--time"><span class="time-badge time-badge--in">{{ formatTime(log.afternoon_in) }}</span></div>
                <div class="col col--time"><span class="time-badge time-badge--out">{{ formatTime(log.afternoon_out) }}</span></div>

                <div class="col col--desc">
                  <p 
                    class="row-desc" 
                    :class="{ 'row-desc--expanded': expandedLogIds.includes(log.id) }"
                    @click="toggleDescription(log.id)"
                  >
                    {{ log.description || '—' }}
                  </p>
                </div>

                <div class="col col--hours"><span class="hours-pill">{{ log.total_hours }}h</span></div>

                <div class="col col--actions">
                  <button class="delete-btn" @click="confirmDelete(log.id)" :disabled="deletingId === log.id">
                    <svg v-if="deletingId !== log.id" width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" class="spin">
                      <path d="M12 2v4M12 18v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- PAGINATION TOOLBAR FOOTER -->
            <div class="table-footer">
              <div class="footer-summary">
                Showing entries <strong>{{ rangeFrom + 1 }}-{{ Math.min(rangeTo + 1, totalItems) }}</strong> of <strong>{{ totalItems }}</strong>
              </div>
              
              <div class="pagination-controls">
                <button class="page-nav-btn" @click="prevPage" :disabled="currentPage === 1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M15 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Prev
                </button>
                
                <span class="page-indicator">Page <strong>{{ currentPage }}</strong> of {{ totalPages }}</span>
                
                <button class="page-nav-btn" @click="nextPage" :disabled="currentPage === totalPages">
                  Next
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>

    <!-- MODAL: DELETE CONFIRMATION -->
    <div :class="['modal-overlay', isDeleteModalOpen ? 'modal-overlay--visible' : '']" @click.self="isDeleteModalOpen = false">
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-alert-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <h3 class="modal-title">Delete Log Entry</h3>
            <p class="modal-subtitle">Are you sure you want to delete this log? This action cannot be undone.</p>
          </div>
        </div>
        <div class="modal-actions">
          <button class="ghost-btn" @click="isDeleteModalOpen = false" :disabled="deletingId !== null">Cancel</button>
          <button class="danger-confirm-btn" @click="executeDelete" :disabled="deletingId !== null">Delete Log</button>
        </div>
      </div>
    </div>

    <!-- DELETE TOAST -->
    <div :class="['toast', deleteSuccess ? 'toast--visible' : '']">Log deleted successfully.</div>
  </div>
</template>

<style scoped>
/* ===== TOKENS ===== */
.app-root {
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px;
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px;
  --space-10: 40px; --space-12: 48px;
  --sidebar-width: 240px; --navbar-height: 60px;
  --font-sans: 'Geist', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'Geist Mono', 'SF Mono', ui-monospace, monospace;
  --transition: 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: var(--font-sans); min-height: 100vh; display: flex;
}

.dark {
  --bg: #0a0a0b; --bg-secondary: #111113; --bg-tertiary: #18181b;
  --bg-elevated: #1c1c1f; --bg-hover: #222226;
  --border: rgba(255,255,255,0.07); --border-strong: rgba(255,255,255,0.12);
  --text-primary: #fafafa; --text-secondary: #a1a1aa; --text-muted: #52525b;
  --accent-blue: #3b82f6; --accent-blue-bg: rgba(59,130,246,0.1);
  --accent-green: #22c55e; --accent-green-bg: rgba(34,197,94,0.1);
  --accent-amber: #f59e0b; --accent-amber-bg: rgba(245,158,11,0.1);
  --accent-red: #ef4444; --accent-red-bg: rgba(239,68,68,0.08);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4); --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
  --overlay-bg: rgba(0, 0, 0, 0.6);
}

.light {
  --bg: #f8f8fa; --bg-secondary: #ffffff; --bg-tertiary: #f1f1f5;
  --bg-elevated: #ffffff; --bg-hover: #f4f4f6;
  --border: rgba(0,0,0,0.07); --border-strong: rgba(0,0,0,0.12);
  --text-primary: #09090b; --text-secondary: #52525b; --text-muted: #a1a1aa;
  --accent-blue: #2563eb; --accent-blue-bg: rgba(37,99,235,0.08);
  --accent-green: #16a34a; --accent-green-bg: rgba(22,163,74,0.08);
  --accent-amber: #d97706; --accent-amber-bg: rgba(217,119,6,0.08);
  --accent-red: #dc2626; --accent-red-bg: rgba(220,38,38,0.06);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08); --shadow-md: 0 4px 16px rgba(0,0,0,0.1);
  --overlay-bg: rgba(0, 0, 0, 0.4);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

/* ===== LAYOUT ===== */
.main-wrapper {
  flex: 1; display: flex; flex-direction: column;
  margin-left: var(--sidebar-width); min-height: 100vh; background: var(--bg);
}
.main-content { flex: 1; padding: var(--space-8); }
.page-inner { animation: fadeUp 0.35s ease both; }

/* ===== PAGE HEADER ===== */
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-6); }
.page-title    { font-size: 22px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.4px; margin-bottom: 4px; }
.page-subtitle { font-size: 13px; color: var(--text-secondary); }

.back-btn {
  display: flex; align-items: center; gap: 6px; padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  background: none; color: var(--text-secondary); font-size: 13px; font-weight: 500;
  text-decoration: none; transition: all var(--transition);
}
.back-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ===== STATS ROW ===== */
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-bottom: var(--space-6); }
.stat-card {
  background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: var(--space-5); box-shadow: var(--shadow-sm); transition: transform var(--transition), box-shadow var(--transition);
}
.stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.stat-card--accent {
  border-color: rgba(59,130,246,0.2);
  background: linear-gradient(135deg, var(--bg-elevated), var(--accent-blue-bg));
}
.stat-card__label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: var(--space-2); }
.stat-card__val { font-size: 28px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.8px; line-height: 1; margin-bottom: 4px; font-variant-numeric: tabular-nums; }
.stat-card__sub { font-size: 11.5px; color: var(--text-secondary); }

/* ===== TOOLBAR ===== */
.toolbar { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap; }
.search-wrap {
  flex: 1; min-width: 200px; display: flex; align-items: center; gap: var(--space-2); padding: 0 var(--space-3);
  background: var(--bg-elevated); border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  transition: border-color var(--transition), box-shadow var(--transition);
}
.search-wrap:focus-within { border-color: var(--accent-blue); box-shadow: 0 0 0 3px var(--accent-blue-bg); }
.search-icon  { color: var(--text-muted); flex-shrink: 0; }
.search-input { flex: 1; padding: 10px 0; background: transparent; border: none; outline: none; color: var(--text-primary); font-size: 13px; font-family: var(--font-sans); }
.search-input::placeholder { color: var(--text-muted); }
.search-clear { background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; padding: 2px; }
.search-clear:hover { color: var(--text-primary); }

.toolbar-right { display: flex; align-items: center; gap: var(--space-2); }
.filter-wrap { display: flex; align-items: center; gap: 6px; padding: 0 var(--space-3); height: 36px; background: var(--bg-elevated); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); color: var(--text-muted); }
.filter-select { background: transparent; border: none; outline: none; color: var(--text-primary); font-size: 12.5px; font-family: var(--font-sans); cursor: pointer; }

/* Legible select dropdown panels */
.filter-select option { background-color: var(--bg-elevated); color: var(--text-primary); }

.sort-btn {
  display: flex; align-items: center; gap: 6px; padding: 0 var(--space-3); height: 36px;
  background: var(--bg-elevated); border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  color: var(--text-secondary); font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all var(--transition);
}
.sort-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.clear-btn {
  padding: 0 var(--space-3); height: 36px; background: var(--accent-red-bg); border: 1px solid rgba(239,68,68,0.2);
  border-radius: var(--radius-sm); color: var(--accent-red); font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all var(--transition);
}
.clear-btn:hover { background: var(--accent-red); color: #fff; }
.results-count { font-size: 12px; color: var(--text-muted); margin-bottom: var(--space-3); }

/* ===== CARD ELEMENTS & LAYOUT ===== */
.logs-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); transition: opacity var(--transition); }
.logs-card--loading { opacity: 0.6; pointer-events: none; }
.table-responsive-container { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }

/* GRID MATRIX CONFIG */
.table-head {
  display: grid; grid-template-columns: 160px repeat(4, 95px) minmax(200px, 1fr) 68px 44px;
  padding: var(--space-3) var(--space-5); background: var(--bg-tertiary); border-bottom: 1px solid var(--border);
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); min-width: 880px;
}
.table-row {
  display: grid; grid-template-columns: 160px repeat(4, 95px) minmax(200px, 1fr) 68px 44px;
  padding: var(--space-3) var(--space-5); border-bottom: 1px solid var(--border); align-items: center;
  transition: background var(--transition), padding var(--transition); animation: fadeUp 0.25s ease both; min-width: 880px;
}
.table-row:last-of-type { border-bottom: none; }
.table-row:hover { background: var(--bg-hover); }

.table-row--expanded { align-items: flex-start; padding-top: var(--space-4); padding-bottom: var(--space-4); background: linear-gradient(90deg, var(--bg-elevated), var(--bg-hover)); }

.col { padding: 0 var(--space-2); display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.col--date    { gap: var(--space-3); }
.col--desc    { display: block; } 
.col--hours   { justify-content: center; }
.col--actions { justify-content: center; }

.table-row--expanded .col--date,
.table-row--expanded .col--time,
.table-row--expanded .col--hours,
.table-row--expanded .col--actions { margin-top: 2px; }

/* SUB-ELEMENT ROSTER */
.dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot--green { background: var(--accent-green); }
.dot--blue  { background: var(--accent-blue); }
.dot--amber { background: var(--accent-amber); }
.row-date { font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; }

.time-badge { font-size: 11.5px; font-variant-numeric: tabular-nums; font-family: var(--font-mono); color: var(--text-secondary); padding: 2px 6px; border-radius: 99px; border: 1px solid var(--border); background: var(--bg-tertiary); white-space: nowrap; }
.time-badge--in  { color: var(--accent-green); border-color: rgba(34,197,94,0.2); background: var(--accent-green-bg); }
.time-badge--out { color: var(--accent-amber); border-color: rgba(245,158,11,0.2); background: var(--accent-amber-bg); }

.row-desc { font-size: 12.5px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; display: block; cursor: pointer; user-select: none; transition: color var(--transition); }
.row-desc:hover { color: var(--accent-blue); }
.row-desc--expanded { white-space: normal; overflow: visible; text-overflow: clip; word-break: break-word; line-height: 1.6; color: var(--text-primary); }

.hours-pill { font-size: 12px; font-weight: 700; color: var(--accent-blue); background: var(--accent-blue-bg); border: 1px solid rgba(59,130,246,0.2); padding: 3px 10px; border-radius: 99px; font-variant-numeric: tabular-nums; }

.delete-btn { width: 28px; height: 28px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all var(--transition); }
.delete-btn:hover:not(:disabled) { background: var(--accent-red-bg); border-color: rgba(239,68,68,0.3); color: var(--accent-red); }
.delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ===== PAGINATED TABLE FOOTER ===== */
.table-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-4) var(--space-5); border-top: 1px solid var(--border);
  background: var(--bg-tertiary); font-size: 13px; color: var(--text-secondary);
  flex-wrap: wrap; gap: var(--space-3);
}
.footer-summary strong { color: var(--text-primary); }

.pagination-controls { display: flex; align-items: center; gap: var(--space-4); }
.page-indicator { font-size: 12.5px; color: var(--text-secondary); }
.page-indicator strong { color: var(--text-primary); }

.page-nav-btn {
  display: inline-flex; align-items: center; gap: 4px; height: 32px;
  padding: 0 var(--space-3); background: var(--bg-elevated);
  border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  color: var(--text-primary); font-size: 12.5px; font-weight: 500;
  cursor: pointer; font-family: var(--font-sans); transition: all var(--transition);
}
.page-nav-btn:hover:not(:disabled) { background: var(--bg-hover); border-color: var(--text-muted); }
.page-nav-btn:disabled { opacity: 0.4; cursor: not-allowed; color: var(--text-muted); background: var(--bg-tertiary); }

/* ===== MODAL BASE STYLING ===== */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: var(--overlay-bg); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity var(--transition); z-index: 500; padding: var(--space-4); }
.modal-overlay--visible { opacity: 1; pointer-events: auto; }
.modal-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); width: 100%; max-width: 440px; padding: var(--space-6); box-shadow: var(--shadow-md); transform: translateY(16px); transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.modal-overlay--visible .modal-card { transform: translateY(0); }
.modal-header { display: flex; gap: var(--space-4); align-items: flex-start; margin-bottom: var(--space-6); width: 100%; }
.modal-alert-icon { width: 40px; height: 40px; border-radius: 50%; background: var(--accent-red-bg); color: var(--accent-red); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.modal-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.modal-subtitle { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }

.danger-confirm-btn { padding: 0 var(--space-4); height: 36px; background: var(--accent-red); border: 1px solid transparent; border-radius: var(--radius-sm); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity var(--transition); }
.danger-confirm-btn:hover { opacity: 0.9; }

/* ===== EMPTY STATE ===== */
.empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: var(--space-12) var(--space-6); gap: var(--space-3); background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); }
.empty-state__icon { width: 64px; height: 64px; border-radius: var(--radius-lg); background: var(--bg-tertiary); color: var(--text-muted); display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-2); }
.empty-state__title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.empty-state__desc  { font-size: 13px; color: var(--text-secondary); max-width: 280px; }

/* ===== BUTTON TOKENS ===== */
.add-log-btn { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: var(--accent-blue); color: #fff; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; text-decoration: none; transition: opacity var(--transition), transform var(--transition); }
.add-log-btn:hover { opacity: 0.88; transform: translateY(-1px); }
.primary-btn { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-5); background: var(--accent-blue); color: #fff; border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; transition: opacity var(--transition), transform var(--transition); }
.primary-btn:hover { opacity: 0.88; transform: translateY(-1px); }
.ghost-btn { display: inline-flex; align-items: center; gap: 6px; padding: 0 var(--space-3); height: 36px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: none; color: var(--text-secondary); font-size: 13px; font-weight: 500; cursor: pointer; transition: all var(--transition); }
.ghost-btn:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }

/* ===== TOAST ===== */
.toast { position: fixed; bottom: var(--space-6); right: var(--space-6); display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); background: var(--accent-green); color: #fff; border-radius: var(--radius-md); font-size: 13px; font-weight: 600; box-shadow: var(--shadow-md); transform: translateY(16px); opacity: 0; pointer-events: none; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); z-index: 200; }
.toast--visible { transform: translateY(0); opacity: 1; }

/* ===== SKELETON ===== */
.skeleton-wrap { animation: fadeUp 0.3s ease both; }
.skeleton { background: linear-gradient(90deg, #1c1c1f 25%, #222226 50%, #1c1c1f 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-md); }
.light .skeleton { background: linear-gradient(90deg, #ffffff 25%, #f4f4f6 50%, #ffffff 75%); background-size: 200% 100%; }
.sk-header    { margin-bottom: var(--space-8); }
.sk-title     { height: 28px; width: 200px; margin-bottom: var(--space-2); }
.sk-sub       { height: 14px; width: 150px; }
.sk-stats     { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-bottom: var(--space-6); }
.sk-stat      { height: 100px; }
.sk-toolbar   { height: 40px; margin-bottom: var(--space-4); }
.sk-rows      { display: flex; flex-direction: column; gap: 1px; }
.sk-row       { height: 52px; border-radius: 0; }
.sk-row:first-child { border-radius: var(--radius-md) var(--radius-md) 0 0; }
.sk-row:last-child  { border-radius: 0 0 var(--radius-md) var(--radius-md); }

/* ===== ANIMATIONS ===== */
@keyframes fadeUp  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes spin    { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

/* ===== RESPONSIVE ===== */
@media (max-width: 1200px) { 
  .stats-row { grid-template-columns: repeat(2, 1fr); } 

}

@media (max-width: 768px) {
  /* Remove the margin pushing layout right when sidebar collapses/hides */
  .main-wrapper { 
    margin-left: 0 !important; 
    width: 100%;
  }
  
  .main-content { 
    padding: var(--space-4) var(--space-3); 
  }
  
 .page-header {
    flex-direction: column-reverse; /* Flips the stack order so Dashboard comes first */
    gap: var(--space-4);           /* Spacing between the dashboard button and the excel section */
  }
  .export-excel-btn {
    margin-top: var(--space-3);    /* Creates a controlled gap between the subtitle/title and the excel button */
    justify-content: center;
    
  }
  
  .toolbar { 
    flex-direction: column; 
    align-items: stretch; 
  }
  
  .toolbar-right { 
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2); 
  }
  
  .filter-wrap, .sort-btn, .clear-btn {
    width: 100%;
    justify-content: center;
  }
  
  .filter-select {
    flex: 1;
    text-align: center;
  }

  .table-footer { 
    flex-direction: column; 
    align-items: center; 
    text-align: center; 
    gap: var(--space-4);
    padding: var(--space-4) var(--space-3);
  }
  
  .pagination-controls {
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
  }
  
  .page-nav-btn {
    width: 100%;
    justify-content: center;
  }
}

.export-excel-btn {
  display: inline-flex;
  margin-top: var(--space-3);   
  align-items: center;
  gap: var(--space-2);
  padding: 8px var(--space-3);
  font-size: 12.5px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  background: var(--accent-green-bg);
  color: var(--accent-green);
  border: 1px solid rgba(34, 197, 94, 0.2);
  cursor: pointer;
  font-family: var(--font-sans);
  transition: all var(--transition);
}

.export-excel-btn:hover:not(:disabled) {
  background: var(--accent-green);
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.15);
}

.export-excel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Deep mobile support for narrow screens */
@media (max-width: 480px) {
  .stats-row { 
    grid-template-columns: 1fr; /* Stack cards vertically so text never overflows */
    gap: var(--space-3); 
  }
  
  .sk-stats {
    grid-template-columns: 1fr;
  }
  
  .stat-card {
    padding: var(--space-4);
  }
  
  .page-title {
    font-size: 19px;
  }
}
</style>