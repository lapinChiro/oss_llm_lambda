import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('todos')
    .addColumn('uuid', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('title', 'varchar(200)', (column) => column.notNull())
    .addColumn('completed', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addCheckConstraint('todos_title_not_blank', sql`length(btrim(title)) > 0`)
    .execute()

  await database.schema.createIndex('todos_created_at_uuid_idx')
    .on('todos').columns(['created_at', 'uuid']).execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('todos').execute()
}
