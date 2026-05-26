<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'

const router = useRouter()

const password = ref('')
const confirmPassword = ref('')

const loading = ref(false)
const success = ref(false)
const validToken = ref(false)  // only true when arrived via recovery email

const showPassword = ref(false)
const showConfirmPassword = ref(false)

const showError = ref(false)
const errorMsg = ref('')

let authListener = null

onMounted(() => {
  // Supabase fires PASSWORD_RECOVERY only when the user clicks the reset email link.
  // This is the only reliable way to know a real token was used.
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      validToken.value = true
    }
  })

  authListener = data.subscription

  // Fallback: if someone just navigates to /reset-password directly
  // with no hash token at all, kick them out after a short wait.
  // (The PASSWORD_RECOVERY event fires almost instantly if the token is present.)
    setTimeout(async () => {
      if (!validToken.value) {
        await supabase.auth.signOut() // kill the auto-session
        router.push('/')
      }
    }, 1000)
})

onUnmounted(() => {
  authListener?.unsubscribe()
})

async function updatePassword() {
  showError.value = false

  if (!password.value || !confirmPassword.value) {
    errorMsg.value = 'Please fill in all fields.'
    showError.value = true
    return
  }

  if (password.value.length < 6) {
    errorMsg.value = 'Password must be at least 6 characters.'
    showError.value = true
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMsg.value = 'Passwords do not match.'
    showError.value = true
    return
  }

  loading.value = true

  const { error } = await supabase.auth.updateUser({
    password: password.value
  })

  loading.value = false

  if (error) {
    errorMsg.value = error.message
    showError.value = true
    return
  }

  success.value = true

  // Sign out after reset so they can't reuse the recovery session
  await supabase.auth.signOut()

  setTimeout(() => {
    router.push('/')
  }, 2500)
}
</script>

<template>
  <div class="page">
    <div class="card">

      <!-- BRAND -->
      <div class="brand">
          <div class="brand-icon brand-icon--sm">
            <img src="../leopad.png" alt="Elopard Clock Logo" class="brand-logo-img" />
          </div>
        <span class="brand-name">ELOPARD<span class="brand-accent">CLOCK</span></span>
      </div>

      <!-- INVALID TOKEN STATE -->
      <div v-if="!validToken && !success" class="state-wrap">
        <div class="state-icon state-icon--warn">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="title">Invalid or Expired Link</h1>
        <p class="subtitle">This password reset link is invalid or has already been used. Please request a new one.</p>
        <button class="submit-btn" @click="router.push('/')">Back to Sign In</button>
      </div>

      <!-- SUCCESS STATE -->
      <div v-else-if="success" class="state-wrap">
        <div class="state-icon state-icon--success">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1 class="title">Password Updated</h1>
        <p class="subtitle">Your password has been successfully updated. Redirecting you to sign in…</p>
      </div>

      <!-- RESET FORM — only shown when token is valid -->
      <template v-else-if="validToken">

        <div class="header">
          <h1 class="title">Reset Password</h1>
          <p class="subtitle">Enter your new password below.</p>
        </div>

        <!-- ERROR -->
        <div v-if="showError" class="error-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>{{ errorMsg }}</span>
          <button class="error-close" @click="showError = false">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- NEW PASSWORD -->
        <div class="field">
          <label class="field-label">New Password</label>
          <div class="input-wrap">
            <svg class="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <input class="input" :type="showPassword ? 'text' : 'password'"
              v-model="password" placeholder="••••••••" autocomplete="new-password"
              @keyup.enter="updatePassword" @input="showError = false"/>
            <button class="toggle-btn" type="button" @click="showPassword = !showPassword">
              <svg v-if="!showPassword" width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
              </svg>
              <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- CONFIRM PASSWORD -->
        <div class="field">
          <label class="field-label">Confirm Password</label>
          <div class="input-wrap">
            <svg class="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <input class="input" :type="showConfirmPassword ? 'text' : 'password'"
              v-model="confirmPassword" placeholder="••••••••" autocomplete="new-password"
              @keyup.enter="updatePassword" @input="showError = false"/>
            <button class="toggle-btn" type="button" @click="showConfirmPassword = !showConfirmPassword">
              <svg v-if="!showConfirmPassword" width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
              </svg>
              <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- SUBMIT -->
        <button class="submit-btn" @click="updatePassword" :disabled="loading">
          <svg v-if="!loading" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M13 5l7 7-7 7" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" class="spin">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          {{ loading ? 'Updating…' : 'Update Password' }}
        </button>

      </template>

    </div>
  </div>
</template>

<style scoped>
.page {
  --accent-blue: #3b82f6;
  --accent-red: #ef4444;
  --accent-red-bg: rgba(239,68,68,0.1);
  --accent-warn: #f59e0b;
  --accent-warn-bg: rgba(245,158,11,0.1);

  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at top, rgba(59,130,246,0.12), transparent 40%),
    #0a0a0b;
  font-family: 'Geist', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

.card {
  width: 100%;
  max-width: 420px;
  background: #111113;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 24px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.03);
  animation: fadeUp 0.35s ease both;
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
  width: 40px; height: 40px;
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  margin-right: 8px;
}

.brand-name {
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.4px;
}
.brand-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.brand-name { color: white; font-size: 20px; font-weight: 800; }
.brand-accent { color: var(--accent-blue); }

/* STATE (invalid / success) */
.state-wrap {
  display: flex; flex-direction: column;
  align-items: center; gap: 14px;
  text-align: center; padding: 8px 0;
}

.state-icon {
  width: 58px; height: 58px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}

.state-icon--warn {
  background: var(--accent-warn-bg);
  color: var(--accent-warn);
}

.state-icon--success {
  background: rgba(59,130,246,0.12);
  color: var(--accent-blue);
}

/* HEADER */
.header { display: flex; flex-direction: column; gap: 6px; }

.title { color: #fafafa; font-size: 26px; font-weight: 700; letter-spacing: -0.4px; }
.subtitle { color: #71717a; font-size: 13.5px; line-height: 1.65; }

/* ERROR */
.error-banner {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px; border-radius: 12px;
  background: var(--accent-red-bg);
  border: 1px solid rgba(239,68,68,0.2);
  color: #fca5a5; font-size: 13px;
  animation: fadeUp 0.2s ease both;
}
.error-banner span { flex: 1; }
.error-close {
  background: none; border: none; color: #fca5a5;
  cursor: pointer; display: flex; padding: 0;
}

/* FIELDS */
.field { display: flex; flex-direction: column; gap: 8px; }

.field-label {
  color: #71717a; font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em;
}

.input-wrap {
  display: flex; align-items: center; gap: 12px;
  padding: 0 16px; background: #18181b;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; transition: 0.18s;
}
.input-wrap:focus-within {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
}

.input-icon { color: #52525b; flex-shrink: 0; }

.input {
  flex: 1; background: transparent; border: none; outline: none;
  color: white; padding: 15px 0; font-size: 14px;
  font-family: inherit;
}
.input::placeholder { color: #3f3f46; }

.toggle-btn {
  background: none; border: none; color: #52525b;
  cursor: pointer; display: flex; align-items: center; padding: 0;
  transition: color 0.18s;
}
.toggle-btn:hover { color: #a1a1aa; }

/* BUTTON */
.submit-btn {
  width: 100%;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px; border: none; border-radius: 14px;
  background: var(--accent-blue); color: white;
  font-size: 14px; font-weight: 600; cursor: pointer;
  font-family: inherit; transition: 0.18s;
  box-shadow: 0 4px 18px rgba(59,130,246,0.35);
}
.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(59,130,246,0.45);
}
.submit-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

/* ANIMATIONS */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

@media (max-width: 520px) {
  .card { padding: 24px; border-radius: 20px; }
  .title { font-size: 22px; }
}
</style>