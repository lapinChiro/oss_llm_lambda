import type { DB } from './generated-types.js'
import type { Kysely } from 'kysely'

import { promises as fs } from 'fs';
import {
  Migrator,
  FileMigrationProvider,
  type MigrationResultSet
} from 'kysely/migration';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { getDatabase } from './connection.js';

// マイグレーション専用のログ出力関数
function logMigrationInfo(message: string): void {
  if (process.env.NODE_ENV !== 'test') {
    process.stdout.write(`${message}\n`)
  }
}

function logMigrationError(message: string, error?: unknown): void {
  if (process.env.NODE_ENV !== 'test') {
    const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : 'unknown error'
    process.stderr.write(`${message}${error === undefined ? '' : `: ${detail}`}\n`)
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMigrator(db: Kysely<DB>): Migrator {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder: path.join(__dirname, 'migrations') }),
  })
}

export async function migrateToLatest(db: Kysely<DB> = getDatabase()): Promise<MigrationResultSet> {
  const migrator = createMigrator(db)

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      logMigrationInfo(`Migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === 'Error') {
      logMigrationError(`Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    logMigrationError('Failed to migrate');
    logMigrationError('Migration error details', error);
    throw error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Migration failed with unknown error');
  }

  return { error, results };
}

export async function migrateDown(db: Kysely<DB> = getDatabase()): Promise<MigrationResultSet> {
  const migrator = createMigrator(db)

  const { error, results } = await migrator.migrateDown();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      logMigrationInfo(`Migration "${it.migrationName}" was rolled back successfully`);
    } else if (it.status === 'Error') {
      logMigrationError(`Failed to rollback migration "${it.migrationName}"`);
    }
  });

  if (error) {
    logMigrationError('Failed to rollback');
    logMigrationError('Rollback error details', error);
    throw error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Migration failed with unknown error');
  }

  return { error, results };
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${ process.argv[1] }`) {
  const command = process.argv[2];
  let exitCode = 0;

  try {
    if (command === 'down') {
      await migrateDown();
      logMigrationInfo('Migration rollback completed');
    } else {
      await migrateToLatest();
      logMigrationInfo('Migrations completed');
    }
  } catch (error) {
    logMigrationError('Migration failed', error);
    exitCode = 1;
  } finally {
    // プロセス終了時のみ接続を破棄
    const db = getDatabase();
    await db.destroy();
    process.exit(exitCode);
  }
}
