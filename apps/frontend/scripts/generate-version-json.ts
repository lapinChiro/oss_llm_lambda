/**
 * `dist/version.json` を生成する postbuild script。
 *
 * CD では `VITE_BUILD_VERSION` (= GITHUB_SHA) env で版識別子を注入する。
 * ローカル build では `git rev-parse --short HEAD` 経由で取得する (devloop でも version 整合性を確認しやすくするため)。
 *
 * 内容:
 *   { "version": "<git-sha>", "builtAt": "<ISO 8601>" }
 *
 * Cache-Control は CD の `aws s3 cp` で `no-cache, no-store, must-revalidate` を別途付与。
 */

import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function resolveVersion(): string {
  const fromEnv = process.env.VITE_BUILD_VERSION
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    // git 未初期化等の例外時は固定値で fallback (dist/version.json は必ず生成する)
    return 'unknown'
  }
}

function main(): void {
  const version = resolveVersion()
  const builtAt = new Date().toISOString()
  const distPath = resolve(import.meta.dirname, '..', 'dist', 'version.json')
  const payload = { version, builtAt }
  writeFileSync(distPath, `${JSON.stringify(payload, null, 2)}\n`)
  // eslint-disable-next-line no-console
  console.log(`[generate-version-json] wrote ${distPath} (version=${version})`)
}

main()
