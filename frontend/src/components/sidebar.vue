<script setup>
import { useLayout } from '../composables/useLayout'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'

const { sidebarOpen, closeSidebar } = useLayout()
const router = useRouter()

async function logout() {
  await supabase.auth.signOut()
  router.push('/')
}
</script>

<template>
  <!-- MOBILE OVERLAY -->
  <div v-if="sidebarOpen" class="overlay" @click="closeSidebar"></div>

  <!-- SIDEBAR -->
  <aside :class="['sidebar', sidebarOpen ? 'sidebar--open' : '']">
    <div class="sidebar__brand">
      <div class="brand-icon brand-icon--large">
        <!-- Updated to a larger container -->
        <img src="../leopad.png" alt="Elopard Clock Logo" class="brand-logo-img" />
      </div>
      <div class="brand-text-container">
        <span class="brand-name">ELOPARD<span class="brand-accent">CLOCK</span></span>
      </div>
    </div>

    <nav class="sidebar__nav">
      <div class="nav-section-label">Main</div>
      <router-link class="nav-item" to="/dashboard" active-class="nav-item--active" @click="closeSidebar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
          <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
          <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
          <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
        </svg>
        Dashboard
      </router-link>
      <router-link class="nav-item" to="/log" active-class="nav-item--active" @click="closeSidebar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Add Log
      </router-link>
      <router-link class="nav-item" to="/userlogs" active-class="nav-item--active" @click="closeSidebar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 11h8M8 16h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
        My Logs
      </router-link>
      <router-link
        class="nav-item"
        to="/join"
        active-class="nav-item--active"
        @click="closeSidebar"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <!-- Door frame -->
          <path
            d="M4 3.5C4 2.67 4.67 2 5.5 2H10"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <path
            d="M4 20.5C4 21.33 4.67 22 5.5 22H10"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- Arrow -->
          <path
            d="M3 12H11"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />

          <path
            d="M8 9L11 12L8 15"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- Door -->
          <path
            d="M11 3L19 5V19L11 21V3Z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />

          <!-- Door knob -->
          <circle
            cx="16"
            cy="12"
            r="1"
            fill="currentColor"
          />
        </svg>

        Join Room
      </router-link>

      <router-link class="nav-item" to="/askai" active-class="nav-item--active" @click="closeSidebar">
      <!-- AI Sparkle Icon -->
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path 
          d="M12 3L14.5 8.5L20 11L14.5 13.5L12 19L9.5 13.5L4 11L9.5 8.5L12 3Z" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
        <path 
          d="M5 3L6 5L8 6L6 7L5 9L4 7L2 6L4 5L5 3Z" 
          fill="currentColor"
        />
        <path 
          d="M19 16L20 18L22 19L20 20L19 22L18 20L16 19L18 18L19 16Z" 
          fill="currentColor"
        />
      </svg>
      Ask Elopard
    </router-link>
      <!-- <router-link class="nav-item" to="/reports" active-class="nav-item--active" @click="closeSidebar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Reports
      </router-link> -->

      <div class="nav-section-label">Settings</div>
      <router-link class="nav-item" to="/preferences" active-class="nav-item--active" @click="closeSidebar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
            stroke="currentColor" stroke-width="2"/>
        </svg>
        Preferences
      </router-link>
    </nav>

    <div class="sidebar__footer">
      <button class="logout-btn" @click="logout">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Sign Out
      </button>
    </div>
  </aside>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 90;
  backdrop-filter: blur(4px);
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: transform var(--transition);
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: var(--space-1); /* Increased gap for better breathing room */
  padding: var(--space-4) var(--space-5); /* Adjusted padding */
  border-bottom: 1px solid var(--border);
  min-height: var(--navbar-height); 
}
.brand-icon--large {
  width: 90px; 
  height: 90px; 
  border-radius: var(--radius-md); /* Slightly rounder for the larger size */
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
.brand-name {
  font-size: 15px; /* Kept original size so the icon is visibly larger */
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.4px;
  line-height: 1;
}


.brand-accent { color: var(--accent-blue); }

.sidebar__nav {
  flex: 1;
  padding: var(--space-4) var(--space-3);
  overflow-y: auto;
}

.nav-section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  padding: var(--space-4) var(--space-3) var(--space-2);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13.5px;
  font-weight: 500;
  transition: all var(--transition);
  cursor: pointer;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item--active {
  background: var(--accent-blue-bg) !important;
  color: var(--accent-blue) !important;
}

.sidebar__footer {
  padding: var(--space-4);
  border-top: 1px solid var(--border);
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  font-family: var(--font-sans);
}

.logout-btn:hover {
  background: rgba(239,68,68,0.1);
  color: #ef4444;
}

@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
  }
  .sidebar--open {
    transform: translateX(0);
    box-shadow: var(--shadow-lg);
  }
}
</style>