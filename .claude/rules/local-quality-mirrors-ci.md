# Local quality check は CI と同じ file set を対象にする

## 適用条件

完了報告 (「完了しました」「コミット可能」「マージ可能」等) の前に local quality check を行うとき。具体的には:

- PRD 完了処理
- TODO / backlog 関連の作業完了
- 単発の修正・refactor の完了
- レビュー指摘修正後の「修正完了」報告

## 背景

2026-05-23、祝日マスタ管理画面の完了処理時に local `npm run lint` は「0 エラー」と報告したが、push 後の CI は lint エラーで fail した。root cause は **`lint:oxlint` が untracked file を lint 対象外にしていた** こと:

- `lint:oxlint` の内部コマンドが `git ls-files '*.ts'`（**tracked files のみ**列挙）だった
- 新規ファイルが未 staged (untracked) のまま lint され、対象から漏れて 0 errors と誤判定
- CI は commit 後（全ファイル tracked）で実行するため、同じファイルを検出して fail

これは local check が **git index 状態に依存して偽陰性を返す** 構造的欠陥だった。

### 2026-06-22: root cause を構造的に解消

全 workspace の `lint:oxlint` / `lint:oxlint:fix` を **`git ls-files --cached --others --exclude-standard`**（tracked + untracked 非 gitignore）へ変更した（正は各 `package.json`）。これにより local lint の file set は **staging 状態に関係なく** CI（commit 後）の file set と恒等的に一致する。「lint 前に `git add` する」運用は不要になった。

本 rule は、この構造保証の上で**残存する不変条件**（lint 以外のツール・完了根拠のモード）を守ることに専念する。CI status の verify は本プロジェクトの運用方針として local-only で行う。

## 制約

完了報告前の検証は **以下の不変条件 (invariant) を必ず満たすこと**:

### 不変条件 1: lint 対象に紛れ込ませない（scratch / 一時ファイルは gitignore）

lint は tracked + untracked（非 gitignore）を対象にするため、**作業ディレクトリに残した実験用・一時 `.ts`/`.vue` も lint 対象になる**（CI も commit すれば同じ）。完了報告前に:

- 一時ファイル（probe・scratch・実験コード）は **`.gitignore` 済みの場所に置く**か、報告前に削除する
- `git status --short` で untracked を確認し、コミット対象でないファイルが lint されていないか点検する

### 不変条件 2: 完了根拠はフルモードのみ

開発中の軽量チェック（変更ファイルに絞った lint / 影響テストのみ＝`/quality-check` 軽量モード）は絞り込みゆえ対象外の回帰を黙って見逃しうる（過去の偽陰性と同型）。完了報告・CI pass の根拠にできるのは不変条件 1〜3 を満たすフルモードのみ。

### 不変条件 3: type-check / knip / test も CI と同条件で実行

- `npx tsc --noEmit`: tsconfig.json の `include` で file を列挙するため git index の影響を受けない (= local と CI で同条件)
- `npx knip`: knip 設定の glob で file を列挙 (= 同上)
- `npm run test`: vitest 設定の glob で file を列挙 (= 同上)

これらは `git add` 状態に依存しないが、**ファイルがディレクトリに存在することを前提に動作する**。新規ファイルを delete してから quality を回せば検出されないため、quality 実行時点でファイルが存在することを `ls` 等で確認すること。

## 禁止事項

- **軽量チェック（変更ファイルに絞った lint / 影響テストのみ）の「0 errors」を完了報告・CI pass の根拠にすること** (不変条件 2。完了を支えるのはフルモードのみ)
- 「自分のローカルで通った」を根拠に push 後の CI 通過を **推定** すること (= 同条件であることを保証してから報告すべき)
- 一時ファイルを lint されないよう **lint だけ無効化する hack** で通すこと (= gitignore か削除で対応する)
- 新規ファイルを delete してから type-check / knip / test を回して「0 エラー」と報告すること (不変条件 3。ファイル存在を前提に検査される)

## 検証

- 完了報告がフルモード（不変条件 1〜3 を満たす）の結果に基づいている
- `git status --short` でコミット対象外の untracked ファイルが lint に紛れていない
- 過去事象 (本ルール背景セクション記載) の再発がない

## 関連ルール / skill

- `.claude/skills/quality-check/SKILL.md` (本ルールを満たす具体手順)
- `.claude/rules/verification.md` (検証原則、判定基準の事前定義)
- `.claude/rules/dependencies.md` (`package.json` 編集時の規約。lint script もここに含まれる)
