<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'
import { useLayout } from '../composables/useLayout'
import AppSidebar from '../components/sidebar.vue'
import AppNavbar from '../components/navbar.vue'

const router = useRouter()
const { darkMode } = useLayout()

const code        = ref('')
const loading     = ref(false)
const roomsLoading = ref(true)
const errorMsg    = ref('')
const successMsg  = ref(false)
const joinedRooms = ref([])
const currentUser = ref(null)
const activeMenu = ref(null)
//Modal loading state
const isLeaveModalOpen = ref(false)
const roomToLeave = ref(null)
const leaveLoading = ref(false)

onMounted(async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) { router.push('/'); return }
  const role = user.user_metadata?.role
  router.push(role === 'company' ? '/company' : '/join')

  currentUser.value = user
  await fetchJoinedRooms(user.id)

})

function getPHDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Fetch rooms the current user has JOINED (via room_members)
async function fetchJoinedRooms(uid) {
  roomsLoading.value = true

  // 1. Get all room_ids this user joined
  const { data: memberRows, error: memberErr } = await supabase
    .from('room_members')
    .select('room_id, joined_at')
    .eq('user_id', uid)

  if (memberErr || !memberRows?.length) {
    joinedRooms.value = []
    roomsLoading.value = false
    return
  }

  const roomIds = memberRows.map(m => m.room_id)
  const joinedAtMap = Object.fromEntries(memberRows.map(m => [m.room_id, m.joined_at]))

  // 2. Fetch those rooms' details
  const { data: rooms, error: roomsErr } = await supabase
    .from('rooms')
    .select('*')
    .in('id', roomIds)
    .order('created_at', { ascending: false })

  if (roomsErr) { console.log(roomsErr); roomsLoading.value = false; return }
  

  joinedRooms.value = (rooms || []).map(r => ({
    ...r,
    joined_at: joinedAtMap[r.id] || null,
  }))

  roomsLoading.value = false
}

async function joinRoom() {
  if (!code.value.trim()) { errorMsg.value = 'Please enter a room code.'; return }

  loading.value = true
  errorMsg.value = ''

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) { loading.value = false; router.push('/'); return }

  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('room_code', code.value.trim())
    .single()

  if (error || !room) {
    loading.value = false
    errorMsg.value = 'Invalid room code. Please check and try again.'
    return
  }

  const { error: insertError } = await supabase
    .from('room_members')
    .insert({ room_id: room.id, user_id: user.id, joined_at: getPHDateString() })

  loading.value = false

  if (insertError) {
    console.log(insertError)
    errorMsg.value = insertError.code === '23505'
      ? 'You are already a member of this room.'
      : 'Failed to join room. Please try again.'
    return
  }

  successMsg.value = true
  code.value = ''
  await fetchJoinedRooms(user.id)
}

// The actual deletion logic
async function confirmLeave() {
  if (!roomToLeave.value) return
  
  leaveLoading.value = true
  try {
    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomToLeave.value.id)
      .eq('user_id', currentUser.value.id)

    if (error) throw error

    // Update local state
    joinedRooms.value = joinedRooms.value.filter(r => r.id !== roomToLeave.value.id)
    closeLeaveModal()
  } catch (err) {
    console.error('Error:', err)
    alert('Failed to leave room.')
  } finally {
    leaveLoading.value = false
  }
}

function toggleMenu(roomId) {
  activeMenu.value = activeMenu.value === roomId ? null : roomId
}

function openLeaveModal(room) {
  roomToLeave.value = room
  isLeaveModalOpen.value = true
  activeMenu.value = null // Close the 3-dot menu
}

// Close the modal
function closeLeaveModal() {
  isLeaveModalOpen.value = false
  roomToLeave.value = null
}

onMounted(() => {
  window.addEventListener('click', () => activeMenu.value = null)
})
</script>

<template>
  <div :class="['app-root', darkMode ? 'light' : 'dark']">
    <AppSidebar />

    <div class="main-wrapper">
      <AppNavbar title="Join Room">
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
        <div class="page-inner">

          <!-- PAGE HEADER -->
          <div class="page-header">
            <h1 class="page-title">Rooms</h1>
            <p class="page-subtitle">Join a room or view rooms you're already a member of.</p>
          </div>

          <!-- TOP ROW: join form (left) + how it works (right) -->
          <div class="top-grid">

            <!-- LEFT: join form + success -->
            <div class="left-col">

              <!-- SUCCESS BANNER -->
              <div v-if="successMsg" class="success-banner">
                <div class="success-banner__icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p class="success-banner__title">Joined successfully!</p>
                  <p class="success-banner__desc">You're now a member of the room. It appears below.</p>
                </div>
                <button class="success-banner__close" @click="successMsg = false">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>

              <!-- JOIN CARD -->
              <div class="join-card">
                <div class="join-card__header">
                  <div class="join-card__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h2 class="join-card__title">Join a Room</h2>
                    <p class="join-card__desc">Enter the code shared by your supervisor.</p>
                  </div>
                </div>

                <div class="join-card__body">
                  <div class="input-group">
                    <label class="input-label">Room Code</label>
                    <div :class="['code-input-wrap', errorMsg ? 'code-input-wrap--error' : '']">
                      <svg class="code-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
                        <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <input
                        class="code-input"
                        v-model="code"
                        placeholder="e.g. ABC123"
                        maxlength="20"
                        @keyup.enter="joinRoom"
                        @input="errorMsg = ''"
                        autocomplete="off"
                        spellcheck="false"
                      />
                    </div>
                    <p v-if="errorMsg" class="error-msg">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                      {{ errorMsg }}
                    </p>
                  </div>

                  <button class="join-btn" @click="joinRoom" :disabled="loading || !code.trim()">
                    <svg v-if="!loading" width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" class="spin">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    {{ loading ? 'Joining…' : 'Join Room' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- RIGHT: how it works -->
            <div class="info-panel">
              <p class="info-panel__title">How it works</p>
              <div class="info-steps">
                <div class="info-step">
                  <div class="info-step__num">1</div>
                  <div>
                    <p class="info-step__title">Get the code</p>
                    <p class="info-step__desc">Ask your supervisor for the room code assigned to your OJT group.</p>
                  </div>
                </div>
                <div class="info-step__connector"></div>
                <div class="info-step">
                  <div class="info-step__num">2</div>
                  <div>
                    <p class="info-step__title">Enter and join</p>
                    <p class="info-step__desc">Type the code above and click Join Room.</p>
                  </div>
                </div>
                <div class="info-step__connector"></div>
                <div class="info-step">
                  <div class="info-step__num">3</div>
                  <div>
                    <p class="info-step__title">Logs become visible</p>
                    <p class="info-step__desc">Your OJT logs will be visible to the room supervisor.</p>
                  </div>
                </div>
              </div>
              <div class="info-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5"/>
                  <path d="M12 17V11" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                  <circle cx="12" cy="7" r="1.25" fill="currentColor"/>
                </svg>
                <span>You can only join a room once per code.</span>
              </div>
            </div>

          </div>

          <!-- BOTTOM: your rooms (full width) -->
          <div class="rooms-section">
            <div class="rooms-header">
              <div>
                <p class="rooms-title">Your Rooms</p>
                <p class="rooms-subtitle">Rooms you have joined as a member</p>
              </div>
              <span class="rooms-count" v-if="!roomsLoading">
                {{ joinedRooms.length }} room{{ joinedRooms.length !== 1 ? 's' : '' }}
              </span>
            </div>

            <!-- SKELETON LOADING -->
            <div v-if="roomsLoading" class="rooms-grid">
              <div v-for="n in 3" :key="n" class="room-skeleton">
                <div class="room-skeleton__top">
                  <div class="skeleton skeleton--avatar"></div>
                  <div class="room-skeleton__lines">
                    <div class="skeleton skeleton--title"></div>
                    <div class="skeleton skeleton--subtitle"></div>
                  </div>
                  <div class="skeleton skeleton--pill"></div>
                </div>
                <div class="skeleton skeleton--divider"></div>
                <div class="room-skeleton__footer">
                  <div class="skeleton skeleton--tag"></div>
                  <div class="skeleton skeleton--badge"></div>
                </div>
              </div>
            </div>

            <!-- EMPTY -->
            <div v-else-if="joinedRooms.length === 0" class="state-box state-box--empty">
              <div class="state-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
              <p class="state-title">No rooms yet</p>
              <p class="state-desc">Enter a room code above to join your first room.</p>
            </div>

            <!-- ROOMS GRID -->
            <div v-else class="rooms-grid">
              <div
                v-for="(room, i) in joinedRooms"
                :key="room.id"
                class="room-card"
                :style="{ animationDelay: i * 60 + 'ms' }"
              >
            <div class="room-card__top">
              <div class="room-card__avatar">
                {{ room.company_name?.charAt(0)?.toUpperCase() || 'R' }}
              </div>
              <div class="room-card__body">
                <p class="room-card__name">{{ room.company_name }}</p>
                <p class="room-card__meta">Created by {{ room.created_by }}</p>
                <p class="room-card__meta">Joined {{ formatDate(room.joined_at) }}</p>
              </div>
              
              <!-- ACTIONS WRAPPER -->
              <div class="room-card__actions">
                <div class="room-code-pill">{{ room.room_code }}</div>
                
                <!-- THREE DOT MENU -->
                <div class="menu-container">
                  <button class="menu-dot-btn" @click.stop="toggleMenu(room.id)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
                    </svg>
                  </button>

                  <!-- DROPDOWN -->
                  <div v-if="activeMenu === room.id" class="menu-dropdown">
                    <button class="menu-item menu-item--danger" @click.stop="openLeaveModal(room)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                      </svg>
                      Leave Room
                    </button>
                  </div>
                </div>
              </div>
            </div>

                <div class="room-card__footer">
                  <div class="room-card__stat">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
                      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Created {{ formatDate(room.created_at) }}
                  </div>
                  <div class="room-card__badge">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                      <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Member
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  </div>

<!-- LEAVE ROOM MODAL -->
<Transition name="fade">
  <div v-if="isLeaveModalOpen" class="modal-overlay" @click.self="closeLeaveModal">
    <div class="modal-content">
      <div class="modal-header">
        <!-- Switched to Blue Icon Container -->
        <div class="modal-icon--blue">
          <!-- Door/Exit Icon -->
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>
        <div>
          <h3 class="modal-title">Leave Room</h3>
          <p class="modal-subtitle">Confirm your departure from <strong>{{ roomToLeave?.company_name }}</strong></p>
        </div>
      </div>

      <div class="modal-body">
        <p>This will remove your access to the current logs. You'll need the room code to rejoin later.</p>
      </div>

      <div class="modal-footer">
        <button 
          class="btn-secondary" 
          @click="closeLeaveModal" 
          :disabled="leaveLoading"
        >
          Stay in Room
        </button>
        
        <!-- Updated to Blue Button Class -->
        <button 
          class="btn-primary-blue" 
          @click="confirmLeave" 
          :disabled="leaveLoading"
        >
          <span v-if="leaveLoading">Processing...</span>
          <span v-else>Confirm Leave</span>
        </button>
      </div>
    </div>
  </div>
</Transition>
  
</template>

<style scoped>
.app-root {
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px; --space-12: 48px;
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
  --accent-red: #ef4444; --accent-red-bg: rgba(239,68,68,0.08);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4); --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
}

.light {
  --bg: #f8f8fa; --bg-secondary: #ffffff; --bg-tertiary: #f1f1f5;
  --bg-elevated: #ffffff; --bg-hover: #f4f4f6;
  --border: rgba(0,0,0,0.07); --border-strong: rgba(0,0,0,0.12);
  --text-primary: #09090b; --text-secondary: #52525b; --text-muted: #a1a1aa;
  --accent-blue: #2563eb; --accent-blue-bg: rgba(37,99,235,0.08);
  --accent-green: #16a34a; --accent-green-bg: rgba(22,163,74,0.08);
  --accent-red: #dc2626; --accent-red-bg: rgba(220,38,38,0.06);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08); --shadow-md: 0 4px 16px rgba(0,0,0,0.1);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

.main-wrapper { flex: 1; display: flex; flex-direction: column; margin-left: var(--sidebar-width); min-height: 100vh; background: var(--bg); }
.main-content { flex: 1; padding: var(--space-8); }
.page-inner   { width: 100%; animation: fadeUp 0.35s ease both; }

.page-header  { margin-bottom: var(--space-6); }
.page-title   { font-size: 22px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.4px; margin-bottom: 4px; }
.page-subtitle{ font-size: 13px; color: var(--text-secondary); }

/* GRID */
.top-grid  { display: grid; grid-template-columns: 1fr 340px; gap: var(--space-6); align-items: start; margin-bottom: var(--space-8); }
.left-col  { display: flex; flex-direction: column; gap: var(--space-4); }

/* SUCCESS BANNER */
.success-banner {
  display: flex; align-items: flex-start; gap: var(--space-3);
  padding: var(--space-4); border-radius: var(--radius-md);
  background: var(--accent-green-bg); border: 1px solid rgba(34,197,94,0.25);
  animation: fadeUp 0.3s ease both;
}
.success-banner__icon { width: 32px; height: 32px; border-radius: var(--radius-sm); flex-shrink: 0; background: var(--accent-green); color: #fff; display: flex; align-items: center; justify-content: center; }
.success-banner__title { font-size: 13px; font-weight: 600; color: var(--accent-green); margin-bottom: 2px; }
.success-banner__desc  { font-size: 12px; color: var(--text-secondary); }
.success-banner__close { margin-left: auto; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; display: flex; flex-shrink: 0; transition: color var(--transition); }
.success-banner__close:hover { color: var(--text-primary); }

/* JOIN CARD */
.join-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
.join-card__header { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-5); border-bottom: 1px solid var(--border); background: var(--bg-tertiary); }
.join-card__icon { width: 36px; height: 36px; border-radius: var(--radius-sm); flex-shrink: 0; background: var(--accent-blue-bg); color: var(--accent-blue); display: flex; align-items: center; justify-content: center; }
.join-card__title { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 3px; }
.join-card__desc  { font-size: 12px; color: var(--text-secondary); }
.join-card__body  { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }

/* INPUT */
.input-group { display: flex; flex-direction: column; gap: var(--space-2); }
.input-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
.code-input-wrap { display: flex; align-items: center; gap: var(--space-3); padding: 0 var(--space-3); background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); transition: border-color var(--transition), box-shadow var(--transition); }
.code-input-wrap:focus-within { border-color: var(--accent-blue); box-shadow: 0 0 0 3px var(--accent-blue-bg); }
.code-input-wrap--error { border-color: var(--accent-red) !important; box-shadow: 0 0 0 3px var(--accent-red-bg) !important; }
.code-input-icon { color: var(--text-muted); flex-shrink: 0; }
.code-input { flex: 1; padding: 11px 0; background: transparent; border: none; outline: none; color: var(--text-primary); font-size: 15px; font-weight: 600; font-family: var(--font-mono); letter-spacing: 0.08em; }
.code-input::placeholder { color: var(--text-muted); font-weight: 400; letter-spacing: 0; font-size: 13px; font-family: var(--font-sans); }
.error-msg { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--accent-red); animation: fadeUp 0.2s ease both; }

/* JOIN BTN */
.join-btn { display: flex; align-items: center; justify-content: center; gap: var(--space-2); width: 100%; padding: var(--space-3); background: var(--accent-blue); color: #fff; border: none; border-radius: var(--radius-sm); font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: var(--font-sans); transition: opacity var(--transition), transform var(--transition); box-shadow: 0 2px 8px rgba(59,130,246,0.25); }
.join-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
.join-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

/* INFO PANEL */
.info-panel { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-5); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: var(--space-4); }
.info-panel__title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
.info-steps { display: flex; flex-direction: column; }
.info-step  { display: flex; align-items: flex-start; gap: var(--space-3); }
.info-step__num { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; background: var(--accent-blue-bg); color: var(--accent-blue); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.info-step__title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
.info-step__desc  { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
.info-step__connector { width: 1px; height: 18px; background: var(--border); margin-left: 10px; }
.info-note {
  display: inline-flex; 
  align-items: center;
  gap: 8px; 
  padding: var(--space-3); 
  background: var(--bg-tertiary); 
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px; 
  color: var(--text-muted);
  line-height: 1.5; }
.info-note svg {
  flex-shrink: 0;        /* Prevents the SVG from squishing on small screens */
  display: block;        /* Removes the default inline "ghost" padding at the bottom */
}
/* ROOMS SECTION (full width below) */
.rooms-section { display: flex; flex-direction: column; gap: var(--space-4); }

.rooms-header   { display: flex; align-items: center; justify-content: space-between; }
.rooms-title    { font-size: 15px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.2px; margin-bottom: 3px; }
.rooms-subtitle { font-size: 12px; color: var(--text-muted); }
.rooms-count    { font-size: 12px; color: var(--text-muted); background: var(--bg-tertiary); border: 1px solid var(--border); padding: 2px 10px; border-radius: 99px; }

/* ROOMS GRID (responsive auto-fill) */
.rooms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); }

.room-card {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  display: flex; flex-direction: column; gap: var(--space-4);
  animation: fadeUp 0.3s ease both;
  transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
}
.room-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--border-strong); }

.room-card__top  { display: flex; align-items: center; gap: var(--space-3); }
.room-card__body { flex: 1; }

.room-card__avatar {
  width: 44px; height: 44px; border-radius: var(--radius-md); flex-shrink: 0;
  background: var(--accent-blue-bg); color: var(--accent-blue);
  font-size: 18px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}

.room-card__name { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 3px; letter-spacing: -0.2px; }
.room-card__meta { font-size: 12px; color: var(--text-muted); }

.room-code-pill {
  font-family: var(--font-mono); font-size: 11px; font-weight: 700;
  letter-spacing: 0.1em; color: var(--text-secondary);
  background: var(--bg-tertiary); border: 1px solid var(--border);
  padding: 4px 10px; border-radius: 99px; flex-shrink: 0;
}

.room-card__footer {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: var(--space-4); border-top: 1px solid var(--border);
}

.room-card__stat {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--text-muted);
}

.room-card__badge {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; color: var(--accent-green);
  background: var(--accent-green-bg); border: 1px solid rgba(34,197,94,0.2);
  padding: 3px 10px; border-radius: 99px;
}

/* SKELETON */
.room-skeleton {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-4);
}
.room-skeleton__top    { display: flex; align-items: center; gap: var(--space-3); }
.room-skeleton__lines  { flex: 1; display: flex; flex-direction: column; gap: var(--space-2); }
.room-skeleton__footer { display: flex; align-items: center; justify-content: space-between; }

.skeleton {
  background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}
.skeleton--avatar   { width: 44px; height: 44px; border-radius: var(--radius-md); flex-shrink: 0; }
.skeleton--title    { height: 14px; width: 60%; }
.skeleton--subtitle { height: 12px; width: 40%; }
.skeleton--pill     { height: 24px; width: 64px; border-radius: 99px; }
.skeleton--divider  { height: 1px; background: var(--border); animation: none; }
.skeleton--tag      { height: 14px; width: 100px; }
.skeleton--badge    { height: 22px; width: 68px; border-radius: 99px; }

/* STATE BOXES */
.state-box { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-3); padding: var(--space-12) var(--space-6); font-size: 13px; color: var(--text-muted); }
.state-box--empty { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); }
.state-icon  { width: 52px; height: 52px; border-radius: var(--radius-lg); background: var(--bg-tertiary); color: var(--text-muted); display: flex; align-items: center; justify-content: center; }
.state-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.state-desc  { font-size: 13px; color: var(--text-secondary); text-align: center; max-width: 240px; }


.back-btn { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: none; color: var(--text-secondary); font-size: 13px; font-weight: 500; text-decoration: none; transition: all var(--transition); }
.back-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* SPINNER */
.spinner { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border-strong); border-top-color: var(--accent-blue); animation: spin 0.7s linear infinite; }

/* ROOM CARD ACTIONS */
.room-card__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.menu-container {
  position: relative;
}

.menu-dot-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: var(--space-1);
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
}

.menu-dot-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* DROPDOWN MENU */
.menu-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 20;
  min-width: 140px;
  overflow: hidden;
  animation: fadeUp 0.15s ease both;
}

.menu-item {
  width: 100%;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: pointer;
  text-align: left;
  transition: background var(--transition);
}

.menu-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.menu-item--danger {
  color: var(--accent-red);
}

.menu-item--danger:hover {
  background: var(--accent-red-bg);
  color: var(--accent-red);
}

/* MODAL STYLES - BLUE PALETTE */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* Deep Navy/Blue tint for the overlay */
  background: rgba(15, 23, 42, 0.7); 
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.modal-content {
  /* Solid White/Very Light Blue background to prevent transparency issues */
  background: #ffffff; 
  border: 1px solid #e0e7ff;
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  animation: modalPop 0.2s ease-out;
  overflow: hidden;
}

.modal-header {
  padding: 24px 24px 16px;
  display: flex;
  gap: 16px;
}

/* Changed icon to a soft blue circle */
.modal-icon--blue {
  width: 44px;
  height: 44px;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.modal-subtitle {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.modal-body {
  padding: 0 24px 24px;
  font-size: 14px;
  line-height: 1.6;
  color: #475569;
}

.modal-footer {
  padding: 16px 24px;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* BUTTONS */
.btn-secondary {
  background: white;
  border: 1px solid #e2e8f0;
  color: #475569;
  padding: 10px 18px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.btn-primary-blue {
  background: #eb2525;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary-blue:hover {
  background: #af2121;
}

.btn-primary-blue:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

/* Keep your existing animations */
@keyframes modalPop {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes spin   { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

@media (max-width: 900px)  { .top-grid { grid-template-columns: 1fr; } .rooms-grid { grid-template-columns: 1fr; } }
@media (max-width: 768px)  { .main-wrapper { margin-left: 0; } .main-content { padding: var(--space-5) var(--space-4); } }
</style>