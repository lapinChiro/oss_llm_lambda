import type { Todos } from './generated-types.js'
import type { Insertable, Selectable, Updateable } from 'kysely'

export type TodoRow = Selectable<Todos>
export type NewTodoRow = Insertable<Todos>
export type TodoRowUpdate = Updateable<Todos>
