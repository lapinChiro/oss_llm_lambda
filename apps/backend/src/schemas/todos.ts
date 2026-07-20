import { z } from '@hono/zod-openapi'

export const TodoSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(200),
  completed: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).openapi('Todo')

export const CreateTodoSchema = z.object({
  title: z.string().trim().min(1).max(200),
}).openapi('CreateTodo')

export const UpdateTodoSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  completed: z.boolean().optional(),
}).refine((value) => value.title !== undefined || value.completed !== undefined, {
  message: 'At least one field must be provided',
}).openapi('UpdateTodo')

export const TodoParamsSchema = z.object({ uuid: z.uuid() })
