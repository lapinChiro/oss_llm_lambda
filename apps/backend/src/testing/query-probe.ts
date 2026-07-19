import type { KyselyPlugin, PluginTransformQueryArgs, PluginTransformResultArgs, QueryResult, RootOperationNode, UnknownRow } from 'kysely'

/** Counts compiled statements so tests can detect accidental per-row query growth. */
export class QueryProbe implements KyselyPlugin {
  count = 0

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    this.count += 1
    return args.node
  }

  transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return Promise.resolve(args.result)
  }

  reset(): void { this.count = 0 }
}
