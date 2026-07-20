---
name: quality-check
description: 作業完了時（コミット前）の静的品質チェック手順。変更箇所に応じて lint / type-check / knip / test を実行し 0 エラー・0 警告を確認する（静的解析＋自動テストの範囲。実機での動作確認は含まない＝/check-local の領分）
user-invocable: true
---

# 作業完了時の品質チェック

## トリガー

- **軽量モード**: 開発中の各キリ（`tdd` の各ステップ完了＝タスクを `completed` にする前の検証）。
- **フルモード**: `/review-dev` 直後（完了処理タスク列の必須フル検証）／ユーザーから依頼された作業の完了時（コミット前）。

## モード

本 skill には 2 モードがある。**完了 / CI pass の根拠にできるのはフルモードのみ**（軽量モードの「0 errors」を完了根拠にしてはならない＝`local-quality-mirrors-ci.md`）。

### 軽量モード（開発中の各ステップ検証）

開発の各キリで、影響範囲に絞った高速チェックで fast-feedback を得る（非権威。根拠不可は上記「モード」が正）。

| ツール | 軽量モードの実行範囲 |
|---|---|
| **lint** | 変更ファイルのみ（`git diff --name-only` で得たパスを対象に実行） |
| **type-check** | 変更がある **workspace 単位でフル実行**（`tsc --noEmit`。型グラフ全体を見るためファイル単位に絞らない。`--incremental` で 2 回目以降を高速化してよい） |
| **test** | 影響するテストファイルのみ（`npx vitest run <file>`） |
| **knip** | `package.json` / 依存を更新した場合のみ実行 |
| **mutation** | 実行しない（フルモード＝完了処理に集約） |

軽量モードで検出したエラーは、その場で修正してから当該ステップを `completed` にする。

### フルモード

以下「アクション」の 0〜4 を全て満たす。完了処理タスク列の `/quality-check`（フル検証）と、検証通過後にコードを再編集したときの再検証で実行する。**完了報告を支える唯一の検証**。

## アクション

> 本「アクション」セクションは**フルモード**の手順。軽量モードは上記「モード」セクションを参照。

### 0. 一時ファイルを lint に紛れ込ませない

`lint:oxlint` は `git ls-files --cached --others --exclude-standard` ベースで **tracked + untracked（非 gitignore）を対象**にするため、local lint の file set は staging 状態に関係なく CI（commit 後）と一致する（`git add` は不要）。ただし作業ディレクトリに残した実験用・probe の `.ts`/`.vue` も lint 対象になるため、**コミット対象でない一時ファイルは `.gitignore` 済みの場所に置くか報告前に削除**し、`git status --short` で untracked を点検する。

> 背景・不変条件の正は常時ロードの `.claude/rules/local-quality-mirrors-ci.md`。本 skill は実行手順に専念し、規範はそちらに集約（MECE）。

### 1. 影響範囲の特定

`git diff --name-only` および `git diff --cached --name-only` で変更ファイルを確認し、以下のどちらに該当するか判定する:

- `apps/backend/`、`apps/frontend/`、`packages/`、`infra/`、root tooling のどこに変更があるかを確認する。
- 開発中の軽量モードは対象 workspace に絞ってよい。
- 完了時のフルモードは影響範囲の推測に依存せず root gate を実行する。

### 2. チェックの実行

該当するチェックを全て実行し **0 エラー・0 警告** であることを確認する。

**フルモード（repository root）:**

```bash
npm run quality > /tmp/quality-result.txt 2>&1
```

root `quality` は Syncpack、全 workspace の type-check/lint/test/build、Knip を現行 `package.json` の順序で実行する。変更に UI、API/DB wiring、重要ロジックが含まれる場合は追加 gate を実行する:

```bash
npm run quality:full > /tmp/quality-full-result.txt 2>&1
npm run test:e2e > /tmp/e2e-result.txt 2>&1
npm run synth -w @app/infra > /tmp/synth-result.txt 2>&1
```

`quality:full` は `quality` に coverage、Storybook browser、Backend/Frontend mutation を追加する。E2E は Docker PostgreSQL を所有するため別 command。CDK 変更は default synth に加え必要なら documented custom-domain synth を実行する。出力はファイルにリダイレクトしてから Read ツールで全文を確認する。

### 3. エラー対応

エラーがあった場合:

1. 今回の変更に起因しないエラーも含め、全て修正する
2. 修正できないエラーは原因と影響を明記し、ユーザーに報告する

### 4. テスト有効性の検証（mutation）

重要ロジックまたはテストを変更したときは Backend/Frontend の現行 Stryker scope を実行し、検知力を確認する。対象ファイルの正は各 `stryker.conf.json` であり、自然文へ旧 workspace や旧 domain の一覧を複製しない。

```bash
# 変更側の workspace で実行。stryker.conf.json の mutate スコープ全体、または変更ファイルに絞って実行
npm run test:mutation -w backend
npm run test:mutation -w frontend
```

- **生存 mutant (Survived)** はアサーション不足のシグナル。`/test-design` に立ち返り、その mutant を kill するテストを追加する。
- 当該作業で潰しきれない生存 mutant は対象を `TODO` に起票する（曖昧な「後で」は不可）。
- mutation の位置づけと scope 判断は `.claude/rules/testing.md` を正とする。

## 禁止事項

- 出力を `tail` や `grep` でフィルタリングして確認すること（出力が切れるリスクがある）
- テストを削除・弱体化してエラーを消すこと
- 出力を流し読みして「問題なさそう」と判断すること。各コマンドの終了メッセージまで確認する
- 品質チェックを実行せずに「完了」と報告すること
- 「今回の変更に起因しない」「スコープ外」を理由に、発見した警告・エラーの修正を先送りすること。発見した時点で修正可能なら修正し、誤検知であれば調査の上その旨を報告する
- lint 警告を `eslint-disable` コメントで黙らせること（根本原因を修正する）
- 変更がある側のチェックを省略すること
- **コミット対象でない一時ファイルを lint に紛れ込ませたまま放置 / 「lint 通過」だけで CI pass を推定すること**（`local-quality-mirrors-ci.md` 違反。ステップ 0 を必ず満たす）
- **軽量モード（変更ファイルに絞った lint / 影響テストのみ）の結果を完了報告・CI pass の根拠にすること**（軽量モードは fast-feedback 専用。完了を支えるのはフルモードのみ）
- PRD 完了処理で、変更した重要モジュール（認可 / 日付 / 金額）の mutation 検証を skip し、生存 mutant の確認・対処（テスト追加 or TODO 起票）を行わないこと（ステップ 4）

## 検証

- 変更がある側の全コマンドが終了コード 0 で完了している
- 出力ファイルの全文を Read ツールで確認した履歴がある
- `git status --short` でコミット対象外の untracked ファイルが lint に紛れていない (CI と同条件であることの確証)
- PRD 完了処理の場合、変更した重要モジュールに mutation を実行し、生存 mutant を kill または TODO 起票している（該当変更がなければ不要）
