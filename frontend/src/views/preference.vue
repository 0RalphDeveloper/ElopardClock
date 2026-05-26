<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'
import { useLayout } from '../composables/useLayout'
import AppSidebar from '../components/sidebar.vue'
import AppNavbar from '../components/navbar.vue'

const router = useRouter()
const { darkMode, toggleDark } = useLayout()

// User info
const user        = ref(null)
const fullName    = ref('')
const email       = ref('')
const school      = ref('')
const course      = ref('')
const yearLevel   = ref('')

// Password change
const currentPw   = ref('')
const newPw       = ref('')
const confirmPw   = ref('')
const showCurrent = ref(false)
const showNew     = ref(false)
const showConfirm = ref(false)

// Notification prefs
const notifLogs    = ref(true)
const notifReminder = ref(true)

// Loading / feedback states
const profileLoading  = ref(false)
const profileSaved    = ref(false)
const profileError    = ref('')

const pwLoading  = ref(false)
const pwSaved    = ref(false)
const pwError    = ref('')

const deleteLoading  = ref(false)
const showDeleteConfirm = ref(false)
const deleteConfirmText = ref('')

const pageLoading = ref(true)
const activeSection = ref('profile') // 'profile' | 'security' | 'appearance' | 'notifications' | 'data'

const sections = [
  { id: 'profile',       label: 'Profile',       icon: 'user'    },
  { id: 'security',      label: 'Security',      icon: 'lock'    },
  { id: 'appearance',    label: 'Appearance',    icon: 'palette' },
  { id: 'data',          label: 'Data & Account',icon: 'database'},
]


// ── DATA FETCH ────────────────────────────────────────────────────────────────
onMounted(async () => {
  const { data: { user: u }, error } = await supabase.auth.getUser()
  if (error || !u) { router.push('/'); return }
  const role = user.user_metadata?.role
  router.push(role === 'company' ? '/company' : '/preferences')


  user.value  = u
  email.value = u.email || ''

  fullName.value  = u.user_metadata?.full_name || ''
  school.value    = u.user_metadata?.school    || ''
  course.value    = u.user_metadata?.course    || ''
  yearLevel.value = u.user_metadata?.year_level || ''

  pageLoading.value = false
})

// ── SAVE PROFILE ──────────────────────────────────────────────────────────────
async function saveProfile() {
  profileError.value = ''
  if (!fullName.value.trim()) {
    profileError.value = 'Full name is required.'
    return
  }

  profileLoading.value = true

  const { error } = await supabase.auth.updateUser({
    data: {
      full_name:  fullName.value.trim(),
      school:     school.value.trim(),
      course:     course.value.trim(),
      year_level: yearLevel.value,
    }
  })

  profileLoading.value = false

  if (error) { profileError.value = error.message; return }

  profileSaved.value = true
  setTimeout(() => profileSaved.value = false, 2500)
}

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────
async function changePassword() {
  pwError.value = ''

  if (!currentPw.value || !newPw.value || !confirmPw.value) {
    pwError.value = 'Please fill in all password fields.'; return
  }
  if (newPw.value.length < 6) {
    pwError.value = 'New password must be at least 6 characters.'; return
  }
  if (newPw.value !== confirmPw.value) {
    pwError.value = 'New passwords do not match.'; return
  }

  pwLoading.value = true

  // Re-authenticate first to verify current password
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: currentPw.value,
  })

  if (signInErr) {
    pwLoading.value = false
    pwError.value = 'Current password is incorrect.'
    return
  }

  const { error } = await supabase.auth.updateUser({ password: newPw.value })

  pwLoading.value = false

  if (error) { pwError.value = error.message; return }

  currentPw.value = ''
  newPw.value     = ''
  confirmPw.value = ''
  pwSaved.value   = true
  setTimeout(() => pwSaved.value = false, 3000)
}

// ── DELETE ACCOUNT ────────────────────────────────────────────────────────────
async function deleteAccount() {
  if (deleteConfirmText.value !== 'DELETE') return
  deleteLoading.value = true

  try {
    // 1. Tell Postgres to run your function and delete the logged-in user from auth.users
    const { error } = await supabase.rpc('delete_auth_user')

    if (error) throw error

    // 2. Clean up the frontend session
    await supabase.auth.signOut()
    router.push('/')

  } catch (error) {
    console.error('Account deletion failed:', error)
    alert(error.message || 'Could not delete user profile.')
  } finally {
    deleteLoading.value = false
  }
}

function avatarInitial() {
  if (fullName.value) return fullName.value.trim()[0].toUpperCase()
  if (email.value)    return email.value[0].toUpperCase()
  return '?'
}
</script>

<template>
  <div :class="['app-root', darkMode ? 'light' : 'dark']">
    <AppSidebar />

    <div class="main-wrapper">
      <AppNavbar title="Preferences" />

      <main class="main-content">

        <!-- SKELETON -->
        <div v-if="pageLoading" class="skeleton-wrap">
          <div class="skeleton sk-heading"></div>
          <div class="pref-layout">
            <div class="skeleton sk-nav"></div>
            <div class="skeleton sk-panel"></div>
          </div>
        </div>

        <div v-else class="page-inner">

          <!-- PAGE HEADER -->
          <div class="page-header">
            <div class="page-header__avatar">{{ avatarInitial() }}</div>
            <div>
              <h1 class="page-title">{{ fullName || email }}</h1>
              <p class="page-subtitle">{{ email }}</p>
            </div>
          </div>

          <!-- TWO-COLUMN LAYOUT -->
          <div class="pref-layout">

            <!-- LEFT NAV -->
            <nav class="pref-nav">
              <button
                v-for="s in sections"
                :key="s.id"
                :class="['pref-nav__item', activeSection === s.id ? 'pref-nav__item--active' : '']"
                @click="activeSection = s.id"
              >
                <!-- User icon -->
                <svg v-if="s.icon === 'user'" width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
                </svg>
                <!-- Lock icon -->
                <svg v-if="s.icon === 'lock'" width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <!-- Palette icon -->
                <svg v-if="s.icon === 'palette'" width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                  <circle cx="8" cy="14" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="9" r="1.5" fill="currentColor"/>
                  <circle cx="16" cy="14" r="1.5" fill="currentColor"/>
                </svg>
                <!-- Bell icon -->
                <svg v-if="s.icon === 'bell'" width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <!-- Database icon -->
                <svg v-if="s.icon === 'database'" width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" stroke-width="2"/>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke="currentColor" stroke-width="2"/>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke="currentColor" stroke-width="2"/>
                </svg>
                {{ s.label }}
              </button>
            </nav>

            <!-- RIGHT PANEL -->
            <div class="pref-panel">

              <!-- ══ PROFILE ══════════════════════════════════════════════════ -->
              <div v-if="activeSection === 'profile'" class="panel-card">
                <div class="panel-card__header">
                  <p class="panel-card__title">Profile Information</p>
                  <p class="panel-card__desc">Update your personal details and academic information.</p>
                </div>

                <div class="panel-card__body">
                  <!-- Error -->
                  <div v-if="profileError" class="alert alert--error">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                      <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    {{ profileError }}
                    <button class="alert__close" @click="profileError = ''">×</button>
                  </div>

                  <!-- Success -->
                  <div v-if="profileSaved" class="alert alert--success">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Profile saved successfully!
                  </div>

                  <div class="fields-grid">
                    <div class="field">
                      <label class="field-label">Full Name</label>
                      <input class="field-input" v-model="fullName" placeholder="e.g. Juan Dela Cruz" />
                    </div>

                    <div class="field">
                      <label class="field-label">Email Address</label>
                      <input class="field-input field-input--disabled" :value="email" disabled />
                      <p class="field-hint">Email cannot be changed here.</p>
                    </div>

                    <div class="field">
                      <label class="field-label">School / University</label>
                      <input class="field-input" v-model="school" placeholder="e.g. University of the Philippines" />
                    </div>

                    <div class="field">
                      <label class="field-label">Course / Program</label>
                      <input class="field-input" v-model="course" placeholder="e.g. BS Information Technology" />
                    </div>

                    <div class="field">
                      <label class="field-label">Year Level</label>
                      <select class="field-input field-select" v-model="yearLevel">
                        <option value="">Select year level</option>
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                      </select>
                    </div>
                  </div>

                  <div class="panel-card__footer">
                    <button class="primary-btn" @click="saveProfile" :disabled="profileLoading">
                      <svg v-if="!profileLoading" width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                        <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" class="spin">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                      {{ profileLoading ? 'Saving…' : 'Save Changes' }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- ══ SECURITY ══════════════════════════════════════════════════ -->
              <div v-if="activeSection === 'security'" class="panel-card">
                <div class="panel-card__header">
                  <p class="panel-card__title">Change Password</p>
                  <p class="panel-card__desc">Keep your account secure with a strong password.</p>
                </div>

                <div class="panel-card__body">
                  <div v-if="pwError" class="alert alert--error">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                      <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    {{ pwError }}
                    <button class="alert__close" @click="pwError = ''">×</button>
                  </div>

                  <div v-if="pwSaved" class="alert alert--success">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Password updated successfully!
                  </div>

                  <div class="fields-grid">
                    <div class="field">
                      <label class="field-label">Current Password</label>
                      <div class="input-pw-wrap">
                        <input
                          class="field-input"
                          :type="showCurrent ? 'text' : 'password'"
                          v-model="currentPw"
                          placeholder="Enter current password"
                          @input="pwError = ''"
                        />
                        <button class="pw-toggle" @click="showCurrent = !showCurrent" type="button">
                          <svg v-if="!showCurrent" width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                          </svg>
                          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div class="field">
                      <label class="field-label">New Password</label>
                      <div class="input-pw-wrap">
                        <input
                          class="field-input"
                          :type="showNew ? 'text' : 'password'"
                          v-model="newPw"
                          placeholder="Min. 6 characters"
                          @input="pwError = ''"
                        />
                        <button class="pw-toggle" @click="showNew = !showNew" type="button">
                          <svg v-if="!showNew" width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                          </svg>
                          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div class="field">
                      <label class="field-label">Confirm New Password</label>
                      <div class="input-pw-wrap">
                        <input
                          class="field-input"
                          :class="confirmPw && confirmPw !== newPw ? 'field-input--error' : ''"
                          :type="showConfirm ? 'text' : 'password'"
                          v-model="confirmPw"
                          placeholder="Re-enter new password"
                          @input="pwError = ''"
                        />
                        <button class="pw-toggle" @click="showConfirm = !showConfirm" type="button">
                          <svg v-if="!showConfirm" width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                          </svg>
                          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          </svg>
                        </button>
                      </div>
                      <p v-if="confirmPw && confirmPw !== newPw" class="field-hint field-hint--error">Passwords don't match</p>
                    </div>
                  </div>

                  <div class="panel-card__footer">
                    <button class="primary-btn" @click="changePassword" :disabled="pwLoading">
                      <svg v-if="!pwLoading" width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
                        <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" class="spin">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                      {{ pwLoading ? 'Updating…' : 'Update Password' }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- ══ APPEARANCE ════════════════════════════════════════════════ -->
              <div v-if="activeSection === 'appearance'" class="panel-card">
                <div class="panel-card__header">
                  <p class="panel-card__title">Appearance</p>
                  <p class="panel-card__desc">Customize how OJTTrack looks for you.</p>
                </div>

                <div class="panel-card__body">
                  <div class="setting-row">
                    <div class="setting-row__info">
                      <p class="setting-row__title">Dark Mode</p>
                      <p class="setting-row__desc">Switch between dark and light interface theme.</p>
                    </div>
                    <button
                      :class="['toggle-switch', darkMode ? 'toggle-switch--on' : '']"
                      @click="toggleDark"
                    >
                      <span class="toggle-switch__thumb"></span>
                    </button>
                  </div>

                  <div class="theme-preview">
                    <div :class="['theme-card', !darkMode ? 'theme-card--active' : '']" @click="darkMode ? toggleDark() : null">
                      <div class="theme-card__preview theme-card__preview--light">
                        <div class="tp-sidebar"></div>
                        <div class="tp-content">
                          <div class="tp-bar"></div>
                          <div class="tp-bar tp-bar--short"></div>
                        </div>
                      </div>
                      <p class="theme-card__label">Dark</p>
                    </div>
                    <div :class="['theme-card', darkMode ? 'theme-card--active' : '']" @click="!darkMode ? toggleDark() : null">
                      <div class="theme-card__preview theme-card__preview--dark">
                        <div class="tp-sidebar"></div>
                        <div class="tp-content">
                          <div class="tp-bar"></div>
                          <div class="tp-bar tp-bar--short"></div>
                        </div>
                      </div>
                      <p class="theme-card__label">Light</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ══ DATA & ACCOUNT ════════════════════════════════════════════ -->
              <div v-if="activeSection === 'data'" class="panel-card">
                <div class="panel-card__header">
                  <p class="panel-card__title">Data & Account</p>
                  <p class="panel-card__desc">Manage your account data and access.</p>
                </div>

                <div class="panel-card__body">

                  <!-- Account Info -->
                  <div class="data-row">
                    <div class="data-row__label">Account role</div>
                    <div class="data-pill">{{ user?.user_metadata?.role === 'company' ? 'Company / Supervisor' : 'Student / Trainee' }}</div>
                  </div>
                  <div class="data-row">
                    <div class="data-row__label">Account created</div>
                    <div class="data-row__val">
                      {{ user?.created_at ? new Date(user.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' }}
                    </div>
                  </div>
                  <div class="data-row">
                    <div class="data-row__label">Last sign in</div>
                    <div class="data-row__val">
                      {{ user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' }}
                    </div>
                  </div>

                  <div class="setting-divider"></div>

                  <!-- Delete Account -->
                  <div class="danger-section">
                    <div>
                      <p class="danger-section__title danger-section__title--red">Delete Account</p>
                      <p class="danger-section__desc">Permanently delete your account and all OJT data. This cannot be undone.</p>
                    </div>
                    <button class="danger-btn" @click="showDeleteConfirm = true">Delete Account</button>
                  </div>

                  <!-- Delete Confirm -->
                  <div v-if="showDeleteConfirm" class="delete-confirm">
                    <p class="delete-confirm__title">Are you absolutely sure?</p>
                    <p class="delete-confirm__desc">
                      This will permanently delete your account and all associated OJT logs and progress data.
                      Type <strong>DELETE</strong> to confirm.
                    </p>
                    <input
                      class="field-input delete-confirm__input"
                      v-model="deleteConfirmText"
                      placeholder="Type DELETE to confirm"
                    />
                    <div class="delete-confirm__actions">
                      <button class="ghost-btn" @click="showDeleteConfirm = false; deleteConfirmText = ''">Cancel</button>
                      <button
                        class="danger-btn"
                        @click="deleteAccount"
                        :disabled="deleteConfirmText !== 'DELETE' || deleteLoading"
                      >
                        {{ deleteLoading ? 'Deleting…' : 'Yes, Delete My Account' }}
                      </button>
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
/* ===== TOKENS ===== */
.app-root {
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px;
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --sidebar-width: 240px; --navbar-height: 60px;
  --font-sans: 'Geist', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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

/* ===== LAYOUT ===== */
.main-wrapper { flex: 1; display: flex; flex-direction: column; margin-left: var(--sidebar-width); min-height: 100vh; background: var(--bg); }
.main-content { flex: 1; padding: var(--space-8); }
.page-inner   { animation: fadeUp 0.35s ease both; }

/* ===== PAGE HEADER ===== */
.page-header {
  display: flex; align-items: center; gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.page-header__avatar {
  width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0;
  background: var(--accent-blue-bg); color: var(--accent-blue);
  font-size: 20px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid rgba(59,130,246,0.2);
}

.page-title    { font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.3px; margin-bottom: 3px; }
.page-subtitle { font-size: 13px; color: var(--text-muted); }

/* ===== PREF LAYOUT ===== */
.pref-layout {
  display: grid; grid-template-columns: 200px 1fr;
  gap: var(--space-6); align-items: start;
}

/* ===== LEFT NAV ===== */
.pref-nav {
  display: flex; flex-direction: column; gap: 2px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: var(--space-2);
  box-shadow: var(--shadow-sm); position: sticky;
  top: calc(var(--navbar-height) + var(--space-6));
}

.pref-nav__item {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm);
  border: none; background: none; color: var(--text-secondary);
  font-size: 13.5px; font-weight: 500; cursor: pointer; text-align: left;
  width: 100%; font-family: var(--font-sans);
  transition: all var(--transition);
}
.pref-nav__item:hover { background: var(--bg-hover); color: var(--text-primary); }
.pref-nav__item--active { background: var(--accent-blue-bg); color: var(--accent-blue); }

/* ===== PANEL CARD ===== */
.panel-card {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);
}

.panel-card__header {
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--border);
  background: var(--bg-tertiary);
}

.panel-card__title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; letter-spacing: -0.2px; }
.panel-card__desc  { font-size: 12.5px; color: var(--text-secondary); }

.panel-card__body {
  padding: var(--space-6);
  display: flex; flex-direction: column; gap: var(--space-5);
}

.panel-card__footer {
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
  margin-top: var(--space-2);
}

/* ===== FIELDS ===== */
.fields-grid { display: flex; flex-direction: column; gap: var(--space-4); }

.field { display: flex; flex-direction: column; gap: var(--space-2); }

.field-label {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted);
}

.field-input {
  padding: 10px var(--space-3); background: var(--bg);
  border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  color: var(--text-primary); font-size: 13.5px; font-family: var(--font-sans);
  outline: none; width: 100%;
  transition: border-color var(--transition), box-shadow var(--transition);
}
.field-input:focus { border-color: var(--accent-blue); box-shadow: 0 0 0 3px var(--accent-blue-bg); }
.field-input--disabled { opacity: 0.5; cursor: not-allowed; }
.field-input--error { border-color: var(--accent-red) !important; }

.field-select { appearance: none; cursor: pointer; }

.field-hint { font-size: 11.5px; color: var(--text-muted); }
.field-hint--error { color: var(--accent-red); }

/* PASSWORD INPUT WRAP */
.input-pw-wrap { position: relative; display: flex; align-items: center; }
.input-pw-wrap .field-input { padding-right: 40px; }
.pw-toggle {
  position: absolute; right: var(--space-3);
  background: none; border: none; color: var(--text-muted);
  cursor: pointer; display: flex; transition: color var(--transition);
}
.pw-toggle:hover { color: var(--text-primary); }

/* STRENGTH BAR */
.strength-row  { display: flex; align-items: center; gap: var(--space-3); }
.strength-bars { display: flex; gap: 4px; flex: 1; }
.strength-bar  { flex: 1; height: 3px; border-radius: 99px; background: rgba(255,255,255,0.08); transition: background var(--transition); }
.light .strength-bar { background: rgba(0,0,0,0.08); }
.strength--weak   { background: var(--accent-red) !important; }
.strength--fair   { background: #f59e0b !important; }
.strength--good   { background: #60a5fa !important; }
.strength--strong { background: var(--accent-green) !important; }
.strength-label   { font-size: 11px; font-weight: 600; min-width: 40px; text-align: right; }

/* ===== ALERTS ===== */
.alert {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm);
  font-size: 13px; animation: fadeUp 0.2s ease both;
}
.alert--error   { background: var(--accent-red-bg); border: 1px solid rgba(239,68,68,0.2); color: var(--accent-red); }
.alert--success { background: var(--accent-green-bg); border: 1px solid rgba(34,197,94,0.2); color: var(--accent-green); }
.alert__close   { margin-left: auto; background: none; border: none; font-size: 16px; cursor: pointer; color: inherit; opacity: 0.7; }
.alert__close:hover { opacity: 1; }

/* ===== SETTING ROW ===== */
.setting-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-6);
}
.setting-row__title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
.setting-row__desc  { font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; }
.setting-divider    { height: 1px; background: var(--border); }

/* ===== TOGGLE SWITCH ===== */
.toggle-switch {
  width: 44px; height: 24px; border-radius: 99px; flex-shrink: 0;
  background: var(--bg-tertiary); border: 1px solid var(--border-strong);
  cursor: pointer; position: relative;
  transition: background var(--transition), border-color var(--transition);
}
.toggle-switch--on { background: var(--accent-blue); border-color: var(--accent-blue); }

.toggle-switch__thumb {
  position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  transition: transform var(--transition);
}
.toggle-switch--on .toggle-switch__thumb { transform: translateX(20px); }

/* ===== THEME PREVIEW ===== */
.theme-preview { display: flex; gap: var(--space-4); }

.theme-card {
  flex: 1; border-radius: var(--radius-md); overflow: hidden;
  border: 2px solid var(--border); cursor: pointer;
  transition: border-color var(--transition), box-shadow var(--transition);
}
.theme-card--active { border-color: var(--accent-blue); box-shadow: 0 0 0 3px var(--accent-blue-bg); }

.theme-card__preview {
  display: flex; height: 72px; gap: 6px; padding: 8px;
}
.theme-card__preview--light { background: #0a0a0b; }
.theme-card__preview--dark  { background: #f8f8fa; }


.tp-sidebar { width: 28px; border-radius: 4px; background: rgba(128,128,128,0.2); }
.tp-content { flex: 1; display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }
.tp-bar     { height: 10px; background: rgba(128,128,128,0.2); border-radius: 3px; }
.tp-bar--short { width: 60%; }

.theme-card__label { padding: var(--space-2) var(--space-3); font-size: 12px; font-weight: 600; color: var(--text-secondary); background: var(--bg-tertiary); text-align: center; }

/* ===== INFO NOTE ===== */
.info-note {
  display: flex; align-items: flex-start; gap: 6px;
  padding: var(--space-3); background: var(--bg-tertiary);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  font-size: 12px; color: var(--text-muted); line-height: 1.5;
}

/* ===== DATA SECTION ===== */
.data-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-3) 0; border-bottom: 1px solid var(--border);
}
.data-row:last-of-type { border-bottom: none; }
.data-row__label { font-size: 13px; color: var(--text-secondary); }
.data-row__val   { font-size: 13px; color: var(--text-primary); font-weight: 500; }

.data-pill {
  padding: 3px 12px; border-radius: 99px;
  background: var(--accent-blue-bg); color: var(--accent-blue);
  font-size: 12px; font-weight: 600; border: 1px solid rgba(59,130,246,0.2);
}

/* ===== DANGER SECTION ===== */
.danger-section { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-6); }
.danger-section__title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.danger-section__title--red { color: var(--accent-red); }
.danger-section__desc  { font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; max-width: 380px; }

/* DELETE CONFIRM */
.delete-confirm {
  display: flex; flex-direction: column; gap: var(--space-3);
  padding: var(--space-5); background: var(--accent-red-bg);
  border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-md);
  animation: fadeUp 0.2s ease both;
}
.delete-confirm__title { font-size: 14px; font-weight: 700; color: var(--accent-red); }
.delete-confirm__desc  { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
.delete-confirm__input { margin-top: var(--space-2); }
.delete-confirm__actions { display: flex; gap: var(--space-2); justify-content: flex-end; margin-top: var(--space-2); }

/* ===== BUTTONS ===== */
.primary-btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-5); background: var(--accent-blue); color: #fff;
  border: none; border-radius: var(--radius-sm); font-size: 13.5px; font-weight: 600;
  cursor: pointer; font-family: var(--font-sans);
  transition: opacity var(--transition), transform var(--transition);
}
.primary-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
.primary-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

.ghost-btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  background: none; color: var(--text-secondary); font-size: 13px; font-weight: 500;
  cursor: pointer; font-family: var(--font-sans); transition: all var(--transition);
  white-space: nowrap;
}
.ghost-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.danger-btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--accent-red-bg); border: 1px solid rgba(239,68,68,0.3);
  border-radius: var(--radius-sm); color: var(--accent-red);
  font-size: 13px; font-weight: 600; cursor: pointer; font-family: var(--font-sans);
  transition: all var(--transition); white-space: nowrap;
}
.danger-btn:hover:not(:disabled) { background: var(--accent-red); color: #fff; border-color: var(--accent-red); }
.danger-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ===== SKELETON ===== */
.skeleton-wrap { animation: fadeUp 0.3s ease both; }
.skeleton {
  background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%);
  background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-md);
}
.sk-heading { height: 60px; width: 320px; margin-bottom: var(--space-8); }
.pref-layout .sk-nav   { height: 280px; }
.pref-layout .sk-panel { height: 400px; }

/* ===== ANIMATIONS ===== */
@keyframes fadeUp  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes spin    { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

/* ===== RESPONSIVE ===== */
@media (max-width: 900px) {
  .pref-layout { grid-template-columns: 1fr; }
  .pref-nav { position: static; flex-direction: row; flex-wrap: wrap; }
  .pref-nav__item { flex: 1; min-width: 100px; justify-content: center; text-align: center; flex-direction: column; gap: 4px; font-size: 11px; }
}

@media (max-width: 768px) {
  .main-wrapper { margin-left: 0; }
  .main-content { padding: var(--space-5) var(--space-4); }
  .page-header__avatar { width: 44px; height: 44px; font-size: 17px; }
  .page-title { font-size: 17px; }
  .theme-preview { flex-direction: column; }
  .danger-section { flex-direction: column; gap: var(--space-3); }
}
</style>