import type { Logger } from '@app/utils'

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string | undefined
    traceId: string | undefined
    logger: Logger | undefined
  }
}
