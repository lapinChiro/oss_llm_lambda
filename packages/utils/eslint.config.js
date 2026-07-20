/**
 * utils ESLint Configuration (v10.x)
 * 共有 base (root の eslint.config.base.js) を唯一の根拠として参照する。
 * 構成方針・残置 rule の理由は base 本体を参照。
 */

import { createTsBaseConfig } from '../../eslint.config.base.mjs';

export default createTsBaseConfig({
  tsconfigRootDir: import.meta.dirname,
});
