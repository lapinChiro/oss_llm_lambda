/**
 * infra (AWS CDK) ESLint Configuration
 * 共有 base (root の eslint.config.base.mjs) を唯一の根拠として参照する。
 * 構成方針・残置 rule の理由は base 本体を参照。
 * typed-linting の project は test を含む tsconfig.json (type-check と同一) を使う。
 */

import { createTsBaseConfig, COMMON_IGNORES } from '../eslint.config.base.mjs';

export default createTsBaseConfig({
  tsconfigRootDir: import.meta.dirname,
  typeAwareParserOptions: { project: './tsconfig.json' },
  ignores: [ ...COMMON_IGNORES, 'cdk.out/**', '**/*.js' ],
});
