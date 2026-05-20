# PDF View Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF プレビューまわりの表示崩れを修正し、ズーム操作、左ペインのリサイズ、グリッド表示時の操作性を改善する。

**Architecture:** 既存の `Page.html` / `Styles.html` / `Scripts.html` 構成は維持する。表示状態は `Scripts.html` に集約し、ズームとフィット計算はテスト可能な純粋関数へ切り出してから UI イベントに接続する。グリッド表示と通常表示の選択同期は共通関数を使って揃える。

**Tech Stack:** Google Apps Script HtmlService, plain JavaScript, PDF.js, pdf-lib, Node.js built-in test runner

---

## File Structure

- Modify: `Page.html`
  - 右下の表示操作ボタン群、左ペインのリサイズハンドルを配置する。
- Modify: `Styles.html`
  - ヘッダ下の余白、右下フローティング操作群、サイドバーリサイザー、グリッドカード、選択枠のスタイルを追加する。
- Modify: `Scripts.html`
  - ズーム関連状態、フィット計算、100%復帰、ショートカット正規化、右下ボタン、サイドバー幅ドラッグ、グリッド同期を実装する。
- Create: `tests/view-controls.test.mjs`
  - `Scripts.html` を評価して純粋関数の振る舞いを検証する。

### Task 1: Add failing tests for view helpers

**Files:**
- Create: `tests/view-controls.test.mjs`
- Test: `tests/view-controls.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
test('normalizeZoomShortcutKey maps JP punctuation shortcuts', () => {
  assert.equal(context.normalizeZoomShortcutKey({ key: '。', code: 'Period' }), 'zoom-in');
  assert.equal(context.normalizeZoomShortcutKey({ key: '、', code: 'Comma' }), 'zoom-out');
  assert.equal(context.normalizeZoomShortcutKey({ key: '/', code: 'Slash' }), 'fit');
  assert.equal(context.normalizeZoomShortcutKey({ key: '\\', code: 'IntlYen' }), 'reset');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/view-controls.test.mjs`
Expected: FAIL because helper functions are not defined yet

- [ ] **Step 3: Write minimal implementation**

Add `normalizeZoomShortcutKey()` and `computeFitZoom()` to `Scripts.html`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/view-controls.test.mjs`
Expected: PASS

### Task 2: Implement preview layout and controls

**Files:**
- Modify: `Page.html`
- Modify: `Styles.html`
- Modify: `Scripts.html`

- [ ] **Step 1: Add markup for the floating zoom controls and sidebar resize handle**
- [ ] **Step 2: Add CSS for preview spacing and fixed bottom-right controls**
- [ ] **Step 3: Implement zoom in/out/fit/reset actions and wire buttons + menu labels + help modal**
- [ ] **Step 4: Implement sidebar drag resize with min/max width constraints**
- [ ] **Step 5: Update grid item layout so selection highlight wraps the page card only**
- [ ] **Step 6: Ensure keyboard shortcuts work in both sidebar and grid views**

### Task 3: Verify and summarize

**Files:**
- Test: `tests/view-controls.test.mjs`
- Test: `Scripts.html`

- [ ] **Step 1: Run the automated helper tests**

Run: `node --test tests/view-controls.test.mjs`
Expected: PASS

- [ ] **Step 2: Run a JavaScript syntax check**

Run: `node --check temp-sanitized-scripts.js`
Expected: PASS

- [ ] **Step 3: Review the requirements checklist**

Confirm:
- 100%表示で PDF 上端がヘッダに被らない
- 右下に拡大 / 縮小 / 画面に合わせる / 100% ボタンがある
- `+` `-` に加えて `。` `、` `/` `￥` `\` が効く
- 左ペイン幅がドラッグ変更できる
- グリッド表示で選択枠がページカードに収まる
- グリッド表示中もショートカットが有効
