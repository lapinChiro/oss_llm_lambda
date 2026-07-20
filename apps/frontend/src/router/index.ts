import { createRouter, createWebHistory } from 'vue-router'

import TodoView from '@/views/TodoView.vue'

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Vue SFC types are checked by vue-tsc.
  routes: [{ path: '/', name: 'todos', component: TodoView }],
})
