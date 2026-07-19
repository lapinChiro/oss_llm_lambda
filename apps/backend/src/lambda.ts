import { handle } from 'hono/aws-lambda';

import { initializeApp } from './app.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger({ service: 'backend' });

type LambdaHandler = ReturnType<typeof handle>;

let handler: LambdaHandler | null = null;

/**
 * Lambda ハンドラー
 *
 * コールドスタート時に非同期初期化を1回実行し、
 * 以降はキャッシュされた Hono アプリでリクエストを処理する。
 */
export const lambdaHandler = async (
  event: Parameters<LambdaHandler>[0],
  context: Parameters<LambdaHandler>[1]
): Promise<Awaited<ReturnType<LambdaHandler>>> => {
  if (!handler) {
    try {
      const app = initializeApp();
      handler = handle(app);
    } catch (error) {
      logger.error('Failed to initialize app', { error });
      return {
        statusCode: 503,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          error: 'Service temporarily unavailable',
          message: 'Application initialization failed',
        }),
      };
    }
  }
  return handler(event, context);
};
