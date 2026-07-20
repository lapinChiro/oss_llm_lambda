import type { ApiSuccessResponse, CreateTodoInput, Todo, UpdateTodoInput } from '@app/shared'

import { toApiError } from './errors'

export type { Todo } from '@app/shared'

export interface TodosApi {
  list(): Promise<Todo[]>
  create(input: CreateTodoInput): Promise<Todo>
  update(id: string, input: UpdateTodoInput): Promise<Todo>
  delete(id: string): Promise<void>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json() as ApiSuccessResponse<T>).data
}

export function createTodosApi(request: typeof fetch = fetch): TodosApi {
  const requestJson = <T>(path: string, init?: RequestInit) => request(`${API_BASE_URL}${path}`, init).then(parseResponse<T>)
  return {
    list: () => requestJson<Todo[]>('/api/todos'),
    create: (input) => requestJson<Todo>('/api/todos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }),
    update: (id, input) => requestJson<Todo>(`/api/todos/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }),
    delete: (id) => requestJson<undefined>(`/api/todos/${id}`, { method: 'DELETE' }),
  }
}

export const todosApi = createTodosApi()
