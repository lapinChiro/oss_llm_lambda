import './assets/main.css'

import { createApp } from 'vue'

import App from './App.vue'
import router from './router'

// oxlint-disable-next-line typescript/no-unsafe-argument -- Vue SFC types are checked by vue-tsc.
createApp(App).use(router).mount('#app')
