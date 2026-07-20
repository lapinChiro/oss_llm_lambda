import type { KnipConfig } from 'knip';

/**
 * monorepo 単一 root config。
 *
 * knip を monorepo-mode（root 1 プロセスで全 workspace + root を解析）で実行する。
 * per-workspace の `knip.json` は廃止し、本ファイルに集約した。利点:
 *   - root `package.json` の devDep も「どの workspace からも使われないか」で検査される（盲点解消）
 *   - hoisted/root 依存が「消費する workspace」へ正しく属人化され、stale な per-workspace ignore が減る
 *   - policy（`rules` / `ignoreExportsUsedInFile`）が単一定義になる
 *
 * 実行は root の `npm run knip`（= bare `knip`）。CI は専用 `ci_knip.yml` が root で 1 回実行する。
 */

/**
 * policy（全 workspace 共通・単一根拠）。
 *
 * `rules` と `ignoreExportsUsedInFile` は knip の **global-only** オプション（per-workspace 設定には
 * 置けない）。よって root 直下に 1 度だけ定義すれば全 workspace へ適用される。
 *
 * 全カテゴリ `error` = unused files/exports/types を含めどの finding でも CI を fail させる
 * （warn level も fail＝プロジェクト方針）。
 */
const rules = {
  files: 'error',
  dependencies: 'error',
  devDependencies: 'error',
  optionalPeerDependencies: 'error',
  unlisted: 'error',
  binaries: 'error',
  unresolved: 'error',
  exports: 'error',
  types: 'error',
  nsExports: 'error',
  nsTypes: 'error',
  duplicates: 'error',
  enumMembers: 'error',
} as const;

/** oxlint binary が暗黙ロードするため import 出現せず、knip からは未使用に見える。8 workspace が個別宣言。 */
const oxlintTsgolint = ['oxlint-tsgolint'];

const config: KnipConfig = {
  rules,
  ignoreExportsUsedInFile: true,
  workspaces: {
    // root: 共有 lint base 等の root-level 設定ファイルと root devDeps を検査する。
    '.': {
      entry: ['eslint.config.base.mjs'],
      project: ['*.mjs'],
    },
    'apps/backend': {
      // vitest.config.ts / vitest.setup.ts 等は knip の vitest plugin が自動検出するため列挙しない。
      entry: [
        'src/db/types.ts',
        'src/lambda.ts',
        'src/migrate-handler.ts',
        'src/**/*.test.ts',
        'samples/**/*.ts',
      ],
      project: ['src/**/*.ts', 'samples/**/*.ts', '!src/db/migrations/**/*.ts'],
      ignoreDependencies: oxlintTsgolint,
    },
    'apps/frontend': {
      // eslint.config.ts は knip の eslint plugin が自動検出するため列挙しない。
      // vitest.stryker.config.ts は Stryker 専用 config（vitest plugin の自動検出外）のため明示する。
      entry: [
        'env.d.ts',
        'vitest.stryker.config.ts',
        'src/**/*.test.ts',
        'src/**/*.stories.ts',
      ],
      project: ['src/**/*.{ts,vue}', '*.d.ts', '*.config.{ts,js}'],
      // tailwindcss: CSS `@import 'tailwindcss'` 経由で使用（knip は CSS import を検出できない）。
      ignoreDependencies: [...oxlintTsgolint, 'tailwindcss'],
    },
    'packages/types': {
      entry: ['src/**/*.test.ts'],
      project: ['src/**/*.ts'],
    },
    'packages/utils': {
      entry: ['src/**/*.test.ts'],
      project: ['src/**/*.ts'],
      ignoreDependencies: oxlintTsgolint,
    },
    infra: {
      entry: ['bin/app.ts', 'test/**/*.test.ts'],
      project: ['bin/**/*.ts', 'lib/**/*.ts', 'test/**/*.ts'],
      ignoreDependencies: oxlintTsgolint,
    },
  },
};

export default config;
