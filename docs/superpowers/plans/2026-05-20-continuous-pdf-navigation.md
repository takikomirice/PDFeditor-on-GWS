# Continuous PDF Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通常表示を縦連続ページ表示にし、通常表示とグリッド表示のキーボード操作を Adobe PDF ビューアに近い感覚へ寄せる。

**Architecture:** `index.html` の単一ファイル構成を維持し、プレビュー描画、選択同期、キーボード処理に限定して変更する。グリッド移動は純粋関数で検証し、DOM 依存の列数推定を薄い UI 関数として接続する。

**Tech Stack:** Google Apps Script HtmlService, plain JavaScript, PDF.js, pdf-lib, Node.js built-in test runner

---

## File Structure

- Modify: `index.html`
  - `#preview-container` を縦連続ページ用の動的コンテナにする。
  - `.preview-page` と `.preview-page-label` の CSS を追加する。
  - `renderMainPreview()` を全ページ縦並び描画へ変更する。
  - `initKeyboardShortcuts()` に通常表示の上下スクロール、グリッドの上下左右移動、Enter 復帰を接続する。
- Modify: `tests/view-controls.test.mjs`
  - グリッド移動、Enter 復帰、連続表示用 DOM/CSS の回帰テストを追加する。
- Modify: `README.md`
  - 通常表示とショートカット説明を更新する。

### Task 1: Add failing tests for navigation behavior

- [ ] **Step 1: Write the failing tests**

Add tests for `computeGridNavigationTarget()`, Enter in grid view, and continuous preview markup/styles in `tests/view-controls.test.mjs`.

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/view-controls.test.mjs`

Expected: FAIL because `computeGridNavigationTarget()` and the continuous preview markup/styles are not implemented yet.

### Task 2: Implement continuous preview rendering

- [ ] **Step 1: Replace fixed preview canvas markup**

Change `#preview-container` so pages are appended dynamically instead of relying on `#preview-canvas`.

- [ ] **Step 2: Add continuous preview CSS**

Set `#preview-container` to a centered vertical flex column and style `.preview-page` with a small gap, page shadow, and selection state.

- [ ] **Step 3: Update preview rendering**

Render `.preview-page` wrappers for all pages, reuse the existing DOM when the active PDF and zoom render key have not changed, and update selection highlights without rerendering canvases.

### Task 3: Implement keyboard navigation

- [ ] **Step 1: Add grid navigation helper**

Implement `computeGridNavigationTarget(currentIndex, key, columnCount, pageCount)`.

- [ ] **Step 2: Connect keyboard shortcuts**

Use Up/Down for preview scrolling in sidebar mode. Use Up/Down/Left/Right for grid selection movement. Use Enter in grid mode to return to sidebar mode and scroll the selected page into view.

### Task 4: Update docs and verify

- [ ] **Step 1: Update README**

Document continuous display, Up/Down behavior, grid four-way movement, and Enter from grid.

- [ ] **Step 2: Run automated verification**

Run: `node --test tests/view-controls.test.mjs`

Expected: PASS.

- [ ] **Step 3: Run JavaScript syntax verification**

Run: extract the app script from `index.html` and execute `node --check` on the temporary file.

Expected: PASS.
