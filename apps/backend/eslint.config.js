/**
 * Backend ESLint Configuration (v10.x)
 * 共有 base (root の eslint.config.base.mjs) を唯一の根拠として参照する。
 * 構成方針・残置 rule の理由は base 本体を参照。
 *
 * backend 固有差分:
 *   - repository integration テストで vi.mock / vi.spyOn を禁止し、実 PGlite を使う。
 *   - expectOneOf 禁止 (非確定的テストの隠蔽防止)。
 */

import { createTsBaseConfig, COMMON_IGNORES, ONLY_SELECTOR, SKIP_SELECTOR } from '../../eslint.config.base.mjs';

// expectOneOf は非確定的テストを隠蔽するため全廃止済み。再導入を禁止する。
const EXPECT_ONE_OF_SELECTOR = {
  selector: 'CallExpression[callee.name="expectOneOf"]',
  message: 'expectOneOf is banned. Use deterministic assertions like expect(status).toBe(xxx) instead.',
};

// integration テスト固有: real PGlite を使うため vi.mock / vi.spyOn を禁止。
const VI_MOCK_SELECTOR = {
  selector: 'CallExpression[callee.object.name="vi"][callee.property.name="mock"]',
  message:
    'vi.mock() is banned in integration tests. Integration tests use real PGlite database. If you need vi.mock(), place the test in the unit project (src/**/*.test.ts).',
};
const VI_SPYON_SELECTOR = {
  selector: 'CallExpression[callee.object.name="vi"][callee.property.name="spyOn"]',
  message:
    'vi.spyOn() is banned in integration tests. Use real database operations with TestDataFactory instead.',
};

export default createTsBaseConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: [ ...COMMON_IGNORES, 'vitest.config.ts', 'src/db/generated-types.ts', 'src/db/migrations/**' ],
  extraRestrictedSyntaxSelectors: [ EXPECT_ONE_OF_SELECTOR ],
  extraConfigs: [
    // flat config では後のエントリがルールを上書きするため、共通 selector も再定義する。
    {
      files: ['src/repositories/*.repository.test.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          EXPECT_ONE_OF_SELECTOR,
          ONLY_SELECTOR,
          SKIP_SELECTOR,
          VI_MOCK_SELECTOR,
          VI_SPYON_SELECTOR,
        ],
      },
    },
  ],
});
