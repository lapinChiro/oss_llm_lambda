import type { TodosApi } from '@/api/todos-api'
import type { Todo } from '@app/shared'
import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { expect, fn, userEvent, within } from 'storybook/test'

import TodoView from './TodoView.vue'

const initial: Todo = { id: '1', title: 'Exercise component tests', completed: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' }

function createApi(overrides: Partial<TodosApi> = {}): TodosApi {
  return {
    list: async () => [initial],
    create: async ({ title }) => ({ ...initial, id: '2', title }),
    update: async (_id, input) => ({ ...initial, ...input }),
    delete: async () => undefined,
    ...overrides,
  }
}

const meta = { component: TodoView, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof TodoView>
export default meta
type Story = StoryObj<typeof meta>

export const CrudAndKeyboard: Story = {
  args: { api: createApi() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.findByText(initial.title)).resolves.toBeVisible()
    const input = canvas.getByLabelText('New todo')
    await userEvent.click(input)
    await userEvent.keyboard('{Enter}')
    await expect(canvas.findByRole('alert')).resolves.toHaveTextContent('Enter a todo title.')
    await userEvent.type(input, 'Created with keyboard{Enter}')
    await expect(canvas.findByText('Created with keyboard')).resolves.toBeVisible()
    await userEvent.click(canvas.getByRole('checkbox', { name: initial.title }))
    await expect(canvas.getByRole('checkbox', { name: initial.title })).toBeChecked()
    globalThis.confirm = fn().mockReturnValue(true)
    await userEvent.click(canvas.getByRole('button', { name: `Delete ${initial.title}` }))
    await expect(canvas.queryByText(initial.title)).not.toBeInTheDocument()
  },
}

export const Empty: Story = { args: { api: createApi({ list: async () => [] }) } }
export const Loading: Story = { args: { api: createApi({ list: () => new Promise(() => undefined) }) } }
export const ApiError: Story = { args: { api: createApi({ list: async () => { throw new Error('offline') } }) } }
