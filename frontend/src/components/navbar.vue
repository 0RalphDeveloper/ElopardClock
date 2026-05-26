<script setup>
import { useLayout } from '../composables/useLayout'

const props = defineProps({
  title: {
    type: String,
    default: 'Dashboard'
  }
})

const { darkMode, toggleDark, toggleSidebar } = useLayout()
</script>

<template>
  <header class="navbar">
    <div class="navbar__left">
      <button class="menu-btn" @click="toggleSidebar" aria-label="Toggle menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <span class="page-title">{{ title }}</span>
    </div>

    <div class="navbar__right">
      <!-- Dark mode toggle -->
      <button class="icon-btn" @click="toggleDark" :title="darkMode ? 'Light mode' : 'Dark mode'">
        <svg v-if="darkMode" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- Slot for page-specific actions (e.g. "Add Log" button) -->
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 50;
  height: var(--navbar-height);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
  backdrop-filter: blur(12px);
}

.navbar__left,
.navbar__right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.menu-btn,
.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: none;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition);
}

.menu-btn:hover,
.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>