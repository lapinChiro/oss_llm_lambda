import { initDatabase } from './db/connection.js'
import { migrateToLatest } from './db/migrate.js'
import { createLogger } from './utils/logger.js'

const logger = createLogger({ service: 'migrate' })

interface MigrationEvent { RequestType?: 'Create' | 'Update' | 'Delete' }
interface MigrationResult { status: 'SUCCESS' | 'FAILED'; message: string }

export async function handler(event: MigrationEvent): Promise<MigrationResult> {
  if (event.RequestType === 'Delete') return { status: 'SUCCESS', message: 'Delete event - no migration needed' }

  try {
    initDatabase()
    const result = await migrateToLatest()
    const count = result.results?.filter(({ status }) => status === 'Success').length ?? 0
    logger.info('Migration completed', { count })
    return { status: 'SUCCESS', message: `${count} migration(s) applied successfully` }
  } catch (error) {
    logger.error('Migration failed', { error })
    return { status: 'FAILED', message: error instanceof Error ? error.message : 'Unknown migration error' }
  }
}
