<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'
import { useLayout } from '../composables/useLayout'
import AdminSidebar from '../components/adminsidebar.vue'
import AdminNavbar from '../components/adminnavbar.vue'

const router = useRouter()
const { darkMode } = useLayout()

const company         = ref('')
const roomData        = ref([])
const loading         = ref(true)
const creating        = ref(false)
const createError     = ref('')
const newRoomCode     = ref('')
const showNewCode     = ref(false)

// MODAL STATE MANAGMENT
const showDeleteModal = ref(false)
const roomToDelete    = ref(null)
const deleting        = ref(false)

onMounted(async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) { router.push('/'); return }

  const role = user.user_metadata?.role
  if (role !== 'company') { router.push('/dashboard'); return }
  
  await fetchRooms(user.id)
})

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

async function createRoom() {
  if (!company.value.trim()) { createError.value = 'Please enter a company name.'; return }
  creating.value = true
  createError.value = ''

  const { data: { user } } = await supabase.auth.getUser()
  const code = generateCode()

  const fullName = user.user_metadata?.full_name || 'Unknown'

  const { error } = await supabase.from('rooms').insert({
    company_name: company.value.trim(),
    room_code: code,
    created_by: user.id,
    user_id: user.id,
    created_by: fullName, 
  })

  creating.value = false
  if (error) { console.log(error); createError.value = 'Failed to create room. Try again.'; return }

  newRoomCode.value = code
  showNewCode.value = true
  company.value = ''
  await fetchRooms(user.id)
}

async function fetchRooms(uid) {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    if (error) { console.log(error); return }
    roomData.value = data

    for (const room of roomData.value) {
      const { count } = await supabase
        .from('room_members')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id)
      room.member_count = count || 0
    }
  } finally {
    loading.value = false
  }
}

// Open modal context mapping state
function triggerDeleteModal(room) {
  roomToDelete.value = room
  showDeleteModal.value = true
}

// Close and clear modal state
function closeDeleteModal() {
  showDeleteModal.value = false
  roomToDelete.value = null
}

// Confirmed Execution Process
async function executeDelete() {
  if (!roomToDelete.value) return
  
  deleting.value = true
  const { data: { user } } = await supabase.auth.getUser()
  
  /* 
    Optional Manual Dependency Wipe: Uncomment if Cascade Delete is not active on your DB 
    await supabase.from('room_members').delete().eq('room_id', roomToDelete.value.id)
  */

  const { error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', roomToDelete.value.id)

  deleting.value = false
  
  if (error) {
    console.error(error)
    alert('Failed to delete the room. Please try again.')
    return
  }

  closeDeleteModal()

  if (user) {
    await fetchRooms(user.id)
  }
}

function copyCode(code) {
  navigator.clipboard.writeText(code)
}

function goToRoom(room) {
  router.push({ name: 'RoomDetail', params: { id: room.id } })
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div :class="['app-root', darkMode ? 'light' : 'dark']">
    <AdminSidebar />

    <div class="main-wrapper">
      <AdminNavbar title="Company Rooms" />

      <main class="main-content">
        <div class="page-inner">

          <!-- PAGE HEADER -->
          <div class="page-header">
            <div>
              <h1 class="page-title">Company Rooms</h1>
              <p class="page-subtitle">Create rooms and monitor OJT trainee logs.</p>
            </div>
          </div>

          <div class="company-grid">

            <!-- LEFT: Create form -->
            <div class="left-col">
              <div class="create-card">
                <div class="create-card__header">
                  <div class="create-card__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <p class="create-card__title">Create a Room</p>
                    <p class="create-card__desc">Generate a unique code for your trainees.</p>
                  </div>
                </div>

                <div class="create-card__body">
                  <div class="input-group">
                    <label class="input-label">Company / Batch Name</label>
                    <div :class="['text-input-wrap', createError ? 'text-input-wrap--error' : '']">
                      <svg class="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                        <path d="M9 22V12h6v10" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                      </svg>
                      <input
                        class="text-input"
                        v-model="company"
                        placeholder="e.g. Acme Corp — Batch 2025"
                        @keyup.enter="createRoom"
                        @input="createError = ''"
                      />
                    </div>
                    <p v-if="createError" class="error-msg">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                      {{ createError }}
                    </p>
                  </div>

                  <button class="create-btn" @click="createRoom" :disabled="creating">
                    <svg v-if="!creating" width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                    <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" class="spin">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    {{ creating ? 'Creating…' : 'Create Room' }}
                  </button>
                </div>
              </div>

              <!-- NEW CODE BANNER -->
              <div v-if="showNewCode" class="code-banner">
                <div class="code-banner__top">
                  <div class="code-banner__icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p class="code-banner__title">Room created!</p>
                    <p class="code-banner__desc">Share this code with your trainees.</p>
                  </div>
                  <button class="code-banner__close" @click="showNewCode = false">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
                <div class="code-display">
                  <span class="code-display__val">{{ newRoomCode }}</span>
                  <button class="copy-btn" @click="copyCode(newRoomCode)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Copy
                  </button>
                </div>
              </div>

              <!-- HOW IT WORKS -->
              <div class="how-card">
                <p class="how-card__title">How rooms work</p>
                <div class="how-steps">
                  <div class="how-step">
                    <div class="how-step__num">1</div>
                    <p class="how-step__text">Create a room with your company or batch name.</p>
                  </div>
                  <div class="how-step">
                    <div class="how-step__num">2</div>
                    <p class="how-step__text">Share the generated code with your trainees.</p>
                  </div>
                  <div class="how-step">
                    <div class="how-step__num">3</div>
                    <p class="how-step__text">Click a room to view all submitted OJT logs.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- RIGHT: Rooms grid -->
            <div class="right-col">
              <div class="rooms-header">
                <p class="rooms-title">Your Rooms</p>
                <span v-if="!loading" class="rooms-count">
                  {{ roomData.length }} room{{ roomData.length !== 1 ? 's' : '' }}
                </span>
                <div v-else class="skeleton" style="width: 50px; height: 18px; border-radius: 20px;"></div>
              </div>

              <!-- SKELETON LOADING GRID -->
              <div v-if="loading" class="rooms-grid">
                <div v-for="i in 4" :key="i" class="room-card skeleton-card">
                  <div class="room-card__top">
                    <div class="skeleton skeleton-avatar"></div>
                    <div class="skeleton skeleton-code-pill"></div>
                  </div>
                  <div class="room-card__body">
                    <div class="skeleton skeleton-line" style="width: 80%; height: 18px; margin-bottom: 10px;"></div>
                    <div class="skeleton skeleton-line" style="width: 50%; height: 12px;"></div>
                  </div>
                  <div class="room-card__footer">
                    <div class="skeleton skeleton-line" style="width: 40%; height: 12px;"></div>
                    <div class="skeleton skeleton-line" style="width: 30%; height: 12px;"></div>
                  </div>
                </div>
              </div>

              <!-- EMPTY -->
              <div v-else-if="roomData.length === 0" class="state-box state-box--empty">
                <div class="state-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                    <path d="M9 22V12h6v10" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                  </svg>
                </div>
                <p class="state-title">No rooms yet</p>
                <p class="state-desc">Create your first room to start monitoring trainee logs.</p>
              </div>

              <!-- ROOMS CARD GRID -->
              <div v-else class="rooms-grid">
                <button
                  v-for="room in roomData"
                  :key="room.id"
                  class="room-card"
                  @click="goToRoom(room)"
                >
                  <div class="room-card__top">
                    <div class="room-card__top-left">
                      <div class="room-card__avatar">
                        {{ room.company_name?.charAt(0)?.toUpperCase() || 'R' }}
                      </div>
                      <div
                        class="room-card__code"
                        @click.stop="copyCode(room.room_code)"
                        title="Click to copy"
                      >
                        {{ room.room_code }}
                      </div>
                    </div>

                    <!-- TRIGGER MODAL ON CLICK AND STOP BUBBLE EVENT -->
                    <button 
                      class="room-card__delete-btn" 
                      @click.stop="triggerDeleteModal(room)"
                      title="Delete room"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  </div>

                  <div class="room-card__body">
                    <p class="room-card__name">{{ room.company_name }}</p>
                    <p class="room-card__date">Created {{ formatDate(room.created_at) }}</p>
                  </div>

                  <div class="room-card__footer">
                    <div class="room-card__stat">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
                        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                      {{ room.member_count ?? '…' }} member{{ room.member_count !== 1 ? 's' : '' }}
                    </div>
                    <div class="room-card__cta">
                      View logs
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>

    <!-- SEMANTIC MODAL INJECT LAYER -->
    <div v-if="showDeleteModal" class="modal-backdrop" @click="closeDeleteModal">
      <div class="modal-wrapper-container" @click.stop>
        <div class="modal-header">
          <div class="modal-alert-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <h3 class="modal-title">Delete Room Workspace</h3>
            <p class="modal-desc">This action cannot be undone.</p>
          </div>
        </div>

        <div class="modal-body">
          <p class="modal-text">
            Are you absolutely sure you want to permanently delete 
            <strong class="target-highlight">"{{ roomToDelete?.company_name }}"</strong>? 
            This will wipe out all tracking metrics and associated OJT trainee logs instantly.
          </p>
        </div>

        <div class="modal-footer">
          <button class="modal-btn modal-btn--cancel" @click="closeDeleteModal" :disabled="deleting">
            Cancel
          </button>
          <button class="modal-btn modal-btn--danger" @click="executeDelete" :disabled="deleting">
            <svg v-if="deleting" width="14" height="14" viewBox="0 0 24 24" fill="none" class="spin">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            {{ deleting ? 'Deleting Room...' : 'Yes, Delete Room' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.app-root {
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
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
  --accent-red: #ef4444; --accent-red-bg: rgba(239,68,68,0.1);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4); --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
  --modal-overlay: rgba(0, 0, 0, 0.6);
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
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08); --shadow-md: 0 4px 16px rgba(0,0,0,0.1);
  --modal-overlay: rgba(9, 9, 11, 0.4);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

.main-wrapper { flex: 1; display: flex; flex-direction: column; margin-left: var(--sidebar-width); min-height: 100vh; background: var(--bg); }
.main-content { flex: 1; padding: var(--space-8); }
.page-inner { width: 100%; animation: fadeUp 0.35s ease both; }

.page-header { margin-bottom: var(--space-6); }
.page-title { font-size: 22px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.4px; margin-bottom: 4px; }
.page-subtitle { font-size: 13px; color: var(--text-secondary); }

.company-grid { display: grid; grid-template-columns: 300px 1fr; gap: var(--space-6); align-items: start; }

/* LEFT COL */
.left-col { display: flex; flex-direction: column; gap: var(--space-4); position: sticky; top: calc(var(--navbar-height) + var(--space-6)); }

/* CREATE CARD */
.create-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
.create-card__header { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-5); border-bottom: 1px solid var(--border); background: var(--bg-tertiary); }
.create-card__icon { width: 36px; height: 36px; border-radius: var(--radius-sm); flex-shrink: 0; background: var(--accent-blue-bg); color: var(--accent-blue); display: flex; align-items: center; justify-content: center; }
.create-card__title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
.create-card__desc { font-size: 12px; color: var(--text-secondary); }
.create-card__body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }

.input-group { display: flex; flex-direction: column; gap: var(--space-2); }
.input-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
.text-input-wrap { display: flex; align-items: center; gap: var(--space-3); padding: 0 var(--space-3); background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); transition: border-color var(--transition), box-shadow var(--transition); }
.text-input-wrap:focus-within { border-color: var(--accent-blue); box-shadow: 0 0 0 3px var(--accent-blue-bg); }
.text-input-wrap--error { border-color: var(--accent-red) !important; box-shadow: 0 0 0 3px var(--accent-red-bg) !important; }
.input-icon { color: var(--text-muted); flex-shrink: 0; }
.text-input { flex: 1; padding: 10px 0; background: transparent; border: none; outline: none; color: var(--text-primary); font-size: 13.5px; font-family: var(--font-sans); }
.text-input::placeholder { color: var(--text-muted); }
.error-msg { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--accent-red); animation: fadeUp 0.2s ease both; }

.create-btn { display: flex; align-items: center; justify-content: center; gap: var(--space-2); width: 100%; padding: var(--space-3); background: var(--accent-blue); color: #fff; border: none; border-radius: var(--radius-sm); font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: var(--font-sans); transition: opacity var(--transition), transform var(--transition); box-shadow: 0 2px 8px rgba(59,130,246,0.25); }
.create-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
.create-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

/* CODE BANNER */
.code-banner { background: var(--accent-green-bg); border: 1px solid rgba(34,197,94,0.25); border-radius: var(--radius-md); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); animation: fadeUp 0.3s ease both; }
.code-banner__top { display: flex; align-items: flex-start; gap: var(--space-3); }
.code-banner__icon { width: 32px; height: 32px; border-radius: var(--radius-sm); flex-shrink: 0; background: var(--accent-green); color: #fff; display: flex; align-items: center; justify-content: center; }
.code-banner__title { font-size: 13px; font-weight: 600; color: var(--accent-green); margin-bottom: 2px; }
.code-banner__desc { font-size: 12px; color: var(--text-secondary); }
.code-banner__close { margin-left: auto; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; border-radius: 4px; display: flex; transition: color var(--transition); }
.code-banner__close:hover { color: var(--text-primary); }
.code-display { display: flex; align-items: center; justify-content: space-between; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); }
.code-display__val { font-family: var(--font-mono); font-size: 20px; font-weight: 800; letter-spacing: 0.15em; color: var(--text-primary); }
.copy-btn { display: flex; align-items: center; gap: 5px; padding: 6px var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: none; color: var(--text-secondary); font-size: 12px; font-weight: 500; cursor: pointer; transition: all var(--transition); font-family: var(--font-sans); }
.copy-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* HOW CARD */
.how-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-5); box-shadow: var(--shadow-sm); }
.how-card__title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: var(--space-4); }
.how-steps { display: flex; flex-direction: column; gap: var(--space-3); }
.how-step { display: flex; align-items: flex-start; gap: var(--space-3); }
.how-step__num { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; background: var(--accent-blue-bg); color: var(--accent-blue); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
.how-step__text { font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; }

/* RIGHT COL */
.right-col { display: flex; flex-direction: column; gap: var(--space-4); }
.rooms-header { display: flex; align-items: center; justify-content: space-between; }
.rooms-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.rooms-count { font-size: 12px; color: var(--text-muted); background: var(--bg-tertiary); border: 1px solid var(--border); padding: 2px 10px; border-radius: 99px; }

/* STATE BOXES */
.state-box {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--space-3); padding: var(--space-10) var(--space-6); font-size: 13px;
  color: var(--text-muted); width: 100%; min-height: 300px;
}
.state-box--empty {
  background: var(--bg-elevated); border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg); grid-column: 1 / -1;
}
.state-icon { width: 56px; height: 56px; border-radius: var(--radius-lg); background: var(--bg-tertiary); color: var(--text-muted); display: flex; align-items: center; justify-content: center; }
.state-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.state-desc { font-size: 13px; color: var(--text-secondary); text-align: center; max-width: 260px; }

/* ROOMS CARD GRID */
.rooms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); }

.room-card {
  display: flex; flex-direction: column;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: var(--space-5);
  box-shadow: var(--shadow-sm); cursor: pointer; text-align: left;
  transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
  font-family: var(--font-sans); gap: var(--space-4);
}
.room-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--border-strong); }

.room-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-2); }
.room-card__top-left { display: flex; align-items: center; gap: var(--space-3); }

.room-card__avatar {
  width: 44px; height: 44px; border-radius: var(--radius-md);
  background: var(--accent-blue-bg); color: var(--accent-blue);
  font-size: 18px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}

.room-card__code {
  font-family: var(--font-mono); font-size: 11px; font-weight: 700;
  letter-spacing: 0.05em; color: var(--text-muted);
  background: var(--bg-tertiary); border: 1px solid var(--border);
  padding: 4px 10px; border-radius: 99px; cursor: pointer;
  transition: all var(--transition);
}
.room-card__code:hover { background: var(--accent-blue-bg); color: var(--accent-blue); border-color: rgba(59,130,246,0.3); }

.room-card__delete-btn {
  background: none; border: none; color: var(--text-muted);
  padding: var(--space-2); border-radius: var(--radius-sm);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background var(--transition), color var(--transition);
}
.room-card__delete-btn:hover { background: var(--accent-red-bg); color: var(--accent-red); }

.room-card__body { flex: 1; }
.room-card__name { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; letter-spacing: -0.2px; }
.room-card__date { font-size: 12px; color: var(--text-muted); }

.room-card__footer {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: var(--space-4); border-top: 1px solid var(--border);
}

.room-card__stat { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-secondary); }
.room-card__cta { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--accent-blue); transition: gap var(--transition); }
.room-card:hover .room-card__cta { gap: 8px; }

/* SYSTEM MODAL VIEWPORT STYLES */
.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: var(--modal-overlay); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; padding: var(--space-4);
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.modal-wrapper-container {
  background: var(--bg-elevated); border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg); width: 100%; max-width: 440px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3), 0 10px 10px -5px rgba(0,0,0,0.2);
  overflow: hidden; display: flex; flex-direction: column;
  animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.modal-header {
  display: flex; align-items: flex-start; gap: var(--space-4);
  padding: var(--space-5) var(--space-5) var(--space-3);
}

.modal-alert-icon {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  background: var(--accent-red-bg); color: var(--accent-red);
  display: flex; align-items: center; justify-content: center;
}

.modal-title { font-size: 16px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.3px; margin-bottom: 2px; }
.modal-desc { font-size: 12px; color: var(--text-muted); font-weight: 500; }

.modal-body { padding: 0 var(--space-5) var(--space-5); }
.modal-text { font-size: 13.5px; color: var(--text-secondary); line-height: 1.6; }
.target-highlight { color: var(--text-primary); font-weight: 600; word-break: break-all; }

.modal-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3);
  padding: var(--space-4) var(--space-5); background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
}

.modal-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  padding: 10px var(--space-4); font-size: 13px; font-weight: 600;
  border-radius: var(--radius-sm); border: none; cursor: pointer;
  font-family: var(--font-sans); transition: all var(--transition);
}
.modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-btn--cancel { background: var(--bg-secondary); border: 1px solid var(--border-strong); color: var(--text-secondary); }
.modal-btn--cancel:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }

.modal-btn--danger { background: var(--accent-red); color: #fff; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.2); }
.modal-btn--danger:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.modal-btn--danger:disabled { transform: none; }

/* SKELETON INFRASTRUCTURE */
.skeleton {
  background: var(--bg-tertiary);
  background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-hover) 50%, var(--bg-tertiary) 75%);
  background-size: 200% 100%; animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.skeleton-card { pointer-events: none; border: 1px solid var(--border); }
.skeleton-avatar { width: 32px; height: 32px; border-radius: 10px; }
.skeleton-code-pill { width: 70px; height: 24px; border-radius: 6px; }
.skeleton-line { border-radius: 4px; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleUp { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

@media (max-width: 1024px) { .company-grid { grid-template-columns: 1fr; } .left-col { position: static; } }
@media (max-width: 768px) { .main-wrapper { margin-left: 0; } .main-content { padding: var(--space-5) var(--space-4); } .rooms-grid { grid-template-columns: 1fr; } }
</style>