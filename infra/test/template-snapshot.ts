/**
 * CDK template snapshot（L1）のヘルパー。
 *
 * `Template.fromStack(...).toJSON()` は asset hash（64 桁 hex）と
 * asset hash など synth 毎に変動する値を含むため、
 * snapshot 化の前にそれらを安定トークンへ正規化する。これにより aws-cdk-lib のバージョン差による
 * **構造変化のみ** を snapshot diff として検出し、ソース無関係の値揺れで毎回 fail するのを防ぐ。
 */

import type { DeploymentConfig } from '../lib/config.js'

import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { AppStack } from '../lib/stacks/app-stack.js'
import { StatefulStack } from '../lib/stacks/stateful-stack.js'

/** asset hash（64 桁以上の連続 hex）。64+ で残骸なく全置換する。 */
const ASSET_HASH = /[0-9a-f]{64,}/g
/** UUID v4 形式（`crypto.randomUUID()` 由来）。 */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
/**
 * 13 桁の epoch-ms タイムスタンプ（先頭非ゼロ。epoch-ms は 2001〜2286 年が 13 桁）。
 * migration トリガ custom resource が `Date.now().toString()` を physicalResourceId に使うため
 * synth 毎に変動する。12 桁の AWS account id とは桁数で区別する。
 * 先頭桁を 1 に固定すると 2033 年（epoch-ms が 2xxx... へ繰り上がる）以降に外れるため [1-9] とする。
 */
const EPOCH_MS_RE = /\b[1-9]\d{12}\b/g

/** 文字列中の asset hash / UUID / epoch-ms タイムスタンプを安定トークンへ置換する。 */
export function sanitizeString(value: string): string {
  return value
    .replace(UUID_RE, '[UUID]')
    .replace(ASSET_HASH, '[ASSET-HASH]')
    .replace(EPOCH_MS_RE, '[TIMESTAMP]')
}

/** template JSON を再帰的に走査し、値・オブジェクトキーの両方を正規化する。 */
export function sanitizeTemplate(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value)
  }
  if (Array.isArray(value)) {
    return value.map((element) => sanitizeTemplate(element))
  }
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      sanitized[sanitizeString(key)] = sanitizeTemplate(entry)
    }
    return sanitized
  }
  return value
}

const DEFAULT_CONFIG: DeploymentConfig = {
  appName: 'webapp',
  databaseName: 'app',
  environment: 'prod',
  isProduction: true,
  region: 'us-east-1',
  resourcePrefix: 'webapp-prod',
  ssmPrefix: '/webapp/prod',
}

/** bin/app.ts と同じ依存配線で 2 スタックを構築し、各 CloudFormation template(JSON) を返す。 */
export function synthStacks(overrides: Partial<DeploymentConfig> = {}): { stateful: unknown; app: unknown } {
  const config = { ...DEFAULT_CONFIG, ...overrides }
  const app = new cdk.App()
  const stateful = new StatefulStack(app, `${config.resourcePrefix}-stateful`, { config })
  const appStack = new AppStack(app, `${config.resourcePrefix}-app`, {
    config,
    vpc: stateful.vpc,
    dbSecurityGroup: stateful.dbSecurityGroup,
    dbHost: stateful.dbInstance.dbInstanceEndpointAddress,
  })
  return {
    stateful: Template.fromStack(stateful).toJSON(),
    app: Template.fromStack(appStack).toJSON(),
  }
}
