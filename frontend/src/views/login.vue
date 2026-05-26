<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'
import { useLayout } from '@/composables/useLayout'

const email    = ref('')
const password = ref('')
const loading  = ref(false)
const showPassword = ref(false)

const showError  = ref(false)
const errorMsg   = ref('')

// Forgot password state
const forgotMode     = ref(false)
const resetEmail     = ref('')
const resetLoading   = ref(false)
const resetSent      = ref(false)
const resetError     = ref('')

const router = useRouter()
const { closeSidebar} = useLayout()

async function fetchUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const role = user.user_metadata?.role
    router.push(role === 'company' ? '/company' : '/dashboard')
      closeSidebar() // ← runs regardless of role

  }
}

async function login() {
  if (!email.value || !password.value) {
    errorMsg.value = 'Please fill in both fields.'
    showError.value = true
    return
  }

  loading.value = true
  showError.value = false

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })

  loading.value = false

  if (error) {
    errorMsg.value = error.message
    showError.value = true
    password.value = ''
    return
  }

  const role = data.user.user_metadata?.role
  router.push(role === 'company' ? '/company' : '/dashboard')
  closeSidebar() // ← runs regardless of role

}

async function sendResetEmail() {
  if (!resetEmail.value.trim()) {
    resetError.value = 'Please enter your email address.'
    return
  }

  resetLoading.value = true
  resetError.value = ''

  const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.value.trim(), {
    redirectTo: `${window.location.origin}/reset-password`
  })

  resetLoading.value = false

  if (error) {
    resetError.value = error.message
    return
  }

  resetSent.value = true
}

function goBackToLogin() {
  forgotMode.value = false
  resetSent.value  = false
  resetError.value = ''
  resetEmail.value = ''
}

onMounted(fetchUser)
</script>

<template>
  <div class="page">

    <!-- LEFT PANEL: branding -->
    <div class="left-panel">
      <div class="left-panel__inner">
        <div class="brand">
          <div class="brand-icon">
            <img src="../leopad.png" alt="Elopard Clock Logo" class="brand-logo-img" />
          </div>
          <span class="brand-name">ELOPARD<span class="brand-accent">CLOCK</span></span>
        </div>

        <div class="tagline">
          <h2 class="tagline__title">Monitor your training hours with precision.</h2>
          <p class="tagline__desc">Log daily attendance, track rendered hours, and stay on top of your OJT requirements — all in one place.</p>
        </div>

        <div class="features">
          <div class="feature">
            <div class="feature__icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span>Real-time hour tracking per session</span>
          </div>
          <div class="feature">
            <div class="feature__icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span>Company room monitoring for supervisors</span>
          </div>
          <div class="feature">
            <div class="feature__icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span>Punch in / punch out per time field</span>
          </div>
          <div class="feature">
            <div class="feature__icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span>Ask Elopard for log summary</span>
          </div>
        </div>
      </div>

      <!-- Decorative blobs -->
      <div class="blob blob--1"></div>
      <div class="blob blob--2"></div>
    </div>

    <!-- RIGHT PANEL: login form -->
    <div class="right-panel">
      <div class="form-wrap">

        <!-- Mobile brand (hidden on desktop) -->
        <div class="mobile-brand">
          <div class="brand-icon brand-icon--sm">
            <img src="../leopad.png" alt="Elopard Clock Logo" class="brand-logo-img" />
          </div>
          <span class="brand-name brand-name--sm">ELOPARD<span class="brand-accent">CLOCK</span></span>
        </div>

        <!-- ══ FORGOT PASSWORD VIEW ══ -->
        <template v-if="forgotMode">

          <!-- EMAIL SENT SUCCESS -->
          <div v-if="resetSent" class="reset-success">
            <div class="reset-success__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                <polyline points="22,6 12,13 2,6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2 class="form-title" style="text-align:center;">Check your email</h2>
            <p class="form-subtitle" style="text-align:center; line-height:1.65;">
              We sent a reset link to<br>
              <strong style="color:#fafafa;">{{ resetEmail }}</strong>
            </p>
            <p class="reset-hint">Didn't get it? Check your spam folder, or go back and try again.</p>
            <button class="login-btn" @click="goBackToLogin">Back to Sign In</button>
          </div>

          <!-- RESET FORM -->
          <template v-else>
            <div class="form-header">
              <h1 class="form-title">Reset password</h1>
              <p class="form-subtitle">Enter your email and we'll send you a reset link.</p>
            </div>

            <div v-if="resetError" class="error-banner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span>{{ resetError }}</span>
              <button class="error-banner__close" @click="resetError = ''">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

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
                  v-model="resetEmail"
                  placeholder="you@example.com"
                  autocomplete="email"
                  @keyup.enter="sendResetEmail"
                  @input="resetError = ''"
                />
              </div>
            </div>

            <button class="login-btn" @click="sendResetEmail" :disabled="resetLoading">
              <svg v-if="!resetLoading" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" class="spin">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              {{ resetLoading ? 'Sending…' : 'Send Reset Link' }}
            </button>

            <p class="form-footer">
              Remember your password?
              <button class="form-link form-link--btn" @click="goBackToLogin">Sign In</button>
            </p>
          </template>

        </template>

        <!-- ══ LOGIN VIEW ══ -->
        <template v-else>

        <div class="form-header">
          <h1 class="form-title">Welcome! Start your journey</h1>
          <p class="form-subtitle">Sign in to your account to continue.</p>
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
              @keyup.enter="login"
              @input="showError = false"
            />
          </div>
        </div>

        <!-- PASSWORD -->
        <div class="field">
          <div class="field-label-row">
            <label class="field-label">Password</label>
            <button class="forgot-link" type="button" @click="forgotMode = true">
              Forgot password?
            </button>
          </div>
          <div class="input-wrap">
            <svg class="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <input
              class="input"
              :type="showPassword ? 'text' : 'password'"
              v-model="password"
              placeholder="••••••••"
              autocomplete="current-password"
              @keyup.enter="login"
              @input="showError = false"
            />
            <button class="toggle-pw" type="button" @click="showPassword = !showPassword" :title="showPassword ? 'Hide password' : 'Show password'">
              <svg v-if="!showPassword" width="15" height="15" viewBox="0 0 24 24" fill="none">
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

        <!-- LOGIN BUTTON -->
        <button class="login-btn" @click="login" :disabled="loading">
          <svg v-if="!loading" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" class="spin">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          {{ loading ? 'Signing in…' : 'Sign In' }}
        </button>

        <p class="form-footer">
          Don't have an account?
          <router-link to="/signup" class="form-link">Create one</router-link>
        </p>

        </template>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ===== TOKENS ===== */
.page {
  --accent-blue: #3b82f6;
  --accent-blue-bg: rgba(59,130,246,0.12);
  --accent-purple: #7c3aed;
  --accent-red: #ef4444;
  --accent-red-bg: rgba(239,68,68,0.1);
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
  position: relative;
  z-index: 2;
  max-width: 440px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 40px;
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
  display: flex;
  align-items: center; 
  justify-content: center;
  margin-right: -12px;
}

.brand-icon--sm {
  width: 52px; height: 52px;
  background: transparent;
  box-shadow: none;
  border-radius: 0;
}

.brand-name {
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.4px;
}

.brand-name--sm { font-size: 17px; }

.brand-accent { color: var(--accent-blue); }

/* TAGLINE */
.tagline__title {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.5px;
  line-height: 1.25;
  margin-bottom: 14px;
}

.tagline__desc {
  font-size: 14px;
  color: rgba(255,255,255,0.5);
  line-height: 1.65;
}

/* FEATURES */
.features {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13.5px;
  color: rgba(255,255,255,0.65);
}

.feature__icon {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: rgba(59,130,246,0.2);
  color: var(--accent-blue);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

/* DECORATIVE BLOBS */
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.18;
  pointer-events: none;
  z-index: 1;
}

.blob--1 {
  width: 400px; height: 400px;
  background: #2563eb;
  top: -100px; left: -100px;
}

.blob--2 {
  width: 350px; height: 350px;
  background: #7c3aed;
  bottom: -80px; right: -80px;
}

/* ===== RIGHT PANEL ===== */
.right-panel {
  width: 480px;
  flex-shrink: 0;
  background: #111113;
  border-left: 1px solid rgba(255,255,255,0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
}

.form-wrap {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  animation: fadeUp 0.4s ease both;
}

/* MOBILE BRAND */
.mobile-brand {
  display: none;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--space-2);
}

/* FORM HEADER */
.form-header { display: flex; flex-direction: column; gap: 6px; }

.form-title {
  font-size: 24px;
  font-weight: 700;
  color: #fafafa;
  letter-spacing: -0.4px;
}

.form-subtitle {
  font-size: 13.5px;
  color: #71717a;
}

/* ERROR BANNER */
.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px var(--space-4);
  background: var(--accent-red-bg);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: #fca5a5;
  line-height: 1.5;
  animation: fadeUp 0.2s ease both;
}

.error-banner svg { flex-shrink: 0; margin-top: 1px; }
.error-banner span { flex: 1; }

.error-banner__close {
  background: none; border: none; color: #fca5a5;
  cursor: pointer; padding: 0; display: flex; flex-shrink: 0;
  opacity: 0.7; transition: opacity var(--transition);
}
.error-banner__close:hover { opacity: 1; }

/* FIELDS */
.field { display: flex; flex-direction: column; gap: var(--space-2); }

.field-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #71717a;
}

.input-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  background: #18181b;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  transition: border-color var(--transition), box-shadow var(--transition);
}

.input-wrap:focus-within {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
}

.input-icon { color: #52525b; flex-shrink: 0; }

.input {
  flex: 1;
  padding: 14px 0;
  background: transparent;
  border: none;
  outline: none;
  color: #fafafa;
  font-size: 14px;
  font-family: var(--font-sans);
}

.input::placeholder { color: #3f3f46; }

.toggle-pw {
  background: none; border: none;
  color: #52525b; cursor: pointer;
  display: flex; align-items: center; padding: 0;
  transition: color var(--transition);
  flex-shrink: 0;
}
.toggle-pw:hover { color: #a1a1aa; }

/* LOGIN BUTTON */
.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: 14px;
  background: var(--accent-blue);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: opacity var(--transition), transform var(--transition), box-shadow var(--transition);
  box-shadow: 0 2px 12px rgba(59,130,246,0.35);
  margin-top: var(--space-2);
}

.login-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(59,130,246,0.45);
}

.login-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }

/* FOOTER */
.form-footer {
  text-align: center;
  font-size: 13px;
  color: #52525b;
}

.form-link {
  color: var(--accent-blue);
  text-decoration: none;
  font-weight: 500;
  transition: opacity var(--transition);
}
.form-link:hover { opacity: 0.8; }

/* ===== ANIMATIONS ===== */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

/* ===== FORGOT PASSWORD ===== */
.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
}

.forgot-link {
  background: none; border: none; padding: 0;
  font-size: 12px; font-weight: 500;
  color: var(--accent-blue); cursor: pointer;
  font-family: var(--font-sans);
  transition: opacity var(--transition);
}
.forgot-link:hover { opacity: 0.75; }

.reset-success {
  display: flex; flex-direction: column;
  align-items: center; gap: var(--space-4);
  text-align: center; padding: var(--space-4) 0;
  animation: fadeUp 0.3s ease both;
}

.reset-success__icon {
  width: 56px; height: 56px; border-radius: 50%;
  background: rgba(59,130,246,0.12);
  color: var(--accent-blue);
  display: flex; align-items: center; justify-content: center;
}

.reset-hint {
  font-size: 12px; color: #52525b;
  line-height: 1.5; text-align: center;
}

.form-link--btn {
  background: none; border: none; padding: 0;
  font-size: inherit; font-family: inherit;
  color: var(--accent-blue); font-weight: 500;
  cursor: pointer; text-decoration: none;
  transition: opacity var(--transition);
}
.form-link--btn:hover { opacity: 0.75; }


@media (max-width: 768px) {
  .page { flex-direction: column; }

  .left-panel { display: none; }

  .right-panel {
    width: 100%;
    border-left: none;
    padding: 40px 24px;
    min-height: 100vh;
    background:
      radial-gradient(ellipse at top, rgba(37,99,235,0.2) 0%, transparent 50%),
      #0a0a0b;
  }

  .mobile-brand { display: flex; }
}

.brand-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>