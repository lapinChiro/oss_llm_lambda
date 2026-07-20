<script setup lang="ts">
import type { TodosApi } from '@/api/todos-api'

import { onMounted, ref } from 'vue'

import AsyncState from '@/components/AsyncState.vue'
import { useTodos } from '@/composables/useTodos'

const props = defineProps<{ api?: TodosApi }>()
const state = useTodos(props.api)
const { todos, isLoading, isMutating, errorMessage } = state
const title = ref('')
const validationMessage = ref<string>()

async function submit(): Promise<void> {
  validationMessage.value = title.value.trim() ? undefined : 'Enter a todo title.'
  if (validationMessage.value) return
  if (await state.create(title.value)) title.value = ''
}

async function confirmDelete(id: string): Promise<void> {
  if (globalThis.confirm('Delete this todo?')) await state.remove(id)
}

onMounted(() => state.load())
</script>

<template>
  <main class="page">
    <header>
      <p class="eyebrow">Full-stack web template</p>
      <h1>Todos</h1>
      <p class="introduction">A small reference feature for the Vue, API, and PostgreSQL boundaries.</p>
    </header>

    <form class="todo-form" novalidate @submit.prevent="submit">
      <label for="todo-title">New todo</label>
      <div class="form-row">
        <input id="todo-title" v-model="title" name="title" maxlength="200" :aria-describedby="validationMessage ? 'title-error' : undefined" :aria-invalid="Boolean(validationMessage)" />
        <button type="submit" :disabled="isMutating">Add todo</button>
      </div>
      <p v-if="validationMessage" id="title-error" class="field-error" role="alert">{{ validationMessage }}</p>
    </form>

    <div class="announcer" aria-live="polite">{{ isMutating ? 'Saving change…' : '' }}</div>
    <AsyncState v-if="isLoading" kind="loading" />
    <AsyncState v-else-if="errorMessage" kind="error" :message="errorMessage" @retry="() => state.load()" />
    <AsyncState v-else-if="todos.length === 0" kind="empty" />
    <ul v-else aria-label="Todo list">
      <li v-for="todo in todos" :key="todo.id">
        <label class="todo-label">
          <input type="checkbox" :checked="todo.completed" :disabled="isMutating" @change="state.toggle(todo)" />
          <span :class="{ completed: todo.completed }">{{ todo.title }}</span>
        </label>
        <button class="danger" type="button" :disabled="isMutating" :aria-label="`Delete ${todo.title}`" @click="confirmDelete(todo.id)">Delete</button>
      </li>
    </ul>
  </main>
</template>
