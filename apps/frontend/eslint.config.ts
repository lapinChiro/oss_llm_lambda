/**
 * Frontend ESLint Configuration (v9.x)
 * Based on Ultimate Type Safety ESLint Configuration
 * Optimized for Vue 3 + TypeScript + Vite frontend
 *
 * Enhanced 7-Layer Type Safety Architecture:
 *
 * Layer 1: Complete `any` Elimination
 * Layer 2: Function Boundary Safety
 * Layer 3: Null/Undefined Complete Safety
 * Layer 4: Promise/Async Complete Safety
 * Layer 5: Code Quality Gates
 * Layer 6: Exhaustiveness
 * Layer 7: Dependency Management
 *
 * Hybrid 構成: .ts ファイルでは typed-linting を oxlint --type-aware に移譲し、
 * .vue ファイルでは oxlint type-aware 非対応 (oxc-project/oxc#13017) のため
 * ESLint で typed-linting を維持する。
 */

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import perfectionist from 'eslint-plugin-perfectionist'
import vuePlugin from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import prettierConfig from 'eslint-config-prettier'
import storybook from "eslint-plugin-storybook";
import oxlint from "eslint-plugin-oxlint";

export default tseslint.config(
  // 非 typed プリセット。strict は recommended の完全な superset (active rules 24 ⊂ 32) のため strict 1 つで十分。
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...vuePlugin.configs['flat/recommended'],
  // Base configuration for all TypeScript and Vue files (非 typed ルールのみ)
  {
    files: ['**/*.{ts,tsx,vue}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2022,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: {
        fetch: 'readonly',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
      },
    },
    plugins: {
      perfectionist,
    },
    rules: {
      // ===== Vue 3 Best Practices (非 typed) =====
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/block-lang': [
        'error',
        {
          script: {
            lang: 'ts',
          },
        },
      ],
      'vue/block-order': [
        'error',
        {
          order: ['script', 'template', 'style'],
        },
      ],
      'vue/define-macros-order': [
        'error',
        {
          order: ['defineProps', 'defineEmits'],
        },
      ],
      'vue/require-default-prop': 'off',

      // ===== Layer 1: Complete `any` Elimination (非 typed) =====
      '@typescript-eslint/no-explicit-any': 'error',

      // ===== Layer 3: Null/Undefined Complete Safety (非 typed) =====
      '@typescript-eslint/no-non-null-assertion': 'error',

      // ===== Layer 5: Code Quality Gates (非 typed) =====
      complexity: ['error', 20],
      'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true }],
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'no-console': 'error',

      // ===== Layer 7: Dependency Management =====
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

      // ===== Additional TypeScript Best Practices (非 typed) =====
      '@typescript-eslint/prefer-function-type': 'error',
      '@typescript-eslint/prefer-ts-expect-error': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',

      // ===== Enum Safety (非 typed) =====
      '@typescript-eslint/prefer-enum-initializers': 'error',

      // ===== Code Style Consistency (非 typed) =====
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],

      // ===== Object/Array Type Consistency (非 typed) =====
      '@typescript-eslint/consistent-indexed-object-style': ['error', 'record'],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-array-constructor': 'error',

      // ===== Modern Naming Convention (非 typed: interface/typeAlias/enum の PascalCase 強制は AST selector のみ) =====
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase']
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase']
        },
        {
          selector: 'enum',
          format: ['PascalCase']
        }
      ],

      // ===== Security Best Practices (非 typed) =====
      'no-eval': 'error',
      'no-new-func': 'error',

      // ===== Gradual Introduction (Warn Mode, 非 typed) =====
      '@typescript-eslint/consistent-type-assertions': [
        'warn',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' }
      ],
      '@typescript-eslint/prefer-literal-enum-member': 'warn',
      '@typescript-eslint/unified-signatures': 'warn',

      // ===== Re-introduction Prevention =====
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name="only"]',
          message: '.only() is banned. Remove it before committing. All tests must run in CI.',
        },
        {
          selector: 'MemberExpression[property.name="skip"]',
          message: '.skip() is banned. Remove it before committing. All tests must run in CI.',
        },
      ],

      // ===== Disable Base Rules in Favor of TypeScript Equivalents =====
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': 'error',
    },
  },
  // .ts/.tsx 限定: oxlint-tsgolint の false negative を補完するため typed-linting を局所的に維持
  // 現状の補完対象: no-unnecessary-type-assertion (oxlint-tsgolint が `x as T | null` 形式を未検出)
  // 将来 oxlint で同 rule の false negative が解消されたら本 block を削除可能
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2022,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    },
  },
  // .vue 限定: typed-linting を維持 (oxlint type-aware が .vue 未対応のため)
  // strictTypeChecked は recommendedTypeChecked の完全 superset (active rules 47 ⊂ 72) のため strictTypeChecked 単体で十分。
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.vue'],
  })),
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2022,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      // ===== Layer 1: Complete `any` Elimination (typed) =====
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // ===== Layer 2: Function Boundary Safety (typed) =====
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // ===== Layer 3: Null/Undefined Complete Safety (typed) =====
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',

      // ===== Layer 4: Promise/Async Complete Safety (typed) =====
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',

      // ===== Layer 6: Exhaustiveness (typed) =====
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // ===== Additional TypeScript Best Practices (typed) =====
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      // ===== Enum Safety (typed) =====
      '@typescript-eslint/no-mixed-enums': 'error',
      '@typescript-eslint/no-unsafe-enum-comparison': 'error',

      // ===== Void Expression Safety (typed) =====
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',

      // ===== Generic Type Safety (typed) =====
      '@typescript-eslint/no-unnecessary-type-parameters': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',

      // ===== Code Style Consistency (typed) =====
      '@typescript-eslint/consistent-type-exports': 'error',

      // ===== Security Best Practices (typed) =====
      '@typescript-eslint/no-implied-eval': 'error',

      // ===== Performance Optimizations (typed) =====
      '@typescript-eslint/prefer-for-of': 'error',

      // ===== Gradual Introduction (Warn Mode, typed) =====
      '@typescript-eslint/restrict-template-expressions': [
        'warn',
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: false,
          allowNullish: false
        }
      ],
      '@typescript-eslint/non-nullable-type-assertion-style': 'warn',
    },
  },
  // API client file configuration - needs more lines for all API methods
  {
    files: ['**/api/client.ts'],
    rules: {
      'max-lines': ['error', { max: 700, skipBlankLines: true, skipComments: true }],
    },
  },
  // Test files configuration
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      'no-console': 'off',
      'max-lines-per-function': ['error', { max: 400, skipBlankLines: true, skipComments: true, IIFEs: true }],
      'max-lines': ['error', { max: 650, skipComments: true, skipBlankLines: true }],
      complexity: ['error', 20],
    },
  },
  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      '**/dist/**',
      '**/dist-ssr/**',
      '**/coverage/**',
      '**/storybook-static/**',
      '*.config.js',
      '*.config.ts',
      'vite.config.ts',
      'eslint.config.ts',
      'env.d.ts',
      '**/*.d.ts',
      // Stryker (mutation testing) の一時 sandbox。mutant 実行用に生成される一時コピーで
      // lint 対象外 (実ソースではない)。apps/frontend は base (eslint.config.base.mjs) 非参照の
      // 独立 config のため個別に ignore する。
      '**/.stryker-tmp/**',
    ],
  },
  // Prettier integration - disable conflicting rules
  prettierConfig,
  storybook.configs["flat/recommended"],
  // Oxlint integration - disable ESLint rules already covered by oxlint (must be last)
  ...oxlint.configs["flat/recommended"],
);
