---
paths:
  - "apps/frontend/src/views/**"
  - "apps/frontend/src/App.vue"
  - "apps/frontend/src/assets/**"
---

# Frontend layout と spacing

## 適用条件

View の page container、主要 section 間隔、responsive layout、画面下余白を変更するとき。

## 現行の責務

- `TodoView.vue` は semantic structure と状態別 UI を持つ。
- `assets/main.css` の `.page` が page width、左右余白、最小高、上下余白を一元管理する。
- component 内部の micro-spacing と page-level spacing を混同しない。

## 制約

- page width と外周余白を View ごとに重複実装せず、共有 page container へ置く。
- View 内の主要 section 間隔は一貫した spacing scale を使う。
- 狭い viewport で form row、list row、button、long title が overflow しないことを確認する。
- layout の都合で semantic element、label、focus-visible、aria-live を失わない。
- sidebar を将来追加する場合、要件と concrete consumer を先に確認し、現在存在しない layout system を前提にしない。

## 禁止事項

- 旧製品の shell、breakpoint、sidebar、画面名をテンプレートの既定として復元すること。
- View ごとに page-level max width と外周 padding を別々に持たせること。
- `min-width` や固定幅により mobile viewport を横 overflow させること。
- 行数や見た目だけを整えるため semantic/a11y structure を弱めること。

## 検証

- Storybook browser test で loading/error/empty/CRUD UI が維持される。
- keyboard 操作、label、focus ring、色以外の状態表現を確認する。
- narrow/desktop viewport の双方で page/form/list の overflow と余白を目視確認する。
- CSS token と実際の class/selector は `apps/frontend/src/assets/main.css` を正とする。
