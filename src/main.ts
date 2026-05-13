import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import Aura from '@primeuix/themes/aura'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import './assets/main.css'
import 'primeicons/primeicons.css'

const app = createApp(App)

app.use(PrimeVue, {
  ripple: true,
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark',
    },
  },
})
app.use(ConfirmationService)
app.use(createPinia())
app.use(router)
app.use(i18n)

app.mount('#app')
