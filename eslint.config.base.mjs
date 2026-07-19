/**
 * 共有 ESLint base config (pure-TS workspace 共通・v10.x)
 *
 * pure-TS workspace (packages/utils, packages/types, apps/backend, infra) の
 * eslint.config.js は本 factory を唯一の根拠として参照する。
 * workspace 固有差分は createTsBaseConfig() の options で表現する。
 * apps/frontend は Vue 専用構造のため本 base の対象外。
 *
 * 構成方針: typed-linting は oxlint (--type-aware) へ全面移譲し、ESLint には
 * oxlint で代替不可能な rule のみを残置する。移譲済み rule の authoritative 一覧は
 * 各 workspace の .oxlintrc.json (= 共有 oxlint base を extends) を参照。
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import perfectionist from 'eslint-plugin-perfectionist';
import prettierConfig from 'eslint-config-prettier';
import oxlint from 'eslint-plugin-oxlint';

/**
 * 全 workspace 共通の ignore patterns 最小集合。
 * workspace 固有の追加 (vitest.config.ts / **\/*.js / generated-types 等) は
 * 呼び出し側で本配列に足して ignores option に渡す。
 */
export const COMMON_IGNORES = [
  'node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  '*.config.js',
  '*.config.ts',
  'eslint.config.js',
  '**/*.d.ts',
  // Stryker (mutation testing) の一時 sandbox。mutant 実行用に生成される一時コピーで
  // lint 対象外 (実ソースではない)。
  '**/.stryker-tmp/**',
];

// .only() / .skip() 禁止 selector (全 workspace 共通)。CI で全テスト実行を保証するため禁止。
export const ONLY_SELECTOR = {
  selector: 'MemberExpression[property.name="only"]',
  message: '.only() is banned. Remove it before committing. All tests must run in CI.',
};
export const SKIP_SELECTOR = {
  selector: 'MemberExpression[property.name="skip"]',
  message: '.skip() is banned. Remove it before committing. All tests must run in CI.',
};

/**
 * no-restricted-syntax rule を組み立てる。extraSelectors を先頭に、共通の
 * only/skip 禁止を末尾に置く (= 既存各 config の selector 順序を保存する)。
 */
export function noRestrictedSyntaxRule(extraSelectors = []) {
  return [ 'error', ...extraSelectors, ONLY_SELECTOR, SKIP_SELECTOR ];
}

/**
 * pure-TS workspace 共通の flat config 配列を生成する。
 *
 * @param {object} options
 * @param {string} options.tsconfigRootDir - 呼び出し側の import.meta.dirname (必須)。
 * @param {object} [options.typeAwareParserOptions] - 末尾の type-assertion 補完 block の
 *   parserOptions。packages/backend は { projectService: true }、apps batch/proxy は
 *   { project: './tsconfig.eslint.json' }。
 * @param {string[]} [options.ignores] - ignore patterns (full)。既定は packages 相当。
 * @param {object[]} [options.extraRestrictedSyntaxSelectors] - 主 no-restricted-syntax へ
 *   足す selector (backend の expectOneOf 等)。
 * @param {object[]} [options.extraConfigs] - ignores block の後・prettier の前に挿入する
 *   workspace 固有 config block (backend の integration test guardrails 等)。
 */
export function createTsBaseConfig({
  tsconfigRootDir,
  typeAwareParserOptions = { projectService: true },
  ignores = [ ...COMMON_IGNORES, '**/*.js' ],
  extraRestrictedSyntaxSelectors = [],
  extraConfigs = [],
}) {
  return tseslint.config(
    // 非 typed プリセットのみ。strict は recommended の完全な superset のため strict 1 つで十分。
    js.configs.recommended,
    ...tseslint.configs.strict,

    {
      linterOptions: {
        reportUnusedDisableDirectives: 'off',
      },
    },

    // ESLint-only rules for all TypeScript files
    {
      files: [ '**/*.ts' ],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      plugins: {
        perfectionist,
      },
      rules: {
        // ===== Import sorting (oxlint plugin 未対応) =====
        'perfectionist/sort-imports': [
          'error',
          {
            type: 'alphabetical',
            order: 'asc',
            ignoreCase: true,
            newlinesBetween: 1,
            groups: [
              'type-import',
              ['value-builtin', 'value-external'],
              'value-internal',
              'value-parent',
              'value-sibling',
              'value-index',
              'unknown',
            ],
          },
        ],

        // ===== Naming Convention (oxlint tsgolint 永続非対応) =====
        '@typescript-eslint/naming-convention': [
          'error',
          { selector: 'interface', format: [ 'PascalCase' ] },
          { selector: 'typeAlias', format: [ 'PascalCase' ] },
          { selector: 'enum', format: [ 'PascalCase' ] }
        ],

        // ===== Re-introduction prevention =====
        'no-restricted-syntax': noRestrictedSyntaxRule(extraRestrictedSyntaxSelectors),
      },
    },

    // Ignore patterns
    {
      ignores,
    },

    // workspace 固有の追加 config block (ignores の後・prettier の前)
    ...extraConfigs,

    // Prettier integration - disable conflicting rules
    prettierConfig,

    // Oxlint integration - disable ESLint rules already covered by oxlint
    ...oxlint.configs['flat/all'],

    // ===== oxlint-tsgolint 0.23.0 false negative 補完 (局所的 typed-linting) =====
    // 受け手が `T | null` の文脈での `v as T | null` (contextual に不要な assertion) を
    // oxlint type-aware が検出しない既知バグ。再現形・再検証日・起票条件の追跡は
    // TODO C の該当エントリを正とする。
    // 本 block は flat/all による disable を再上書きするため flat/all の後に配置する。
    // upstream fix 後は本 block を撤去可能。
    {
      files: [ '**/*.ts' ],
      languageOptions: {
        parserOptions: {
          ...typeAwareParserOptions,
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      },
    },
  );
}
