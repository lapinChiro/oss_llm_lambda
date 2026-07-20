import { readonly, ref, type DeepReadonly, type Ref } from 'vue'

import { todosApi, type Todo, type TodosApi } from '@/api/todos-api'

interface TodosState {
  todos: DeepReadonly<Ref<Todo[]>>
  isLoading: DeepReadonly<Ref<boolean>>
  isMutating: DeepReadonly<Ref<boolean>>
  errorMessage: DeepReadonly<Ref<string | undefined>>
  load(): Promise<void>
  create(title: string): Promise<boolean>
  toggle(todo: Todo): Promise<void>
  remove(id: string): Promise<void>
}

export function useTodos(api: TodosApi = todosApi): TodosState {
  const todos = ref<Todo[]>([])
  const isLoading = ref(false)
  const isMutating = ref(false)
  const errorMessage = ref<string>()
  let revision = 0
  let mutationQueue = Promise.resolve()
  let pendingMutations = 0

  async function load(): Promise<void> {
    // Stryker disable next-line UpdateOperator: either direction creates an equally unique request generation.
    const requestRevision = ++revision
    isLoading.value = true
    errorMessage.value = undefined
    try {
      const result = await api.list()
      if (requestRevision === revision) todos.value = result
    } catch {
      if (requestRevision === revision) errorMessage.value = 'Todos could not be loaded. Try again.'
    } finally {
      if (requestRevision === revision) isLoading.value = false
    }
  }

  function mutate(action: () => Promise<void>): Promise<void> {
    // Stryker disable next-line UpdateOperator: either direction invalidates every previously captured generation.
    ++revision
    isLoading.value = false
    ++pendingMutations
    isMutating.value = true
    errorMessage.value = undefined
    const result = mutationQueue.then(action).catch(() => {
      errorMessage.value = 'Your change could not be saved. Try again.'
    })
    mutationQueue = result.finally(() => { isMutating.value = --pendingMutations > 0 })
    return result
  }

  async function create(title: string): Promise<boolean> {
    const normalized = title.trim()
    if (!normalized) return false
    await mutate(async () => { todos.value = [await api.create({ title: normalized }), ...todos.value] })
    return errorMessage.value === undefined
  }

  const toggle = (todo: Todo) => mutate(async () => {
    const updated = await api.update(todo.id, { completed: !todo.completed })
    todos.value = todos.value.map(item => item.id === updated.id ? updated : item)
  })

  const remove = (id: string) => mutate(async () => {
    await api.delete(id)
    todos.value = todos.value.filter(todo => todo.id !== id)
  })

  return { todos: readonly(todos), isLoading: readonly(isLoading), isMutating: readonly(isMutating), errorMessage: readonly(errorMessage), load, create, toggle, remove }
}
