import { GracefulShutdown } from './graceful-shutdown.js'
import { createLogger, LogLevel } from './logger.js'

describe('GracefulShutdown', () => {
  it('runs handlers in reverse order and aggregates failures', async () => {
    const calls: string[] = []
    const exits: number[] = []
    const shutdown = new GracefulShutdown(
      createLogger({ service: 'test', level: LogLevel.SILENT }),
      (code) => { exits.push(code) },
    )
    shutdown.register({ name: 'first', handler: () => { calls.push('first'); return Promise.resolve() } })
    shutdown.register({ name: 'second', handler: () => { calls.push('second'); return Promise.reject(new Error('failure')) } })

    await expect(shutdown.shutdown('test')).resolves.toBe(1)
    expect(calls).toEqual(['second', 'first'])
    expect(exits).toEqual([1])
    expect(shutdown.register({ name: 'late', handler: () => Promise.resolve() })).toBe(false)
  })
})
