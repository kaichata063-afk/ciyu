import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './style.css'
import Onboarding from './views/Onboarding.vue'
import Home from './views/Home.vue'
import SessionView from './views/Session.vue'
import Contacts from './views/Contacts.vue'
import Settings from './views/Settings.vue'
import { useSettings } from './stores/settings'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/start', component: Onboarding },
    { path: '/go', component: SessionView },
    { path: '/contacts', component: Contacts },
    { path: '/settings', component: Settings },
  ],
})

const pinia = createPinia()
const app = createApp(App)
app.use(pinia).use(router)

router.beforeEach(to => {
  const s = useSettings()
  if (!s.s.onboarded && to.path !== '/start') return '/start'
  if (s.s.onboarded && to.path === '/start' && !to.query.redo) return '/'
})

app.mount('#app')
