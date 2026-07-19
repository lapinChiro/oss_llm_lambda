import type { Logger } from './logger.js'

import { createLogger } from './logger.js'

export interface ShutdownHandler { name: string; handler: () => Promise<void> }

/** Owns shutdown ordering, idempotency, failure aggregation, and process-signal wiring. */
export class GracefulShutdown {
  private readonly handlers: ShutdownHandler[] = []
  private shuttingDown = false
  private signalHandlersSetup = false

  constructor(
    private readonly logger: Logger = createLogger({ service: 'backend' }),
    private readonly exit: (code: number) => void = (code) => { process.exitCode = code },
  ) {}

  register(handler: ShutdownHandler): boolean {
    if (this.shuttingDown) {
      this.logger.warn('Cannot register shutdown handler after shutdown started', { name: handler.name })
      return false
    }
    this.handlers.push(handler)
    return true
  }

  getRegisteredHandlers(): readonly ShutdownHandler[] { return this.handlers }
  isShutdownInProgress(): boolean { return this.shuttingDown }

  async shutdown(signal: string): Promise<number> {
    if (this.shuttingDown) return typeof process.exitCode === 'number' ? process.exitCode : 0
    this.shuttingDown = true
    this.logger.info('Starting graceful shutdown', { signal })
    let exitCode = 0
    for (const { name, handler } of [...this.handlers].reverse()) {
      try {
        await handler()
      } catch (error) {
        exitCode = 1
        this.logger.error('Shutdown handler failed', { name, error })
      }
    }
    this.exit(exitCode)
    return exitCode
  }

  setupSignalHandlers(): boolean {
    if (this.signalHandlersSetup) return false
    const shutdown = (signal: string): void => { void this.shutdown(signal) }
    process.once('SIGINT', () => { shutdown('SIGINT') })
    process.once('SIGTERM', () => { shutdown('SIGTERM') })
    process.once('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error })
      shutdown('uncaughtException')
    })
    process.once('unhandledRejection', (error) => {
      this.logger.error('Unhandled rejection', { error })
      shutdown('unhandledRejection')
    })
    this.signalHandlersSetup = true
    return true
  }
}

export const gracefulShutdown = new GracefulShutdown()
