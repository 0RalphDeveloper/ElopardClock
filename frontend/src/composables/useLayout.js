import { ref } from 'vue'

// Shared singleton state — same refs across all components
const darkMode = ref(true)
const sidebarOpen = ref(false)

export function useLayout() {
  function toggleDark() { darkMode.value = !darkMode.value }
  function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }
  function closeSidebar() { sidebarOpen.value = false }

  return { darkMode, sidebarOpen, toggleDark, toggleSidebar, closeSidebar }
}