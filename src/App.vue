<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useSettings } from './stores/settings'

const S = useSettings()
const route = useRoute()
const showNav = computed(() => S.s.onboarded && route.path !== '/start' && route.path !== '/go')

watchEffect(() => {
  const p = S.theme.palette
  const root = document.documentElement.style
  if (S.s.plainMode) {
    root.setProperty('--bg', '#111318'); root.setProperty('--bg2', '#1b1e26'); root.setProperty('--fg', '#f1f3f7')
    root.setProperty('--accent', '#8ab4ff'); root.setProperty('--accent2', '#c7d2fe'); root.setProperty('--muted', '#8a90a0')
  } else {
    root.setProperty('--bg', p.bg); root.setProperty('--bg2', p.bg2); root.setProperty('--fg', p.fg)
    root.setProperty('--accent', p.accent); root.setProperty('--accent2', p.accent2); root.setProperty('--muted', p.muted)
  }
  document.title = `词屿 · ${S.s.plainMode ? '素颜' : S.theme.name}`
})
</script>

<template>
  <div class="shell" :class="{ 'with-nav': showNav }">
    <main class="page">
      <router-view />
    </main>
    <nav v-if="showNav" class="nav">
      <router-link to="/" class="nav-item">{{ S.t('nav_home') }}</router-link>
      <router-link to="/contacts" class="nav-item">{{ S.t('nav_contacts') }}</router-link>
      <router-link to="/settings" class="nav-item">{{ S.t('nav_settings') }}</router-link>
    </nav>
  </div>
</template>
