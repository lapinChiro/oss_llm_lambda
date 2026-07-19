import { serve } from '@hono/node-server';

import { buildApp } from './app.js';
import { getDatabase, initDatabase } from './db/connection.js';
import { gracefulShutdown } from './utils/graceful-shutdown.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger({ service: 'backend' });

/**
 * ローカル HTTP サーバーを起動する（migration + serve + graceful shutdown）。
 *
 * Node.js のローカル起動と production build の双方から再利用される。
 */
export function startServer(): void {
  const port = parseInt(process.env.PORT ?? '3000');

  gracefulShutdown.setupSignalHandlers();

  initDatabase();
  const app = buildApp(getDatabase());

  // HTTPサーバーを起動
  const server = serve({
    fetch: app.fetch,
    port
  }, (info) => {
    logger.info(`Server is running on http://localhost:${ info.port }`);
  });

  // データベース接続のクローズハンドラーを登録
  gracefulShutdown.register({
    name: 'Database connection',
    handler: async () => {
      const db = getDatabase();
      await db.destroy();
      logger.info('Database connection closed');
    }
  });

  // HTTPサーバーのクローズハンドラーを登録
  gracefulShutdown.register({
    name: 'HTTP server',
    handler: async () => {
      return new Promise<void>((resolve, reject) => {
        if (typeof server.close === 'function') {
          server.close((err) => {
            if (err) {
              logger.error('Error closing HTTP server', { error: err });
              reject(err);
            } else {
              logger.info('HTTP server closed');
              resolve();
            }
          });
        } else {
          logger.info('HTTP server instance not available for graceful shutdown');
          resolve();
        }
      });
    }
  });

  logger.info(`Server startup completed with ${gracefulShutdown.getRegisteredHandlers().length} shutdown handlers`);
}
