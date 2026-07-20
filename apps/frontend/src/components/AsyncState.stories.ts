import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AsyncState from './AsyncState.vue'

const meta = {
  component: AsyncState,
  args: { kind: 'empty' },
} satisfies Meta<typeof AsyncState>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}
export const Loading: Story = { args: { kind: 'loading' } }
export const Error: Story = { args: { kind: 'error', message: 'Todos could not be loaded.' } }
