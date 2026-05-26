<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'

const email       = ref('')
const password    = ref('')
const confirmPw   = ref('')
const role        = ref('user')
const loading     = ref(false)
const showPw      = ref(false)
const showConfirm = ref(false)
const showError   = ref(false)
const errorMsg    = ref('')
const registered  = ref(false)

const router = useRouter()

async function fetchUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const r = user.user_metadata?.role
    router.push(r === 'company' ? '/company' : '/dashboard')
  }
}

async function register() {
  showError.value = false

  if (!email.value || !password.value || !confirmPw.value) {
    errorMsg.value = 'Please fill in all fields.'; showError.value = true; return
  }
  if (password.value !== confirmPw.value) {
    errorMsg.value = 'Passwords do not match.'; showError.value = true; return
  }
  if (password.value.length < 6) {
    errorMsg.value = 'Password must be at least 6 characters.'; showError.value = true; return
  }

  loading.value = true

  const { data, error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
    options: { data: { role: role.value } }
  })

  loading.value = false

  if (error) { errorMsg.value = error.message; showError.value = true; return }

  // Supabase silently "succeeds" for existing emails when email confirmation is on —
  // it returns a user but with an empty identities array instead of an error.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    errorMsg.value = 'An account with this email already exists. Please sign in instead.'
    showError.value = true
    return
  }

  registered.value = true
}

onMounted(fetchUser)
</script>

<template>
  <div class="page">

    <!-- LEFT PANEL -->
    <div class="left-panel">
      <div class="left-panel__inner">

        <div class="brand">
          <div class="brand-icon">
            <img src="../leopad.png" alt="Elopard Clock Logo" class="brand-logo-img" />
          </div>
          <span class="brand-name">ELOPARD<span class="brand-accent">CLOCK</span></span>
        </div>

        <div class="tagline">
          <h2 class="tagline__title">Start tracking your OJT journey today.</h2>
          <p class="tagline__desc">Create your account in seconds and begin logging your training hours with precision and ease.</p>
        </div>

        <div class="role-cards">
          <div :class="['role-card', role === 'user' ? 'role-card--active' : '']">
            <div class="role-card__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
            <div>
              <p class="role-card__title">Student / Trainee</p>
              <p class="role-card__desc">Log daily sessions, track rendered hours, and monitor your OJT progress.</p>
            </div>
          </div>

          <div :class="['role-card', role === 'company' ? 'role-card--active' : '']">
            <div class="role-card__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                <path d="M9 22V12h6v10" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              </svg>
            </div>
            <div>
              <p class="role-card__title">Company / Supervisor</p>
              <p class="role-card__desc">Create rooms, share codes, and monitor trainee attendance logs.</p>
            </div>
          </div>
        </div>

      </div>

      <div class="blob blob--1"></div>
      <div class="blob blob--2"></div>
    </div>

    <!-- RIGHT PANEL -->
    <div class="right-panel">
      <div class="form-wrap">

        <!-- Mobile brand -->
        <div class="mobile-brand">
          <div class="brand-icon brand-icon--sm">
            <img src="../leopad.png" alt="Elopard Clock Logo" class="brand-logo-img" />
          </div>
          <span class="brand-name brand-name--sm">ELOPARD<span class="brand-accent">CLOCK</span></span>
        </div>

        <!-- SUCCESS STATE -->
        <div v-if="registered" class="success-box">
          <div class="success-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="success-title">Account created!</h2>
          <p class="success-desc">Check your email inbox to confirm your account, then sign in.</p>
          <router-link to="/" class="login-btn" style="text-decoration:none; display:flex; justify-content:center;">
            Go to Sign In
          </router-link>
        </div>

        <template v-else>
          <div class="form-header">
            <h1 class="form-title">Create account</h1>
            <p class="form-subtitle">Join Elo's and start monitoring your hours.</p>
          </div>

          <!-- ERROR BANNER -->
          <div v-if="showError" class="error-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>{{ errorMsg }}</span>
            <button class="error-banner__close" @click="showError = false">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- ROLE SELECTOR -->
          <div class="field">
            <label class="field-label">I am a</label>
            <div class="role-toggle">
              <button
                :class="['role-toggle__btn', role === 'user' ? 'role-toggle__btn--active' : '']"
                @click="role = 'user'"
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
                </svg>
                Student / Trainee
              </button>
              <button
                :class="['role-toggle__btn', role === 'company' ? 'role-toggle__btn--active' : '']"
                @click="role = 'company'"
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                  <path d="M9 22V12h6v10" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                </svg>
                Company
              </button>
            </div>
          </div>

          <!-- EMAIL -->
          <div class="field">
            <label class="field-label">Email address</label>
            <div class="input-wrap">
              <svg class="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                <polyline points="22,6 12,13 2,6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <input
                class="input"
                type="email"
                v-model="email"
                placeholder="you@example.com"
                autocomplete="email"
                @input="showError = false"
              />
            </div>
          </div>

          <!-- PASSWORD -->
          <div class="field">
            <label class="field-label">Password</label>
            <div class="input-wrap">
              <svg class="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <input
                class="input"
                :type="showPw ? 'text' : 'password'"
                v-model="password"
                placeholder="Min. 6 characters"
                autocomplete="new-password"
                @input="showError = false"
              />
              <button class="toggle-pw" type="button" @click="showPw = !showPw">
                <svg v-if="!showPw" width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                </svg>
                <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- CONFIRM PASSWORD -->
          <div class="field">
            <label class="field-label">Confirm password</label>
            <div :class="['input-wrap', confirmPw && confirmPw !== password ? 'input-wrap--error' : '']">
              <svg class="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <input
                class="input"
                :type="showConfirm ? 'text' : 'password'"
                v-model="confirmPw"
                placeholder="Re-enter password"
                autocomplete="new-password"
                @keyup.enter="register"
                @input="showError = false"
              />
              <button class="toggle-pw" type="button" @click="showConfirm = !showConfirm">
                <svg v-if="!showConfirm" width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                </svg>
                <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
            <p v-if="confirmPw && confirmPw !== password" class="mismatch-msg">Passwords don't match</p>
          </div>

          <!-- REGISTER BUTTON -->
          <button class="login-btn" @click="register" :disabled="loading">
            <svg v-if="!loading" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
              <line x1="19" y1="8" x2="19" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <line x1="22" y1="11" x2="16" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" class="spin">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            {{ loading ? 'Creating account…' : 'Create Account' }}
          </button>

          <p class="form-footer">
            Already have an account?
            <router-link to="/" class="form-link">Sign in</router-link>
          </p>
        </template>

      </div>
    </div>

  </div>
</template>

<style scoped>
.page {
  --accent-blue: #3b82f6;
  --accent-blue-bg: rgba(59,130,246,0.12);
  --accent-green: #22c55e;
  --accent-green-bg: rgba(34,197,94,0.12);
  --accent-red: #ef4444;
  --accent-red-bg: rgba(239,68,68,0.1);
  --accent-amber: #f59e0b;
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px;
  --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 20px; --space-6: 24px;
  --font-sans: 'Geist', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --transition: 0.18s cubic-bezier(0.4, 0, 0.2, 1);

  display: flex;
  min-height: 100vh;
  font-family: var(--font-sans);
  background: #0a0a0b;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

/* ===== LEFT PANEL ===== */
.left-panel {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 60px 48px;
  background:
    radial-gradient(ellipse at top left, rgba(37,99,235,0.35) 0%, transparent 55%),
    radial-gradient(ellipse at bottom right, rgba(124,58,237,0.3) 0%, transparent 55%),
    #0d0d10;
}

.left-panel__inner {
  position: relative; z-index: 2;
  max-width: 440px; width: 100%;
  display: flex; flex-direction: column; gap: 36px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0;
}

.brand-icon {
  width: 150px; height: 150px;
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  display: flex; align-items: center; justify-content: center;
  margin-right: -12px;
}

.brand-icon--sm {
  width: 52px; height: 52px;
  background: transparent;
  box-shadow: none;
  border-radius: 0;
}

.brand-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.brand-icon--sm { width: 32px; height: 32px; border-radius: var(--radius-sm); }

.brand-name { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.4px; }
.brand-name--sm { font-size: 17px; }
.brand-accent { color: var(--accent-blue); }

.tagline__title {
  font-size: 26px; font-weight: 700; color: #fff;
  letter-spacing: -0.5px; line-height: 1.25; margin-bottom: 12px;
}
.tagline__desc { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.65; }

/* ROLE CARDS (left panel decorative) */
.role-cards { display: flex; flex-direction: column; gap: 12px; }

.role-card {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 16px; border-radius: var(--radius-md);
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.03);
  transition: all var(--transition);
}

.role-card--active {
  border-color: rgba(59,130,246,0.35);
  background: rgba(59,130,246,0.08);
}

.role-card__icon {
  width: 36px; height: 36px; border-radius: var(--radius-sm); flex-shrink: 0;
  background: rgba(59,130,246,0.15); color: var(--accent-blue);
  display: flex; align-items: center; justify-content: center;
}

.role-card__title { font-size: 13.5px; font-weight: 600; color: #fff; margin-bottom: 4px; }
.role-card__desc  { font-size: 12px; color: rgba(255,255,255,0.45); line-height: 1.5; }

.blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.18; pointer-events: none; z-index: 1; }
.blob--1 { width: 400px; height: 400px; background: #2563eb; top: -100px; left: -100px; }
.blob--2 { width: 350px; height: 350px; background: #7c3aed; bottom: -80px; right: -80px; }

/* ===== RIGHT PANEL ===== */
.right-panel {
  width: 500px; flex-shrink: 0;
  background: #111113;
  border-left: 1px solid rgba(255,255,255,0.07);
  display: flex; align-items: center; justify-content: center;
  padding: 40px;
  overflow-y: auto;
}

.form-wrap {
  width: 100%; max-width: 380px;
  display: flex; flex-direction: column; gap: var(--space-5);
  animation: fadeUp 0.4s ease both;
  padding: 8px 0;
}

.mobile-brand { display: none; align-items: center; gap: 10px; }

.form-header { display: flex; flex-direction: column; gap: 6px; }
.form-title   { font-size: 22px; font-weight: 700; color: #fafafa; letter-spacing: -0.4px; }
.form-subtitle{ font-size: 13.5px; color: #71717a; }

/* ERROR BANNER */
.error-banner {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px var(--space-4);
  background: var(--accent-red-bg);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: var(--radius-md);
  font-size: 13px; color: #fca5a5; line-height: 1.5;
  animation: fadeUp 0.2s ease both;
}
.error-banner svg { flex-shrink: 0; margin-top: 1px; }
.error-banner span { flex: 1; }
.error-banner__close { background: none; border: none; color: #fca5a5; cursor: pointer; padding: 0; display: flex; flex-shrink: 0; opacity: 0.7; transition: opacity var(--transition); }
.error-banner__close:hover { opacity: 1; }

/* ROLE TOGGLE */
.role-toggle {
  display: grid; grid-template-columns: 1fr 1fr;
  background: #18181b; border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md); padding: 4px; gap: 4px;
}

.role-toggle__btn {
  display: flex; align-items: center; justify-content: center; gap: 7px;
  padding: 10px var(--space-3);
  border-radius: var(--radius-sm); border: none;
  background: none; color: #52525b;
  font-size: 12.5px; font-weight: 500; cursor: pointer;
  font-family: var(--font-sans);
  transition: all var(--transition);
}

.role-toggle__btn--active {
  background: var(--accent-blue);
  color: #fff;
  box-shadow: 0 2px 8px rgba(59,130,246,0.3);
}

/* FIELDS */
.field { display: flex; flex-direction: column; gap: var(--space-2); }

.field-label {
  font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em; color: #71717a;
}

.input-wrap {
  display: flex; align-items: center; gap: var(--space-3); padding: 0 var(--space-4);
  background: #18181b; border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-md);
  transition: border-color var(--transition), box-shadow var(--transition);
}
.input-wrap:focus-within { border-color: var(--accent-blue); box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
.input-wrap--error { border-color: var(--accent-red) !important; box-shadow: 0 0 0 3px rgba(239,68,68,0.12) !important; }

.input-icon { color: #52525b; flex-shrink: 0; }

.input {
  flex: 1; padding: 13px 0;
  background: transparent; border: none; outline: none;
  color: #fafafa; font-size: 14px; font-family: var(--font-sans);
}
.input::placeholder { color: #3f3f46; }

.toggle-pw {
  background: none; border: none; color: #52525b;
  cursor: pointer; display: flex; align-items: center; padding: 0; flex-shrink: 0;
  transition: color var(--transition);
}
.toggle-pw:hover { color: #a1a1aa; }

.mismatch-msg { font-size: 12px; color: var(--accent-red); }

/* LOGIN/REGISTER BUTTON */
.login-btn {
  display: flex; align-items: center; justify-content: center; gap: var(--space-2);
  width: 100%; padding: 14px;
  background: var(--accent-blue); color: #fff;
  border: none; border-radius: var(--radius-md);
  font-size: 14px; font-weight: 600; cursor: pointer;
  font-family: var(--font-sans);
  transition: opacity var(--transition), transform var(--transition), box-shadow var(--transition);
  box-shadow: 0 2px 12px rgba(59,130,246,0.35);
  margin-top: var(--space-2);
}
.login-btn:hover:not(:disabled) { opacity: 0.8; transform: translateY(-1px); box-shadow: 0 3px 10px rgba(59,130,246,0.45); }
.login-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }

/* SUCCESS BOX */
.success-box {
  display: flex; flex-direction: column; align-items: center;
  text-align: center; gap: var(--space-4);
  padding: var(--space-6) var(--space-4);
  background: rgba(34,197,94,0.06);
  border: 1px solid rgba(34,197,94,0.2);
  border-radius: var(--radius-lg);
  animation: fadeUp 0.35s ease both;
}
.success-icon {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--accent-green-bg); color: var(--accent-green);
  display: flex; align-items: center; justify-content: center;
}
.success-title { font-size: 20px; font-weight: 700; color: #fafafa; letter-spacing: -0.3px; }
.success-desc  { font-size: 13.5px; color: #71717a; line-height: 1.6; }

/* FORM FOOTER */
.form-footer { text-align: center; font-size: 13px; color: #52525b; }
.form-link { color: var(--accent-blue); text-decoration: none; font-weight: 500; transition: opacity var(--transition); }
.form-link:hover { opacity: 0.8; }

/* ANIMATIONS */
@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

/* RESPONSIVE */
@media (max-width: 768px) {
  .page { flex-direction: column; }
  .left-panel { display: none; }
  .right-panel {
    width: 100%; border-left: none;
    padding: 40px 24px; min-height: 100vh;
    background:
      radial-gradient(ellipse at top, rgba(37,99,235,0.2) 0%, transparent 50%),
      #0a0a0b;
    align-items: flex-start;
    padding-top: 48px;
  }
  .form-wrap { max-width: 100%; }
  .mobile-brand { display: flex; }
}
</style>