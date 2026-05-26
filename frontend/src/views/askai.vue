<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'

import { supabase } from '../supabase'
import { useLayout } from '../composables/useLayout'
import AppSidebar from '../components/sidebar.vue'
import AppNavbar from '../components/navbar.vue'

const { darkMode } = useLayout()
const router = useRouter()

const targetHours    = ref(0)
const totalRendered  = ref(0)
const remainingHours = ref(0)
const logs           = ref([])
const pageLoading    = ref(true)

const messages   = ref([])
const userInput  = ref('')
const isLoading  = ref(false)
const chatWindow = ref(null)
const copiedId = ref(null)

const suggestions = [
  { label: 'Progress Report',   action: 'progress'  },
  { label: 'Hours Remaining',   action: 'remaining' },
  { label: 'Completion %',      action: 'percent'    },
  { label: 'Am I on track?',    action: 'ontrack'    },
  { label: 'Show My Descriptions', action: 'descriptions' },
  { label: 'Summarize My Logs', action: 'summarize', ai: true },
]

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

/** 
 * 2026 Model Fallback List:
 * 1. Gemini 2.5 Flash Lite (Primary - optimized for speed/cost)
 * 2. Gemma 4 31B (Fallback 1 - High capability dense model)
 * 3. Gemma 4 26B (Fallback 2 - MoE efficiency)
 */
const AVAILABLE_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it'
]

const FORBIDDEN_KEYWORDS = [
  'script', 'code', 'program', 'hack', 'malicious', 'exploit', 'bypass',
  'sql', 'database', 'system', 'root', 'admin', 'ignore', 'pretend',
  'developer', 'password', 'token', 'key', 'function', 'const', 'import',
  'env', '.env'
];

async function copyToClipboard(text, id) {
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    // Reset "Copied" state after 2 seconds
    setTimeout(() => {
      copiedId.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy!', err)
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (chatWindow.value)
      chatWindow.value.scrollTop = chatWindow.value.scrollHeight
  })
}

function pushMessage(role, text, isAi = false) {
  messages.value.push({ role, text, isAi, id: Date.now() + Math.random() })
  scrollToBottom()
}

function fmt(n) {
  return Math.round(Number(n) * 1000) / 1000
}

// ── LOCAL RESPONSES ───────────────────────────────────────────────────────────
function handleSuggestion(action) {
  if (isLoading.value) return

  const hasData = targetHours.value > 0 || logs.value.length > 0;
  const label = suggestions.find(s => s.action === action)?.label || ''
  pushMessage('user', label)
  if (!hasData) {
    setTimeout(() => {
      pushMessage('assistant', "It looks like you don't have any data recorded yet. Please add your target hours and some work logs so I can help you with your progress!");
    }, 400);
    return;
  }

  const pct = targetHours.value > 0
    ? ((totalRendered.value / targetHours.value) * 100).toFixed(1)
    : '0'
  const left     = fmt(Math.max(0, targetHours.value - totalRendered.value))
  const rendered = fmt(totalRendered.value)
  const target   = fmt(targetHours.value)

  if (action === 'progress') {
    pushMessage('assistant',
      `Here is your current OJT progress:\n\nTarget hours: ${target} hrs\nRendered hours: ${rendered} hrs\nRemaining hours: ${left} hrs\nCompletion: ${pct}%`
    )
    return
  }

  if (action === 'remaining') {
    pushMessage('assistant',
      left <= 0
        ? `You have completed all ${target} required hours. Great job!`
        : `You still have ${left} hours remaining out of your ${target} hour target.`
    )
    return
  }

  if (action === 'percent') {
    const filled = Math.round(Number(pct) / 10)
    const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled)
    pushMessage('assistant',
      `You are ${pct}% done with your OJT.`
    )
    return
  }

  if (action === 'ontrack') {
    const logCount = logs.value.length
    const avg      = logCount > 0 ? (totalRendered.value / logCount).toFixed(2) : 0
    const pace     = Number(pct) >= 50
      ? "You are on a good pace. Keep it up!"
      : "You are a bit behind. Try to log more hours consistently."
    pushMessage('assistant',
      `${pace}\n\nLogs submitted: ${logCount}\nAvg hours per log: ${avg}\nOverall completion: ${pct}%`
    )
    return
  }

  if (action === 'descriptions') {
  const descriptions = logs.value
    .map((log, index) =>
      `Day ${index + 1}. ${log.description || 'No description'}`
    )
    .join('\n\n')

  pushMessage(
    'assistant',
    descriptions || 'No descriptions found in your logs.'
  )
  return
  }

  if (action === 'summarize') {
    callGemini()
  }
}

async function callGemini(customPrompt = null) {
  if (isLoading.value) return

  const descriptions = logs.value.map(l => l.description).filter(Boolean)

  if (!descriptions.length) {
    pushMessage('assistant', "You don't have any log descriptions yet. Add descriptions when logging your daily sessions and I can summarize them for you.")
    return
  }

  isLoading.value = true
  pushMessage('assistant', '...', true)

  const logText = descriptions.map((d, i) => `Day ${i + 1}: ${d}`).join('\n')

  const systemContext = `
You are a helpful OJT (On-the-Job Training) progress assistant.
The student's OJT stats:
- Required hours: ${targetHours.value}
- Hours rendered: ${fmt(totalRendered.value)}
- Hours remaining: ${fmt(remainingHours.value)}
- Completion: ${targetHours.value > 0 ? ((totalRendered.value / targetHours.value) * 100).toFixed(1) : 0}%

Their daily work log descriptions:
${logText}

STRICT RULES — you must follow all of these:
- Respond ONLY in plain conversational text. No markdown formatting, no asterisks, no bullet symbols, no code blocks, no headers.
- Use plain line breaks only for paragraph separation.
- Never generate code, commands, or technical implementations.
- Stay strictly focused on summarizing what the student has been working on based on their OJT log descriptions.
- Keep the response under 300 words.
- Be professional, concise, and encouraging.
- Do not hallucinate tasks or skills not mentioned in the logs.
`

  const userMessage = customPrompt || 'Give a brief professional summary of what I have been working on during my OJT .'

  // FALLBACK LOGIC: Trying Gemini 2.5 Flash Lite first, then Gemma fallbacks
  for (const modelId of AVAILABLE_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemContext }] },
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
          }),
        }
      )

      if (!res.ok) {
        // If 429 (Rate Limit) or 5xx (Server Error), try next model
        if (res.status === 429 || res.status >= 500) continue 
        throw new Error(`API Error: ${res.status}`)
      }

      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (text) {
        messages.value.pop() 
        pushMessage('assistant', text.trim(), true)
        isLoading.value = false
        return 
      }
    } catch (err) {
      console.error(`Error getting model`, err)
    }
  }

  messages.value.pop()
  pushMessage('assistant', 'I am currently having trouble. Please try again in a moment.')
  isLoading.value = false
}

async function handleSend() {
  const text = userInput.value.trim();
  if (!text || isLoading.value) return;

  pushMessage('user', text);
  userInput.value = '';

  // Use a Regex to check for WHOLE words only (\b creates a word boundary)
  const isSuspicious = FORBIDDEN_KEYWORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i'); 
    return regex.test(text);
  });
  const hasCodePatterns =
  /(<script|function\s*\(|SELECT\s+.*FROM|import\s+|const\s+|let\s+)/i.test(text);

  if (isSuspicious || hasCodePatterns) {
    setTimeout(() => {
      pushMessage('assistant', "I am strictly an OJT Progress Assistant that help you to summarize your descriptions.");
    }, 500);
    return; 
  }

  const allowedTopics = [
    'summary','summarize','log','logs','description','descriptions',
    'ojt','progress','hours','remaining','completion','track','percentage'
  ];

  const isOjtRelated = allowedTopics.some(word =>
    text.toLowerCase().includes(word)
  );

  if (!isOjtRelated) {
    pushMessage(
      'assistant',
      'Please ask something related to your OJT logs, descriptions, progress, or summaries.'
    );
    return;
  }
  await callGemini(text);
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user){
    router.push('/')
    return
  }

  const role = user.user_metadata?.role
  router.push(role === 'company' ? '/company' : '/askai')

  const { data: prog } = await supabase
    .from('ojt_progress').select('*').eq('user_id', user.id).maybeSingle()

  if (prog) {
    targetHours.value    = prog.required_hours  || 0
    totalRendered.value  = prog.rendered_hours   || 0
    remainingHours.value = prog.remaining_hours  || 0
  }

  const { data: logEntries } = await supabase
    .from('ojt_logs').select('description, date')
    .eq('user_id', user.id).order('date', { ascending: true })

  if (logEntries) logs.value = logEntries

  pageLoading.value = false
  pushMessage('assistant', `Hi! I am Elopard your OJT Assistant. How can I help you today?`)
})
</script>

<template>
  <div :class="['app-root', darkMode ? 'light' : 'dark']">
    <AppSidebar />

    <div class="main-wrapper">
      <AppNavbar title="OJT Assistant" />

      <main class="main-content">
        <div class="chat-card">

          <!-- HEADER -->
          <div class="chat-header">
            <div class="chat-header__brand">
              <!-- The same logo container from your sidebar -->
              <div class="brand-icon brand-icon--mini">
                <img src="../leopad.png" alt="Elopad Clock Logo" class="brand-logo-img waving-leopard"  />
              </div>
              <div>
                <p class="chat-header__title">ELOPARD OJT Progress Assistant</p>
                <p class="chat-header__sub">Instant stats and AI-powered log summaries</p>
              </div>
            </div>
            
            <div class="online-badge">
              <span class="badge-dot"></span>
              Online
            </div>
          </div>

          <!-- MESSAGES -->
          <div class="chat-messages" ref="chatWindow">

            <!-- SKELETON -->
            <div v-if="pageLoading" class="skeleton-wrap">
              <div class="sk-row">
                <div class="skeleton sk-bubble sk-bubble--long"></div>
              </div>
              <div class="sk-row sk-row--right">
                <div class="skeleton sk-bubble sk-bubble--short"></div>
              </div>
              <div class="sk-row">
                <div class="skeleton sk-bubble sk-bubble--mid"></div>
              </div>
            </div>

            <!-- MESSAGES LIST -->
            <template v-else>
              <div
                v-for="msg in messages"
                :key="msg.id"
                :class="['msg-row', msg.role === 'user' ? 'msg-row--user' : 'msg-row--assistant']"
              >
                <div :class="['msg-bubble', msg.isAi ? 'msg-bubble--ai' : '', msg.role === 'user' ? 'msg-bubble--user' : '']">
                  <!-- Thinking dots -->
                  <div v-if="msg.text === '...'" class="thinking">
                    <span></span><span></span><span></span>
                  </div>
                  <template v-else>
                      <div class="ai-header-row" v-if="msg.isAi">
                        <p class="ai-label">AI Summary</p>
                        <!-- NEW COPY BUTTON -->
                        <button class="copy-btn" @click="copyToClipboard(msg.text, msg.id)" title="Copy summary">
                          <span v-if="copiedId === msg.id" class="copy-status">Copied!</span>
                          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </div>
                      <p class="msg-text">{{ msg.text }}</p>
                    </template>
                </div>
              </div>
            </template>
          </div>

          <!-- SUGGESTION CHIPS -->
          <div class="suggestions-area">
            <p class="suggestions-label">Quick actions</p>
            <div class="suggestions-row">
              <button
                v-for="s in suggestions"
                :key="s.action"
                :class="['chip', s.ai ? 'chip--ai' : '']"
                @click="handleSuggestion(s.action)"
                :disabled="pageLoading"
              >
                {{ s.label }}
              </button>
            </div>
          </div>

          <!-- INPUT -->
          <div class="input-area">
            <div :class="['input-wrap', userInput ? 'input-wrap--active' : '']">
              <input
                class="chat-input"
                v-model="userInput"
                @keyup.enter="handleSend"
                placeholder="Ask me to summarize your OJT logs…"
                :disabled="isLoading"
                maxlength="300"
              />
              <span class="char-hint" v-if="userInput.length > 200">{{ userInput.length }}/300</span>
            </div>
            <button
              class="send-btn"
              @click="handleSend"
              :disabled="isLoading || !userInput.trim()"
            >
              <svg v-if="!isLoading" width="15" height="15" viewBox="0 0 24 24" fill="none">
                <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              </svg>
              <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" class="spin">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <p class="input-hint">AI responses are based on your log descriptions only. No code or unrelated content is generated.</p>

        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ===== TOKENS ===== */
.app-root {
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px;
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
  --accent-purple: #a855f7; --accent-purple-bg: rgba(168,85,247,0.1);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
}

.light {
  --bg: #f8f8fa; --bg-secondary: #ffffff; --bg-tertiary: #f1f1f5;
  --bg-elevated: #ffffff; --bg-hover: #f4f4f6;
  --border: rgba(0,0,0,0.07); --border-strong: rgba(0,0,0,0.12);
  --text-primary: #09090b; --text-secondary: #52525b; --text-muted: #a1a1aa;
  --accent-blue: #2563eb; --accent-blue-bg: rgba(37,99,235,0.08);
  --accent-green: #16a34a; --accent-green-bg: rgba(22,163,74,0.08);
  --accent-purple: #9333ea; --accent-purple-bg: rgba(147,51,234,0.08);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

/* ===== LAYOUT ===== */
.main-wrapper {
  flex: 1; display: flex; flex-direction: column;
  margin-left: var(--sidebar-width);
  min-height: 100vh; background: var(--bg);
}

.main-content {
  flex: 1; display: flex; flex-direction: column;
  padding: var(--space-6);
  /* Fill remaining space below navbar */
  height: calc(100vh - var(--navbar-height));
}

/* ===== CHAT CARD (fills the page) ===== */
.chat-card {
  flex: 1; display: flex; flex-direction: column;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-lg); overflow: hidden;
  box-shadow: var(--shadow-sm);
  animation: fadeUp 0.3s ease both;
  min-height: 0; /* critical for flex children to scroll */
}

/* HEADER */
.chat-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border);
  background: var(--bg-tertiary);
  flex-shrink: 0;
}
.chat-header__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.brand-icon--mini {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.brand-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1); 
}

.chat-header__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}
.chat-header__sub   { font-size: 12px; color: var(--text-muted); }

.online-badge {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 500; color: var(--accent-green);
  background: var(--accent-green-bg);
  border: 1px solid rgba(34,197,94,0.2);
  padding: 3px 10px; border-radius: 99px;
}

.badge-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent-green);
}

/* MESSAGES */
.chat-messages {
  flex: 1; overflow-y: auto; padding: var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-4);
  min-height: 0; /* allow shrinking */
  scroll-behavior: smooth;
}

.chat-messages::-webkit-scrollbar { width: 4px; }
.chat-messages::-webkit-scrollbar-track { background: transparent; }
.chat-messages::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 99px; }

/* MESSAGE ROWS */
.msg-row { display: flex; }
.msg-row--user      { justify-content: flex-end; }
.msg-row--assistant { justify-content: flex-start; }

.msg-bubble {
  max-width: 72%; padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: 13.5px; line-height: 1.65;
  white-space: pre-wrap; word-break: break-word;
  animation: fadeUp 0.2s ease both;
}

.msg-bubble--user {
  background: var(--accent-blue); color: #fff;
  border-bottom-right-radius: 4px;
}

.msg-bubble:not(.msg-bubble--user) {
  background: var(--bg-tertiary); border: 1px solid var(--border);
  color: var(--text-primary); border-bottom-left-radius: 4px;
}

.msg-bubble--ai {
  background: var(--accent-purple-bg) !important;
  border-color: rgba(168,85,247,0.2) !important;
}

.ai-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--accent-purple);
  margin-bottom: var(--space-2);
}

.msg-text { color: inherit; }

/* THINKING DOTS */
.thinking { display: flex; align-items: center; gap: 4px; padding: 2px 0; }
.thinking span {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--text-muted); animation: bounce 1.2s infinite;
}
.thinking span:nth-child(2) { animation-delay: 0.2s; }
.thinking span:nth-child(3) { animation-delay: 0.4s; }

/* SKELETON */
.skeleton-wrap { display: flex; flex-direction: column; gap: var(--space-3); }
.sk-row        { display: flex; }
.sk-row--right { justify-content: flex-end; }

.skeleton {
  background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%);
  background-size: 200% 100%; animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md); height: 48px;
}

.sk-bubble--long  { width: 60%; }
.sk-bubble--mid   { width: 45%; }
.sk-bubble--short { width: 30%; }

/* SUGGESTIONS */
.suggestions-area {
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.suggestions-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted);
  margin-bottom: var(--space-3);
}

.suggestions-row { display: flex; gap: var(--space-2); flex-wrap: wrap; }

.chip {
  padding: 7px var(--space-4); border-radius: 99px;
  border: 1px solid var(--border-strong);
  background: var(--bg); color: var(--text-secondary);
  font-size: 12px; font-weight: 500; cursor: pointer;
  font-family: var(--font-sans); white-space: nowrap;
  transition: all var(--transition);
}

.chip:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
.chip:disabled { opacity: 0.4; cursor: not-allowed; }

.chip--ai {
  background: var(--accent-purple-bg);
  border-color: rgba(168,85,247,0.3);
  color: var(--accent-purple);
}

.chip--ai:hover:not(:disabled) {
  background: var(--accent-purple); color: #fff;
  border-color: var(--accent-purple);
}

/* INPUT */
.input-area {
  display: flex; gap: var(--space-2); align-items: center;
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.input-wrap {
  flex: 1; display: flex; align-items: center; gap: var(--space-2);
  padding: 0 var(--space-4);
  background: var(--bg); border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  transition: border-color var(--transition), box-shadow var(--transition);
}

.input-wrap--active,
.input-wrap:focus-within {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 3px var(--accent-purple-bg);
}

.chat-input {
  flex: 1; padding: 12px 0;
  background: transparent; border: none; outline: none;
  color: var(--text-primary); font-size: 13.5px; font-family: var(--font-sans);
}
.chat-input::placeholder { color: var(--text-muted); }
.chat-input:disabled { opacity: 0.5; }

.char-hint { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }

.send-btn {
  width: 40px; height: 40px; border-radius: var(--radius-sm); flex-shrink: 0;
  background: var(--accent-purple); color: #fff; border: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: opacity var(--transition), transform var(--transition);
  box-shadow: 0 2px 8px rgba(168,85,247,0.3);
}
.send-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
.send-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

.input-hint {
  padding: 0 var(--space-5) var(--space-3);
  font-size: 11px; color: var(--text-muted);
  flex-shrink: 0;
}
.ai-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.copy-btn {
  background: transparent;
  border: none;
  color: var(--accent-purple);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: all var(--transition);
  opacity: 0.6;
}

.copy-btn:hover {
  background: var(--accent-purple-bg);
  opacity: 1;
}

.copy-status {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

/* Ensure the AI label doesn't have its own margin anymore 
   since the parent row handles spacing */
.ai-label {
  margin-bottom: 0; 
}

/* ===== ANIMATIONS ===== */
@keyframes wave-animation {
  0% { transform: scaleX(-1) rotate(0deg); }
  20% { transform: scaleX(-1) rotate(-15deg); }
  40% { transform: scaleX(-1) rotate(10deg); }
  60% { transform: scaleX(-1) rotate(-15deg); }
  80% { transform: scaleX(-1) rotate(5deg); }
  100% { transform: scaleX(-1) rotate(0deg); }
}
.waving-leopard {
  /* scaleX(-1) keeps it facing right, then we apply the wave */
  transform-origin: bottom center;
  animation: wave-animation 2.5s infinite ease-in-out;
  display: inline-block;
}
.brand-icon--mini {
  overflow: visible !important; 
  background: transparent !important; /* Optional: shows the full character */
}

@keyframes fadeUp  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes spin    { to { transform: rotate(360deg); } }
@keyframes bounce  { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }

.spin { animation: spin 0.8s linear infinite; }

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .main-wrapper { margin-left: 0; }
  .main-content { padding: var(--space-4); height: calc(100vh - var(--navbar-height)); }
  .msg-bubble   { max-width: 88%; }
}
</style>