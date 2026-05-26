<script setup>
import { ref, onMounted } from 'vue'
import * as XLSX from 'xlsx'

import { supabase } from '../supabase'
import { useRouter, useRoute } from 'vue-router'
import { useLayout } from '../composables/useLayout'
import AppSidebar from '../components/sidebar.vue'
import AppNavbar from '../components/navbar.vue'
const router = useRouter()
const route  = useRoute()
const { darkMode } = useLayout()

const room       = ref(null)
const members    = ref([]) 
const loading    = ref(true)
const roomId     = route.params.id
const exporting = ref(false)
const fullname = ref('')

// Track which individual log description text blocks are fully expanded
const expandedLogs = ref({})

onMounted(async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) { router.push('/'); return }

  const role = user.user_metadata?.role
  fullname.value = user.user_metadata?.full_name
  if (role !== 'company') { router.push('/dashboard'); return }

  await loadRoom()
  await loadMembers()
  loading.value = false
})

async function loadRoom() {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single()

  if (error || !data) { router.back(); return }
  room.value = data
}

async function loadMembers() {
  const { data: roomMemberRows, error: membersErr } = await supabase
    .from('room_members')
    .select('user_id, joined_at')
    .eq('room_id', roomId)

  if (membersErr || !roomMemberRows?.length) { members.value = []; return }

  const userIds = roomMemberRows.map(m => m.user_id)
  const joinedMap = Object.fromEntries(roomMemberRows.map(m => [m.user_id, m.joined_at]))

  const { data: profileRows } = await supabase
    .rpc('get_user_emails', { user_ids: userIds })

  let emailMap = {}
  let fullNameMap = {}

  if (profileRows) {
    profileRows.forEach(r => {
      emailMap[r.id] = r.email
      fullNameMap[r.id] = r.full_name || null
    })
  }

  const { data: logs, error: logsErr } = await supabase
    .from('ojt_logs')
    .select('*')
    .in('user_id', userIds)
    .order('date', { ascending: false })

  if (logsErr) { console.log(logsErr) }

    members.value = userIds.map(uid => {
      const userLogs = (logs || []).filter(l => l.user_id === uid)
      const totalHours = userLogs.reduce((sum, l) => sum + (Number(l.total_hours) || 0), 0)
      return {
        user_id: uid,
        email: emailMap[uid] || null,
        fullName: fullNameMap[uid] || null,   // <-- add this
        joined_at: joinedMap[uid] || null,
        logs: userLogs,
        totalHours: Math.round(totalHours * 1000) / 1000,
      }
    })
}

function formatTimeExcel(iso) {
  if (!iso) return '—'
  const ref = iso.includes('T') ? iso : `1970-01-01T${iso}`
  return new Date(ref).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

async function exportAllUsersLogsToExcel() {
  if (exporting.value || members.value.length === 0) return
  exporting.value = true

  try {
    const workbook = XLSX.utils.book_new()

    for (const member of members.value) {
      const rows =
        member.logs.length > 0
          ? member.logs
              .slice()
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((log, i) => ({
                'No. Days': i + 1,
                'Date': log.date ? new Date(log.date).toLocaleDateString('en-PH') : '—',
                'Morning In': formatTimeExcel(log.morning_in),
                'Morning Out': formatTimeExcel(log.morning_out),
                'Afternoon In': formatTimeExcel(log.afternoon_in),
                'Afternoon Out': formatTimeExcel(log.afternoon_out),
                'Rendered Hours': log.total_hours ?? 0,
                'Accomplished Tasks': log.description || 'No entry details.',
              }))
          : [{
              'No. Days': '—', 'Date': '—', 'Morning In': '—', 'Morning Out': '—',
              'Afternoon In': '—', 'Afternoon Out': '—', 'Rendered Hours': '—',
              'Accomplished Tasks': 'No logs recorded.',
            }]

      const worksheet = XLSX.utils.json_to_sheet(rows)
      worksheet['!cols'] = [
        { wch: 8 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 45 },
      ]

    const rawName = member.fullName
      ? member.fullName                      // prefer full name if available
      : member.email
        ? member.email.split('@')[0]         // fallback to email prefix
        : member.user_id.slice(0, 12)        // last resort: user_id

    const sheetName = rawName.replace(/[\\/:*?[\]]/g, '_').substring(0, 31)

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    }

    const roomLabel = room.value?.company_name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Room'
    XLSX.writeFile(workbook, `${roomLabel}_All_Logs.xlsx`)
  } catch (err) {
    console.error('Export failed:', err)
    alert('Failed to export logs.')
  } finally {
    exporting.value = false
  }
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

function displayName(member) {
  if (member.email) return member.email
  return member.user_id.slice(0, 12) + '…'
}

function avatarChar(member) {
  if (member.email) return member.email[0].toUpperCase()
  return '?'
}

const collapsed = ref({})
function toggleMember(uid) {
  collapsed.value[uid] = !collapsed.value[uid]
}

// Click function to toggle expansion state of descriptions
function toggleLogDescription(logId) {
  expandedLogs.value[logId] = !expandedLogs.value[logId]
}

const totalRoomHours = () =>
  members.value.reduce((sum, m) => sum + m.totalHours, 0).toFixed(3)
</script>

<template>
  <div :class="['app-root', darkMode ? 'light' : 'dark']">
    <AppSidebar />

    <div class="main-wrapper">
      <AppNavbar :title="room?.company_name || 'Room Detail'">
        <template #actions>
          <button @click="router.back()" class="back-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Rooms
          </button>

          <!-- ADD THIS -->
          <button
            v-if="!loading && members.length > 0"
            @click="exportAllUsersLogsToExcel"
            :disabled="exporting"
            class="export-btn"
            title="Download Excel Logs"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v13M7 11l5 5 5-5M5 21h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
              <span>{{ exporting ? 'Exporting…' : 'Export All Logs' }}</span>
          </button>
        </template>
      </AppNavbar>

      <main class="main-content">

        <!-- SKELETON LOADING -->
        <div v-if="loading" class="skeleton-wrap">
          <div class="sk-hero">
            <div class="skeleton sk-avatar"></div>
            <div class="sk-hero-info">
              <div class="skeleton sk-title"></div>
              <div class="sk-meta-row">
                <div class="skeleton sk-chip"></div>
                <div class="skeleton sk-chip"></div>
              </div>
            </div>
            <div class="sk-hero-stats">
              <div class="skeleton sk-stat-item"></div>
              <div class="skeleton sk-stat-item"></div>
              <div class="skeleton sk-stat-item"></div>
            </div>
          </div>
          <div class="sk-list">
            <div class="skeleton sk-block" v-for="n in 3" :key="n"></div>
          </div>
        </div>

        <!-- CONTENT REALM -->
        <div v-else class="page-inner">

          <!-- ROOM HEADER HERO -->
          <div class="room-hero">
            <div class="room-hero__avatar">
              {{ room?.company_name?.charAt(0)?.toUpperCase() || 'R' }}
            </div>
            <div class="room-hero__info">
              <h1 class="room-hero__title">{{ room?.company_name }}</h1>
              <div class="room-hero__meta">
                <span class="meta-chip">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  {{ room?.room_code }}
                </span>
                <span class="meta-chip">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  Created {{ formatDate(room?.created_at) }}
                </span>
              </div>
            </div>

            <!-- SUMMARY STATS -->
            <div class="room-stats">
              <div class="room-stat">
                <span class="room-stat__val">{{ members.length }}</span>
                <span class="room-stat__label">Members</span>
              </div>
              <div class="room-stat-divider"></div>
              <div class="room-stat">
                <span class="room-stat__val">{{ totalRoomHours() }}</span>
                <span class="room-stat__label">Total Hrs</span>
              </div>
              <div class="room-stat-divider"></div>
              <div class="room-stat">
                <span class="room-stat__val">{{ members.reduce((s, m) => s + m.logs.length, 0) }}</span>
                <span class="room-stat__label">Log Entries</span>
              </div>
            </div>
          </div>

          <!-- TRAINEE MEMBERS SYSTEM -->
          <div v-if="members.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            </div>
            <p class="empty-title">No members yet</p>
            <p class="empty-desc">Share the room code <strong>{{ room?.room_code }}</strong> with your trainees so they can join.</p>
          </div>

          <div v-else class="members-list">
            <div
              v-for="(member, idx) in members"
              :key="member.user_id"
              class="member-block"
              :style="{ animationDelay: idx * 60 + 'ms' }"
            >
              <!-- MEMBER HEADER ROW -->
              <div class="member-header" @click="toggleMember(member.user_id)">
                <div class="member-header__left">
                  <div class="member-avatar">{{ avatarChar(member) }}</div>
                  <div class="member-title-area">
                    <p class="member-email">{{ displayName(member) }}</p>
                    <p class="member-joined">Joined {{ formatDate(member.joined_at) }} · {{ member.logs.length }} log{{ member.logs.length !== 1 ? 's' : '' }}</p>
                  </div>
                </div>
                <div class="member-header__right">
                  <div class="member-hours-badge">
                    <span class="member-hours-badge__val">{{ member.totalHours }}</span>
                    <span class="member-hours-badge__unit">hrs</span>
                  </div>
                  <svg
                    :class="['chevron', collapsed[member.user_id] ? '' : 'chevron--open']"
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              </div>

              <!-- EXPANDED LOG PANELS -->
              <div v-if="!collapsed[member.user_id]" class="log-section">
                <div v-if="member.logs.length === 0" class="no-logs">
                  No logs submitted yet.
                </div>

                <div v-else class="log-table-wrapper">
                  <div class="log-table">
                    <div class="log-table__head">
                      <span>Date</span>
                      <span>Morning In</span>
                      <span>Morning Out</span>
                      <span>Afternoon In</span>
                      <span>Afternoon Out</span>
                      <span>Description</span>
                      <span class="col-right">Hours</span>
                    </div>
                    <div
                      v-for="log in member.logs"
                      :key="log.id"
                      class="log-table__row"
                    >
                      <span class="cell cell--date">{{ formatDate(log.date) }}</span>
                      <span class="cell">{{ formatTime(log.morning_in) }}</span>
                      <span class="cell">{{ formatTime(log.morning_out) }}</span>
                      <span class="cell">{{ formatTime(log.afternoon_in) }}</span>
                      <span class="cell">{{ formatTime(log.afternoon_out) }}</span>
                      
                      <!-- CLICKABLE ELLIPSIS CELL BLOCK -->
                      <span 
                        class="cell cell--desc cell--clickable" 
                        @click="toggleLogDescription(log.id)"
                        :title="expandedLogs[log.id] ? 'Click to collapse description' : 'Click to read full description'"
                      >
                        <span :class="expandedLogs[log.id] ? 'expanded-text' : 'ellipsis-text'">
                          {{ log.description || '—' }}
                        </span>
                      </span>

                      <span class="cell cell--hours">{{ log.total_hours }}h</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  </div>
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
  --accent-amber: #f59e0b; --accent-amber-bg: rgba(245,158,11,0.1);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4); --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
}

.light {
  --bg: #f8f8fa; --bg-secondary: #ffffff; --bg-tertiary: #f1f1f5;
  --bg-elevated: #ffffff; --bg-hover: #f4f4f6;
  --border: rgba(0,0,0,0.07); --border-strong: rgba(0,0,0,0.12);
  --text-primary: #09090b; --text-secondary: #52525b; --text-muted: #a1a1aa;
  --accent-blue: #2563eb; --accent-blue-bg: rgba(37,99,235,0.08);
  --accent-green: #16a34a; --accent-green-bg: rgba(22,163,74,0.08);
  --accent-amber: #d97706; --accent-amber-bg: rgba(217,119,6,0.08);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08); --shadow-md: 0 4px 16px rgba(0,0,0,0.1);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

.main-wrapper { flex: 1; display: flex; flex-direction: column; margin-left: var(--sidebar-width); min-height: 100vh; background: var(--bg); width: 100%; min-width: 0; }
.main-content { flex: 1; padding: var(--space-8); min-width: 0; }

.page-inner { animation: fadeUp 0.35s ease both; }

/* BACK BUTTON */
.back-btn { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: none; color: var(--text-secondary); font-size: 13px; font-weight: 500; text-decoration: none; cursor: pointer; transition: all var(--transition); }
.back-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ROOM HERO */
.room-hero {
  display: flex; align-items: center; gap: var(--space-5);
  padding: var(--space-6); margin-bottom: var(--space-6);
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
}

.room-hero__avatar {
  width: 56px; height: 56px; border-radius: var(--radius-md); flex-shrink: 0;
  background: var(--accent-blue-bg); color: var(--accent-blue);
  font-size: 22px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}

.room-hero__info { flex: 1; min-width: 0; }
.room-hero__title { font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.3px; margin-bottom: var(--space-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.room-hero__meta { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }

.meta-chip {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--text-secondary);
  background: var(--bg-tertiary); border: 1px solid var(--border);
  padding: 3px 10px; border-radius: 99px;
  font-family: var(--font-mono); font-weight: 500;
}

.room-stats { display: flex; align-items: center; gap: var(--space-5); flex-shrink: 0; }
.room-stat { text-align: center; }
.room-stat__val { display: block; font-size: 22px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px; font-variant-numeric: tabular-nums; }
.room-stat__label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.room-stat-divider { width: 1px; height: 32px; background: var(--border); }

/* EMPTY STATE */
.empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-3); padding: var(--space-12) var(--space-6); background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); }
.empty-icon { width: 60px; height: 60px; border-radius: var(--radius-lg); background: var(--bg-tertiary); color: var(--text-muted); display: flex; align-items: center; justify-content: center; }
.empty-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.empty-desc { font-size: 13px; color: var(--text-secondary); max-width: 300px; line-height: 1.5; }

/* MEMBERS LIST */
.members-list { display: flex; flex-direction: column; gap: var(--space-4); }
.member-block { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); animation: fadeUp 0.3s ease both; }

.member-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-5); cursor: pointer; transition: background var(--transition); gap: var(--space-4); }
.member-header:hover { background: var(--bg-hover); }

.member-header__left { display: flex; align-items: center; gap: var(--space-3); min-width: 0; flex: 1; }
.member-title-area { min-width: 0; flex: 1; }
.member-header__right { display: flex; align-items: center; gap: var(--space-4); flex-shrink: 0; }

.member-avatar { width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; background: var(--accent-amber-bg); color: var(--accent-amber); font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.member-email { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.member-joined { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.member-hours-badge { display: flex; align-items: baseline; gap: 3px; }
.member-hours-badge__val { font-size: 20px; font-weight: 800; color: var(--accent-blue); letter-spacing: -0.5px; font-variant-numeric: tabular-nums; }
.member-hours-badge__unit { font-size: 12px; color: var(--text-muted); }

.chevron { color: var(--text-muted); transition: transform var(--transition); flex-shrink: 0; }
.chevron--open { transform: rotate(180deg); }

/* LOG SECTION */
.log-section { border-top: 1px solid var(--border); background: var(--bg-tertiary); }
.no-logs { padding: var(--space-5); font-size: 13px; color: var(--text-muted); text-align: center; }

/* LOG TABLE CONFIG */
.log-table-wrapper { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.log-table { min-width: 820px; width: 100%; }

.log-table__head,
.log-table__row {
  display: grid;
  grid-template-columns: 120px 100px 100px 110px 110px minmax(180px, 1fr) 80px;
}

.log-table__head {
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border);
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted);
  background: var(--bg-elevated);
}
.log-table__head span, .log-table__row .cell { padding: 0 var(--space-2); }

.log-table__row {
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border);
  font-size: 12.5px; color: var(--text-secondary);
  transition: background var(--transition); align-items: center;
}
.log-table__row:last-child { border-bottom: none; }
.log-table__row:hover { background: var(--bg-hover); }

.cell { font-variant-numeric: tabular-nums; display: flex; align-items: center; min-width: 0; }
.cell--date { color: var(--text-primary); font-weight: 600; font-size: 12.5px; }

/* CLICKABLE DESCRIPTION STYLES */
.cell--desc { display: block; overflow: hidden; }
.cell--clickable { cursor: pointer; border-radius: var(--radius-sm); transition: background var(--transition), color var(--transition); }
.cell--clickable:hover { background: var(--bg-hover); color: var(--text-primary); }

.ellipsis-text { display: block; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
.expanded-text { display: block; width: 100%; white-space: normal; word-break: break-word; font-size: 12px; padding: var(--space-1) 0; line-height: 1.4; color: var(--text-primary); }

.cell--hours { font-weight: 700; color: var(--accent-blue); justify-content: flex-end; text-align: right; }
.col-right { text-align: right; justify-content: flex-end; display: flex; }

/* SKELETON INFRASTRUCTURE */
.skeleton-wrap { animation: fadeUp 0.3s ease both; }
.skeleton {
  background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%);
  background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-sm);
}
.sk-hero { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-6); background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-bottom: var(--space-6); }
.sk-avatar { width: 56px; height: 56px; border-radius: var(--radius-md); flex-shrink: 0; }
.sk-hero-info { flex: 1; display: flex; flex-direction: column; gap: var(--space-2); }
.sk-title { height: 20px; width: 180px; }
.sk-meta-row { display: flex; gap: var(--space-2); }
.sk-chip { height: 22px; width: 90px; border-radius: 99px; }
.sk-hero-stats { display: flex; gap: var(--space-4); }
.sk-stat-item { height: 36px; width: 60px; }
.sk-list { display: flex; flex-direction: column; gap: var(--space-4); }
.sk-block { height: 70px; border-radius: var(--radius-lg); }

@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

/* RESPONSIVE BREAKPOINTS */
@media (max-width: 992px) {
  .room-hero { flex-direction: column; align-items: flex-start; gap: var(--space-4); }
  .room-stats { width: 100%; justify-content: flex-start; padding-top: var(--space-4); border-top: 1px solid var(--border); }
  .sk-hero { flex-direction: column; align-items: flex-start; gap: var(--space-4); }
  .sk-hero-stats { width: 100%; padding-top: var(--space-4); border-top: 1px solid var(--border); }
  .export-btn span {
    display: none;
  }
}

@media (max-width: 768px) {
  .main-wrapper { margin-left: 0 !important; }
  .main-content { padding: var(--space-5) var(--space-4); }
  .member-header { padding: var(--space-4); }
  .export-btn {
    padding: var(--space-2);  /* square icon-only button */
    min-width: 32px;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .main-content { padding: var(--space-4) var(--space-3); }
  .room-hero { padding: var(--space-4); }
  .room-stats { justify-content: space-between; gap: var(--space-2); }
  .room-stat__val { font-size: 18px; }
  .member-header { flex-direction: column; align-items: flex-start; gap: var(--space-3); position: relative; }
  .member-header__right { width: 100%; justify-content: space-between; border-top: 1px solid var(--border); padding-top: var(--space-2); }
  .chevron { position: absolute; top: var(--space-4); right: var(--space-4); }
    .export-btn {
    padding: var(--space-1) var(--space-2);
    font-size: 11px;
  }
}

.export-btn {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-blue);
  background: var(--accent-blue-bg); color: var(--accent-blue);
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all var(--transition);
}
.export-btn:hover:not(:disabled) { background: var(--accent-blue); color: #fff; }
.export-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>