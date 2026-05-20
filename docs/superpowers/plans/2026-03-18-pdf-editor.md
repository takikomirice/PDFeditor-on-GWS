# GAS PDF編集Webアプリ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GAS Webアプリとして動作するPDF編集ツールを構築する。ブラウザ側のpdf-lib/PDF.jsでPDF操作を行い、GASはWebアプリ配信とDrive連携を担当する。

**Architecture:** GAS HtmlServiceで単一ページWebアプリを配信。Page.html（構造）+ Styles.html（CSS）+ Scripts.html（JS）のテンプレートインクルード構成。PDF処理はすべてブラウザ内で完結し、GASサーバー側はDrive I/Oのみ担当。

**Tech Stack:** Google Apps Script, pdf-lib 1.17.1 (CDN), PDF.js 3.11.174 (CDN), clasp

**Spec:** `docs/superpowers/specs/2026-03-18-pdf-editor-design.md`

**Testing approach:** GASのWebアプリにはユニットテストフレームワークがないため、各タスク完了後に `clasp push` → ブラウザでWebアプリを開いて手動検証する。検証手順を各タスクに明記する。

**UI Design:** HTMLのUIデザインはPencil（.penファイル）で作成し、それに基づいてHTML/CSSを実装する。

---

## ファイル構成

| ファイル | 責務 |
|---------|------|
| `appsscript.json` | GASプロジェクト設定（webapp, タイムゾーン） |
| `Code.gs` | サーバーサイド: doGet(), include(), Drive操作関数 |
| `Page.html` | メインHTML: レイアウト構造、CDN読み込み、テンプレートインクルード |
| `Styles.html` | CSS: テーマ変数（ライト/ダーク）、全UIスタイル |
| `Scripts.html` | JS: 状態管理、pdf-lib操作、PDF.jsプレビュー、UI制御、キーボードショートカット |

---

## Phase 1: 基本機能

### Task 1: PencilでUIデザインを作成

**Files:**
- Create: UIデザイン用 `.pen` ファイル

- [ ] **Step 1: Pencilエディタの状態を確認**

`get_editor_state()` でPencilの現在の状態を確認する。

- [ ] **Step 2: デザインガイドラインを取得**

`get_guidelines(topic="web-app")` でWebアプリのデザインガイドラインを取得する。

- [ ] **Step 3: スタイルガイドタグを取得**

`get_style_guide_tags` でタグ一覧を取得し、ミニマル/シンプルなスタイルガイドを選択する。

- [ ] **Step 4: スタイルガイドを取得**

`get_style_guide(tags)` で選んだタグに基づくスタイルガイドを取得する。

- [ ] **Step 5: Phase 1 UIをデザイン — メインレイアウト（ライトテーマ）**

Pencilの `batch_design` で以下を作成:
- ヘッダー（メニューバー: ファイル▼, 編集▼, 表示▼ + テーマ切替 + ?ヘルプ）
- サイドバー（タブバー + サムネイル一覧）
- メインプレビュー領域
- 全体レイアウト（サイドバー左、プレビュー右）

- [ ] **Step 6: Phase 1 UIをデザイン — ドロップダウンメニュー**

Pencilの `batch_design` で以下を作成:
- ファイルメニュー（ファイルを開く Ctrl+O / ダウンロード保存 Ctrl+S）
- 編集メニュー（ページ削除 Delete / 元に戻す Ctrl+Z / やり直し Ctrl+Shift+Z）
- 表示メニュー（ズームイン +/ ズームアウト -）

- [ ] **Step 7: ヘルプモーダルをデザイン**

Pencilの `batch_design` でショートカット一覧モーダルを作成。

- [ ] **Step 8: ダークテーマバリエーションをデザイン**

Pencilの `batch_design` でダークテーマ版を作成。

- [ ] **Step 9: スクリーンショットで確認**

`get_screenshot` でデザインを確認し、必要に応じて調整。

---

### Task 2: GASプロジェクトのセットアップ

**Files:**
- Create: `appsscript.json`
- Create: `Code.gs`
- Create: `Page.html`（空のシェル）
- Create: `Styles.html`（空）
- Create: `Scripts.html`（空）

- [ ] **Step 1: appsscript.json を作成**

```json
{
  "timeZone": "Asia/Tokyo",
  "dependencies": {},
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "DOMAIN"
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

- [ ] **Step 2: Code.gs を作成（doGet + include）**

```javascript
function doGet() {
  return HtmlService.createTemplateFromFile('Page')
    .evaluate()
    .setTitle('PDF Editor')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

- [ ] **Step 3: Page.html のシェルを作成**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <?!= include('Styles') ?>
</head>
<body>
  <div id="app">
    <header id="header"></header>
    <div id="main-container">
      <aside id="sidebar"></aside>
      <main id="preview-area"></main>
    </div>
  </div>
  <?!= include('Scripts') ?>
</body>
</html>
```

- [ ] **Step 4: Styles.html に空の style タグを作成**

```html
<style>
/* Phase 1: 基本スタイル */
</style>
```

- [ ] **Step 5: Scripts.html に空の script タグを作成**

```html
<script>
// Phase 1: 基本スクリプト
</script>
```

- [ ] **Step 6: 検証**

`clasp push` → GASエディタでWebアプリをテストデプロイ → ブラウザで空ページが表示されることを確認。

---

### Task 3: テーマ変数とベースレイアウトCSS

**Files:**
- Modify: `Styles.html`

PencilデザインのカラーとレイアウトをCSSに落とし込む。

- [ ] **Step 1: CSS変数（ライト/ダークテーマ）を定義**

```html
<style>
:root {
  /* ライトテーマ（デフォルト） */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-sidebar: #fafafa;
  --bg-header: #ffffff;
  --bg-hover: #e8e8e8;
  --bg-selected: #e3f2fd;
  --bg-modal-overlay: rgba(0, 0, 0, 0.5);
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --text-shortcut: #999999;
  --border-color: #e0e0e0;
  --border-selected: #1976d2;
  --accent: #1976d2;
  --accent-hover: #1565c0;
  --danger: #d32f2f;
  --danger-hover: #c62828;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  --shadow-menu: 0 4px 12px rgba(0, 0, 0, 0.15);
}

[data-theme="dark"] {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --bg-sidebar: #252525;
  --bg-header: #2d2d2d;
  --bg-hover: #3d3d3d;
  --bg-selected: #1a3a5c;
  --bg-modal-overlay: rgba(0, 0, 0, 0.7);
  --text-primary: #e0e0e0;
  --text-secondary: #aaaaaa;
  --text-shortcut: #777777;
  --border-color: #444444;
  --border-selected: #42a5f5;
  --accent: #42a5f5;
  --accent-hover: #64b5f6;
  --danger: #ef5350;
  --danger-hover: #e53935;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-menu: 0 4px 12px rgba(0, 0, 0, 0.4);
}
```

- [ ] **Step 2: リセットとベースレイアウトCSS**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  height: 100vh;
  overflow: hidden;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

#header {
  display: flex;
  align-items: center;
  height: 40px;
  background: var(--bg-header);
  border-bottom: 1px solid var(--border-color);
  padding: 0 8px;
  gap: 4px;
  flex-shrink: 0;
}

#main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

#sidebar {
  width: 220px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

#preview-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  background: var(--bg-secondary);
  padding: 20px;
}
```

- [ ] **Step 3: style タグを閉じる**

上記CSSを `</style>` で閉じ、Styles.html を完成させる。

- [ ] **Step 4: 検証**

`clasp push` → ブラウザで白いヘッダー + サイドバー + メインエリアのレイアウトが表示されることを確認。

---

### Task 4: 状態管理の基盤

**Files:**
- Modify: `Scripts.html`

- [ ] **Step 1: アプリケーション状態オブジェクトを定義**

```javascript
const App = {
  tabs: [],
  activeTabId: null,
  clipboard: null, // {pages: [...], mode: 'copy'|'cut', sourceTabId: string}
  theme: (() => { try { return localStorage.getItem('pdf-editor-theme'); } catch(e) { return null; } })() || 'light',
  viewMode: 'sidebar', // 'sidebar' | 'grid'
  nextTabId: 1,

  getActiveTab() {
    return this.tabs.find(t => t.id === this.activeTabId);
  },

  createTab(fileName, pdfBytes) {
    const tab = {
      id: 'tab-' + this.nextTabId++,
      fileName: fileName,
      pdfBytes: pdfBytes, // Uint8Array
      pdfDoc: null,       // PDFLib.PDFDocument (編集用)
      pdfJsDoc: null,     // PDF.js document (プレビュー用キャッシュ)
      pageCount: 0,
      selectedPages: [],
      lastSelectedPage: null,
      undoStack: [],
      redoStack: [],
      zoom: 1.0,
    };
    this.tabs.push(tab);
    this.activeTabId = tab.id;
    return tab;
  },

  removeTab(tabId) {
    const idx = this.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;
    this.tabs.splice(idx, 1);
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs.length > 0
        ? this.tabs[Math.min(idx, this.tabs.length - 1)].id
        : null;
    }
  }
};
```

- [ ] **Step 2: テーマ初期化**

```javascript
function initTheme() {
  document.documentElement.setAttribute('data-theme', App.theme);
}

function toggleTheme() {
  App.theme = App.theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', App.theme);
  try { localStorage.setItem('pdf-editor-theme', App.theme); } catch(e) {}
  updateThemeButton();
}
```

- [ ] **Step 3: 検証**

`clasp push` → ブラウザのコンソールで `App` オブジェクトが存在し、`App.tabs` が空配列であることを確認。

---

### Task 5: ヘッダー（メニューバー）の実装

**Files:**
- Modify: `Page.html` — header内にメニューHTML構造を追加
- Modify: `Styles.html` — メニューのCSS追加
- Modify: `Scripts.html` — メニュー開閉ロジック追加

- [ ] **Step 1: Page.html のヘッダーにメニュー構造を追加**

```html
<header id="header">
  <nav id="menu-bar">
    <div class="menu-item" data-menu="file">
      <span class="menu-label">ファイル</span>
      <div class="menu-dropdown">
        <button data-action="open-file">ファイルを開く<span class="shortcut">Ctrl+O</span></button>
        <button data-action="download" disabled>ダウンロード保存<span class="shortcut">Ctrl+S</span></button>
      </div>
    </div>
    <div class="menu-item" data-menu="edit">
      <span class="menu-label">編集</span>
      <div class="menu-dropdown">
        <button data-action="undo" disabled>元に戻す<span class="shortcut">Ctrl+Z</span></button>
        <button data-action="redo" disabled>やり直し<span class="shortcut">Ctrl+Shift+Z</span></button>
        <div class="menu-separator"></div>
        <button data-action="delete-pages" disabled>ページ削除<span class="shortcut">Delete</span></button>
      </div>
    </div>
    <div class="menu-item" data-menu="view">
      <span class="menu-label">表示</span>
      <div class="menu-dropdown">
        <button data-action="zoom-in" disabled>ズームイン<span class="shortcut">+</span></button>
        <button data-action="zoom-out" disabled>ズームアウト<span class="shortcut">-</span></button>
      </div>
    </div>
  </nav>
  <div id="header-right">
    <button id="theme-toggle" title="テーマ切替"></button>
    <button id="help-btn" title="ショートカット一覧">?</button>
  </div>
  <input type="file" id="file-input" accept=".pdf" multiple hidden>
</header>
```

- [ ] **Step 2: メニューCSS を Styles.html に追加**

```css
/* メニューバー */
#menu-bar {
  display: flex;
  gap: 0;
  flex: 1;
}

.menu-item {
  position: relative;
}

.menu-label {
  display: block;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  border-radius: 4px;
}

.menu-label:hover {
  background: var(--bg-hover);
}

.menu-dropdown {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 220px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: var(--shadow-menu);
  padding: 4px 0;
  z-index: 1000;
}

.menu-item.open .menu-dropdown {
  display: block;
}

.menu-dropdown button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 6px 16px;
  border: none;
  background: none;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.menu-dropdown button:hover:not(:disabled) {
  background: var(--bg-hover);
}

.menu-dropdown button:disabled {
  color: var(--text-secondary);
  cursor: default;
}

.shortcut {
  color: var(--text-shortcut);
  font-size: 12px;
  margin-left: 24px;
}

.menu-separator {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

/* ヘッダー右側 */
#header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

#theme-toggle, #help-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 4px;
  font-size: 16px;
}

#theme-toggle:hover, #help-btn:hover {
  background: var(--bg-hover);
}
```

- [ ] **Step 3: メニュー開閉ロジックを Scripts.html に追加**

```javascript
function initMenuBar() {
  const menuItems = document.querySelectorAll('.menu-item');
  let openMenu = null;

  menuItems.forEach(item => {
    const label = item.querySelector('.menu-label');
    label.addEventListener('click', (e) => {
      e.stopPropagation();
      if (openMenu === item) {
        closeAllMenus();
      } else {
        closeAllMenus();
        item.classList.add('open');
        openMenu = item;
      }
    });

    // ホバーで別メニューに切り替え
    label.addEventListener('mouseenter', () => {
      if (openMenu && openMenu !== item) {
        closeAllMenus();
        item.classList.add('open');
        openMenu = item;
      }
    });
  });

  // メニュー外クリックで閉じる
  document.addEventListener('click', () => closeAllMenus());

  // メニューアクション
  document.querySelectorAll('.menu-dropdown button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (!btn.disabled) {
        handleMenuAction(action);
        closeAllMenus();
      }
    });
  });

  function closeAllMenus() {
    menuItems.forEach(m => m.classList.remove('open'));
    openMenu = null;
  }
}

function handleMenuAction(action) {
  switch (action) {
    case 'open-file': document.getElementById('file-input').click(); break;
    case 'download': downloadPdf(); break;
    case 'undo': performUndo(); break;
    case 'redo': performRedo(); break;
    case 'delete-pages': deleteSelectedPages(); break;
    case 'zoom-in': zoomIn(); break;
    case 'zoom-out': zoomOut(); break;
  }
}

function updateThemeButton() {
  const btn = document.getElementById('theme-toggle');
  btn.textContent = App.theme === 'light' ? '\u263E' : '\u2600';
}
```

- [ ] **Step 4: 初期化処理を追加**

```javascript
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updateThemeButton();
  initMenuBar();
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
});
```

- [ ] **Step 5: 検証**

`clasp push` → ブラウザでメニューバーが表示され、クリックでドロップダウンが開閉することを確認。テーマ切替ボタンでライト/ダークが切り替わることを確認。

---

### Task 6: PDFファイル読み込みとサムネイル表示

**Files:**
- Modify: `Scripts.html` — ファイル読み込み、PDF.jsサムネイル描画
- Modify: `Styles.html` — サムネイルCSS
- Modify: `Page.html` — サイドバー内の構造

- [ ] **Step 1: Page.html のサイドバー構造を追加**

```html
<aside id="sidebar">
  <div id="tab-bar"></div>
  <div id="thumbnail-list"></div>
</aside>
```

- [ ] **Step 2: サムネイルCSSを Styles.html に追加**

```css
/* タブバー */
#tab-bar {
  display: flex;
  overflow-x: auto;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  min-height: 32px;
  flex-shrink: 0;
}

.tab {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  border-right: 1px solid var(--border-color);
  white-space: nowrap;
  max-width: 140px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
}

.tab.active {
  background: var(--bg-sidebar);
  color: var(--text-primary);
  border-bottom: 2px solid var(--accent);
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.tab-close {
  margin-left: 4px;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  border-radius: 2px;
}

.tab-close:hover {
  background: var(--danger);
  color: white;
}

/* サムネイル一覧 */
#thumbnail-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.thumbnail-item {
  position: relative;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 4px;
  padding: 4px;
  transition: border-color 0.15s, background 0.15s;
}

.thumbnail-item:hover {
  background: var(--bg-hover);
}

.thumbnail-item.selected {
  border-color: var(--border-selected);
  background: var(--bg-selected);
}

.thumbnail-item canvas {
  width: 100%;
  display: block;
  border-radius: 2px;
}

.thumbnail-label {
  text-align: center;
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.thumbnail-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: var(--text-secondary);
  font-size: 12px;
}
```

- [ ] **Step 3: PDF.jsワーカー設定とファイル読み込み処理を Scripts.html に追加**

```javascript
// PDF.jsワーカー設定
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ファイル読み込み
function initFileInput() {
  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      if (file.type !== 'application/pdf') {
        alert('PDF以外のファイルは開けません: ' + file.name);
        continue;
      }
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfBytes = new Uint8Array(arrayBuffer);
        // pdf-libで読み込み検証
        await PDFLib.PDFDocument.load(pdfBytes);
        const tab = App.createTab(file.name, pdfBytes);
        await loadTab(tab);
      } catch (err) {
        if (err.message && err.message.includes('encrypt')) {
          alert('暗号化PDFは非対応です: ' + file.name);
        } else {
          alert('PDFの読み込みに失敗しました: ' + file.name + '\n' + err.message);
        }
      }
    }
    fileInput.value = '';
    updateUI();
  });
}

async function loadTab(tab) {
  tab.pdfDoc = await PDFLib.PDFDocument.load(tab.pdfBytes);
  tab.pdfJsDoc = await pdfjsLib.getDocument({ data: tab.pdfBytes.slice() }).promise;
  tab.pageCount = tab.pdfDoc.getPageCount();
  tab.selectedPages = tab.pageCount > 0 ? [0] : [];
  tab.lastSelectedPage = 0;
}

// pdfBytesが変わったらpdfJsDocキャッシュを更新
async function refreshPdfJsCache(tab) {
  tab.pdfJsDoc = await pdfjsLib.getDocument({ data: tab.pdfBytes.slice() }).promise;
}
```

- [ ] **Step 4: タブバーのレンダリング処理を追加**

```javascript
function renderTabBar() {
  const tabBar = document.getElementById('tab-bar');
  tabBar.innerHTML = '';
  App.tabs.forEach(tab => {
    const div = document.createElement('div');
    div.className = 'tab' + (tab.id === App.activeTabId ? ' active' : '');
    div.innerHTML = '<span class="tab-name">' + escapeHtml(tab.fileName) + '</span>'
      + '<span class="tab-close" title="閉じる">&times;</span>';
    div.querySelector('.tab-name').addEventListener('click', () => {
      App.activeTabId = tab.id;
      updateUI();
    });
    div.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      App.removeTab(tab.id);
      updateUI();
    });
    tabBar.appendChild(div);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

- [ ] **Step 5: サムネイル描画処理を追加（遅延レンダリング対応）**

```javascript
async function renderThumbnails() {
  const list = document.getElementById('thumbnail-list');
  list.innerHTML = '';
  const tab = App.getActiveTab();
  if (!tab) {
    list.innerHTML = '<div class="thumbnail-spinner">PDFファイルを開いてください</div>';
    return;
  }

  // キャッシュ済みPDF.jsドキュメントを使用
  const pdfJsDoc = tab.pdfJsDoc;

  for (let i = 0; i < tab.pageCount; i++) {
    const item = document.createElement('div');
    item.className = 'thumbnail-item' + (tab.selectedPages.includes(i) ? ' selected' : '');
    item.dataset.pageIndex = i;

    const canvas = document.createElement('canvas');
    const label = document.createElement('div');
    label.className = 'thumbnail-label';
    label.textContent = (i + 1) + ' / ' + tab.pageCount;

    item.appendChild(canvas);
    item.appendChild(label);
    list.appendChild(item);

    // サムネイル描画
    renderThumbnailCanvas(pdfJsDoc, i, canvas);

    // クリックイベント
    item.addEventListener('click', (e) => handleThumbnailClick(e, i));
  }
}

async function renderThumbnailCanvas(pdfJsDoc, pageIndex, canvas) {
  const page = await pdfJsDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 0.3 });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: viewport }).promise;
}
```

- [ ] **Step 6: ページ選択モデルを実装**

```javascript
function handleThumbnailClick(e, pageIndex) {
  const tab = App.getActiveTab();
  if (!tab) return;

  if (e.ctrlKey || e.metaKey) {
    // Ctrl+クリック: トグル
    const idx = tab.selectedPages.indexOf(pageIndex);
    if (idx >= 0) {
      tab.selectedPages.splice(idx, 1);
    } else {
      tab.selectedPages.push(pageIndex);
    }
  } else if (e.shiftKey && tab.lastSelectedPage !== null) {
    // Shift+クリック: 範囲選択
    const start = Math.min(tab.lastSelectedPage, pageIndex);
    const end = Math.max(tab.lastSelectedPage, pageIndex);
    tab.selectedPages = [];
    for (let i = start; i <= end; i++) {
      tab.selectedPages.push(i);
    }
  } else {
    // 通常クリック: 単一選択
    tab.selectedPages = [pageIndex];
  }
  tab.lastSelectedPage = pageIndex;
  updateThumbnailSelection();
  renderMainPreview();
}

function updateThumbnailSelection() {
  const tab = App.getActiveTab();
  document.querySelectorAll('.thumbnail-item').forEach(item => {
    const idx = parseInt(item.dataset.pageIndex);
    item.classList.toggle('selected', tab && tab.selectedPages.includes(idx));
  });
}
```

- [ ] **Step 7: updateUI関数を作成**

```javascript
function updateUI() {
  renderTabBar();
  renderThumbnails();
  renderMainPreview();
  updateMenuStates();
}

function updateMenuStates() {
  const tab = App.getActiveTab();
  const hasTab = !!tab;
  const hasSelection = hasTab && tab.selectedPages.length > 0;

  setMenuEnabled('download', hasTab);
  setMenuEnabled('delete-pages', hasSelection);
  setMenuEnabled('undo', hasTab && tab.undoStack.length > 0);
  setMenuEnabled('redo', hasTab && tab.redoStack.length > 0);
  setMenuEnabled('zoom-in', hasTab);
  setMenuEnabled('zoom-out', hasTab);
}

function setMenuEnabled(action, enabled) {
  const btn = document.querySelector('[data-action="' + action + '"]');
  if (btn) btn.disabled = !enabled;
}
```

- [ ] **Step 8: initFileInput を DOMContentLoaded に追加**

`DOMContentLoaded` イベント内に `initFileInput()` を追加。

- [ ] **Step 9: 検証**

`clasp push` → ブラウザで「ファイル」→「ファイルを開く」でPDFを選択 → サイドバーにサムネイルが表示され、クリックで選択（青枠）が切り替わることを確認。複数ファイルを開くとタブが追加されることを確認。

---

### Task 7: メインプレビュー

**Files:**
- Modify: `Scripts.html` — メインプレビュー描画、ズーム
- Modify: `Styles.html` — プレビューCSS
- Modify: `Page.html` — プレビューエリア構造

- [ ] **Step 1: Page.html のプレビューエリア構造を更新**

```html
<main id="preview-area">
  <div id="preview-container">
    <canvas id="preview-canvas"></canvas>
  </div>
  <div id="preview-empty">PDFファイルを開いてください</div>
</main>
```

- [ ] **Step 2: プレビューCSSを Styles.html に追加**

```css
#preview-container {
  display: none;
}

#preview-container canvas {
  max-width: 100%;
  box-shadow: var(--shadow);
  background: white;
}

#preview-empty {
  color: var(--text-secondary);
  font-size: 14px;
}
```

- [ ] **Step 3: メインプレビュー描画処理を追加**

```javascript
async function renderMainPreview() {
  const tab = App.getActiveTab();
  const container = document.getElementById('preview-container');
  const empty = document.getElementById('preview-empty');

  if (!tab || tab.selectedPages.length === 0) {
    container.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  container.style.display = 'block';
  empty.style.display = 'none';

  const pageIndex = tab.selectedPages[tab.selectedPages.length - 1];
  // キャッシュ済みPDF.jsドキュメントを使用
  const page = await tab.pdfJsDoc.getPage(pageIndex + 1);

  const baseScale = 1.5;
  const viewport = page.getViewport({ scale: baseScale * tab.zoom });
  const canvas = document.getElementById('preview-canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: viewport }).promise;
}

function zoomIn() {
  const tab = App.getActiveTab();
  if (!tab) return;
  tab.zoom = Math.min(tab.zoom + 0.25, 5.0);
  renderMainPreview();
}

function zoomOut() {
  const tab = App.getActiveTab();
  if (!tab) return;
  tab.zoom = Math.max(tab.zoom - 0.25, 0.25);
  renderMainPreview();
}
```

- [ ] **Step 4: 検証**

`clasp push` → PDFを開き、サムネイルクリックで右側にページが拡大表示されることを確認。表示メニューのズームイン/アウトで拡縮することを確認。

---

### Task 8: ページ削除とUndo/Redo

**Files:**
- Modify: `Scripts.html` — 削除、Undo/Redo処理

- [ ] **Step 1: Undo/Redo基盤を実装**

```javascript
function pushUndo(tab, descriptor) {
  // 大きなPDFではメモリ節約のためUndo段階を制限
  const maxUndo = tab.pdfBytes.length > 10 * 1024 * 1024 ? 5 : 10;
  tab.undoStack.push(descriptor);
  while (tab.undoStack.length > maxUndo) tab.undoStack.shift();
  tab.redoStack = [];
  updateMenuStates();
}

async function performUndo() {
  const tab = App.getActiveTab();
  if (!tab || tab.undoStack.length === 0) return;
  const desc = tab.undoStack.pop();
  await applyUndoDescriptor(tab, desc);
  tab.redoStack.push(desc);
  await refreshTab(tab);
}

async function performRedo() {
  const tab = App.getActiveTab();
  if (!tab || tab.redoStack.length === 0) return;
  const desc = tab.redoStack.pop();
  await applyRedoDescriptor(tab, desc);
  tab.undoStack.push(desc);
  await refreshTab(tab);
}

async function refreshTab(tab) {
  tab.pdfBytes = await tab.pdfDoc.save();
  await refreshPdfJsCache(tab);
  tab.pageCount = tab.pdfDoc.getPageCount();
  tab.selectedPages = tab.selectedPages.filter(i => i < tab.pageCount);
  if (tab.selectedPages.length === 0 && tab.pageCount > 0) {
    tab.selectedPages = [0];
  }
  updateUI();
}
```

- [ ] **Step 2: ページ削除を実装**

```javascript
async function deleteSelectedPages() {
  const tab = App.getActiveTab();
  if (!tab || tab.selectedPages.length === 0) return;

  if (tab.selectedPages.length >= tab.pageCount) {
    alert('最低1ページは残す必要があります。');
    return;
  }

  const snapshotBefore = tab.pdfBytes;
  const sorted = [...tab.selectedPages].sort((a, b) => b - a);
  for (const idx of sorted) {
    tab.pdfDoc.removePage(idx);
  }

  const bytesAfter = await tab.pdfDoc.save();
  pushUndo(tab, {
    type: 'delete',
    pages: [...tab.selectedPages].sort((a, b) => a - b),
    pdfBytesSnapshot: snapshotBefore,
    pdfBytesAfter: bytesAfter,
  });

  tab.pdfBytes = bytesAfter;
  await refreshPdfJsCache(tab);
  tab.pageCount = tab.pdfDoc.getPageCount();
  tab.selectedPages = tab.selectedPages.filter(i => i < tab.pageCount);
  if (tab.selectedPages.length === 0 && tab.pageCount > 0) {
    tab.selectedPages = [0];
  }
  updateUI();
}
```

- [ ] **Step 3: Undo/Redo操作の適用処理**

```javascript
async function applyUndoDescriptor(tab, desc) {
  switch (desc.type) {
    case 'delete':
    case 'cut':
      // 削除/カット前の状態に復元
      tab.pdfDoc = await PDFLib.PDFDocument.load(desc.pdfBytesSnapshot);
      tab.selectedPages = [...desc.pages];
      break;
    case 'insert':
    case 'paste':
    case 'duplicate':
      // 挿入/ペースト/複製前の状態に復元
      tab.pdfDoc = await PDFLib.PDFDocument.load(desc.pdfBytesSnapshot);
      break;
    case 'move':
      // 移動前の状態に復元
      tab.pdfDoc = await PDFLib.PDFDocument.load(desc.pdfBytesSnapshot);
      tab.selectedPages = [desc.from];
      break;
  }
}

async function applyRedoDescriptor(tab, desc) {
  // Redo: 操作後の状態に復元
  tab.pdfDoc = await PDFLib.PDFDocument.load(desc.pdfBytesAfter);
}
```

注意: 操作記述子方式を検討したが、pdf-libの制約（削除済みページの再挿入が不可）のため、操作前後のpdfBytesスナップショットを保持する方式に変更する。メモリ対策として最大10段階に制限。大きなPDF（10MB超）の場合は最大5段階に自動調整する。

- [ ] **Step 4: 検証**

`clasp push` → PDFを開き、ページを選択して編集メニューから「ページ削除」→ ページが消えることを確認。「元に戻す」で復元されることを確認。「やり直し」で再度削除されることを確認。

---

### Task 9: ダウンロード機能

**Files:**
- Modify: `Scripts.html`

- [ ] **Step 1: ダウンロード処理を実装**

```javascript
async function downloadPdf() {
  const tab = App.getActiveTab();
  if (!tab) return;

  const pdfBytes = await tab.pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  // GAS iframe内でURL.createObjectURLが使えない場合のフォールバック
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = tab.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    // フォールバック: data URL方式
    const base64 = uint8ArrayToBase64(pdfBytes);
    const a = document.createElement('a');
    a.href = 'data:application/pdf;base64,' + base64;
    a.download = tab.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
```

- [ ] **Step 2: 検証**

`clasp push` → PDFを開いてページを削除 → 「ファイル」→「ダウンロード保存」→ 削除後のPDFがダウンロードされることを確認。

---

### Task 10: キーボードショートカット（Phase 1）

**Files:**
- Modify: `Scripts.html`

- [ ] **Step 1: キーボードイベントハンドラを実装**

```javascript
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // テキスト入力中はショートカットを無効化（Ctrl+系は除く）
    const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    if (inInput && !e.ctrlKey && !e.altKey) return;

    const tab = App.getActiveTab();

    // Ctrl+O: ファイルを開く
    if (e.ctrlKey && e.key === 'o') {
      e.preventDefault();
      document.getElementById('file-input').click();
      return;
    }

    // Ctrl+S: ダウンロード保存
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (tab) downloadPdf();
      return;
    }

    // Ctrl+Z: 元に戻す
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      performUndo();
      return;
    }

    // Ctrl+Shift+Z: やり直し
    if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
      e.preventDefault();
      performRedo();
      return;
    }

    // Ctrl+A: 全選択
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      if (tab) {
        tab.selectedPages = Array.from({ length: tab.pageCount }, (_, i) => i);
        updateThumbnailSelection();
      }
      return;
    }

    // Delete: ページ削除
    if (e.key === 'Delete') {
      if (tab && tab.selectedPages.length > 0) deleteSelectedPages();
      return;
    }

    // 矢印キー: ページ移動
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (!tab) return;
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      const current = tab.selectedPages.length > 0
        ? tab.selectedPages[tab.selectedPages.length - 1] : 0;
      const next = Math.max(0, Math.min(tab.pageCount - 1, current + dir));
      tab.selectedPages = [next];
      tab.lastSelectedPage = next;
      updateThumbnailSelection();
      renderMainPreview();
      scrollThumbnailIntoView(next);
      return;
    }

    // Home / End
    if (e.key === 'Home' || e.key === 'End') {
      if (!tab) return;
      const idx = e.key === 'Home' ? 0 : tab.pageCount - 1;
      tab.selectedPages = [idx];
      tab.lastSelectedPage = idx;
      updateThumbnailSelection();
      renderMainPreview();
      scrollThumbnailIntoView(idx);
      return;
    }

    // Alt+左/右: タブ切り替え
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const idx = App.tabs.findIndex(t => t.id === App.activeTabId);
      if (idx === -1) return;
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      const newIdx = (idx + dir + App.tabs.length) % App.tabs.length;
      App.activeTabId = App.tabs[newIdx].id;
      updateUI();
      return;
    }

    // +/-: ズーム
    if (e.key === '+' || e.key === '=') { zoomIn(); return; }
    if (e.key === '-') { zoomOut(); return; }
  });
}

function scrollThumbnailIntoView(pageIndex) {
  const item = document.querySelector('.thumbnail-item[data-page-index="' + pageIndex + '"]');
  if (item) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
```

- [ ] **Step 2: initKeyboardShortcuts を DOMContentLoaded に追加**

- [ ] **Step 3: 検証**

`clasp push` → Ctrl+Oでファイル選択ダイアログ、矢印キーでページ移動、Deleteで削除、Ctrl+Zで戻る、Ctrl+Sでダウンロード — すべてのPhase 1ショートカットが動作することを確認。

---

### Task 11: ヘルプモーダル

**Files:**
- Modify: `Page.html` — モーダルHTML
- Modify: `Styles.html` — モーダルCSS
- Modify: `Scripts.html` — モーダル開閉

- [ ] **Step 1: Page.html にヘルプモーダルHTMLを追加**

```html
<div id="help-modal" class="modal-overlay" style="display:none">
  <div class="modal-content">
    <div class="modal-header">
      <h2>キーボードショートカット</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="shortcut-section">
        <h3>ナビゲーション</h3>
        <div class="shortcut-row"><kbd>&larr;</kbd> / <kbd>&rarr;</kbd><span>前/次のページ</span></div>
        <div class="shortcut-row"><kbd>Home</kbd> / <kbd>End</kbd><span>最初/最後のページ</span></div>
        <div class="shortcut-row"><kbd>Alt+&larr;</kbd> / <kbd>Alt+&rarr;</kbd><span>前/次のタブ</span></div>
      </div>
      <div class="shortcut-section">
        <h3>ファイル操作</h3>
        <div class="shortcut-row"><kbd>Ctrl+O</kbd><span>ファイルを開く</span></div>
        <div class="shortcut-row"><kbd>Ctrl+S</kbd><span>ダウンロード保存</span></div>
      </div>
      <div class="shortcut-section">
        <h3>編集</h3>
        <div class="shortcut-row"><kbd>Delete</kbd><span>ページ削除</span></div>
        <div class="shortcut-row"><kbd>Ctrl+A</kbd><span>全ページ選択</span></div>
        <div class="shortcut-row"><kbd>Ctrl+Z</kbd><span>元に戻す</span></div>
        <div class="shortcut-row"><kbd>Ctrl+Shift+Z</kbd><span>やり直し</span></div>
        <div class="shortcut-row"><kbd>Ctrl+C</kbd><span>ページコピー</span></div>
        <div class="shortcut-row"><kbd>Ctrl+X</kbd><span>ページカット</span></div>
        <div class="shortcut-row"><kbd>Ctrl+V</kbd><span>ページペースト</span></div>
        <div class="shortcut-row"><kbd>Ctrl+Shift+D</kbd><span>ページ複製</span></div>
        <div class="shortcut-row"><kbd>Ctrl+Shift+E</kbd><span>選択ページを分割</span></div>
      </div>
      <div class="shortcut-section">
        <h3>表示</h3>
        <div class="shortcut-row"><kbd>Ctrl+G</kbd><span>グリッド表示切替</span></div>
        <div class="shortcut-row"><kbd>+</kbd> / <kbd>-</kbd><span>ズームイン/アウト</span></div>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: モーダルCSSを Styles.html に追加**

```css
/* モーダル */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--bg-modal-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: var(--shadow-menu);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  font-size: 16px;
  font-weight: 600;
}

.modal-close {
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 4px;
}

.modal-close:hover {
  background: var(--bg-hover);
}

.modal-body {
  padding: 16px 20px;
}

.shortcut-section {
  margin-bottom: 16px;
}

.shortcut-section h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
}

.shortcut-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;
}

kbd {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 12px;
  font-family: inherit;
}
```

- [ ] **Step 3: モーダル開閉ロジックを Scripts.html に追加**

```javascript
function initHelpModal() {
  const modal = document.getElementById('help-modal');
  document.getElementById('help-btn').addEventListener('click', () => {
    modal.style.display = 'flex';
  });
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') modal.style.display = 'none';
  });
}
```

- [ ] **Step 4: initHelpModal を DOMContentLoaded に追加**

- [ ] **Step 5: 検証**

`clasp push` → ?ボタンクリックでモーダルが表示され、全ショートカットが一覧表示されることを確認。Escapeまたは外側クリックで閉じることを確認。

---

## Phase 2: 拡張機能

### Task 12: ドラッグ&ドロップ ページ並べ替え

**Files:**
- Modify: `Scripts.html` — D&Dロジック
- Modify: `Styles.html` — D&D視覚フィードバック

- [ ] **Step 1: ドラッグ&ドロップCSSを追加**

```css
.thumbnail-item.dragging {
  opacity: 0.4;
}

.thumbnail-item.drag-over-top {
  border-top: 3px solid var(--accent);
}

.thumbnail-item.drag-over-bottom {
  border-bottom: 3px solid var(--accent);
}
```

- [ ] **Step 2: D&Dイベントハンドラを実装**

```javascript
function initDragAndDrop() {
  const list = document.getElementById('thumbnail-list');
  let draggedIndex = null;

  list.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.thumbnail-item');
    if (!item) return;
    draggedIndex = parseInt(item.dataset.pageIndex);
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragend', (e) => {
    document.querySelectorAll('.thumbnail-item').forEach(el => {
      el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
    });
    draggedIndex = null;
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    const item = e.target.closest('.thumbnail-item');
    if (!item) return;
    document.querySelectorAll('.thumbnail-item').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    const rect = item.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      item.classList.add('drag-over-top');
    } else {
      item.classList.add('drag-over-bottom');
    }
  });

  list.addEventListener('drop', async (e) => {
    e.preventDefault();
    const item = e.target.closest('.thumbnail-item');
    if (!item || draggedIndex === null) return;

    let targetIndex = parseInt(item.dataset.pageIndex);
    const rect = item.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY >= midY) targetIndex++;
    if (targetIndex > draggedIndex) targetIndex--;

    if (targetIndex !== draggedIndex) {
      await movePage(draggedIndex, targetIndex);
    }
  });
}

async function movePage(fromIndex, toIndex) {
  const tab = App.getActiveTab();
  if (!tab) return;

  const snapshotBefore = tab.pdfBytes;

  // pdf-libでページ移動: 新しいドキュメントを作成して並べ替え
  const newOrder = Array.from({ length: tab.pageCount }, (_, i) => i);
  newOrder.splice(fromIndex, 1);
  newOrder.splice(toIndex, 0, fromIndex);

  const sourceDoc = await PDFLib.PDFDocument.load(tab.pdfBytes);
  const newDoc = await PDFLib.PDFDocument.create();
  const copiedPages = await newDoc.copyPages(sourceDoc, newOrder);
  copiedPages.forEach(page => newDoc.addPage(page));

  const bytesAfter = await newDoc.save();
  tab.pdfDoc = await PDFLib.PDFDocument.load(bytesAfter);
  tab.pdfBytes = bytesAfter;
  tab.pageCount = tab.pdfDoc.getPageCount();
  tab.selectedPages = [toIndex];

  pushUndo(tab, {
    type: 'move',
    from: fromIndex,
    to: toIndex,
    pdfBytesSnapshot: snapshotBefore,
    pdfBytesAfter: bytesAfter,
  });

  updateUI();
}
```

- [ ] **Step 3: サムネイルに draggable 属性を追加**

`renderThumbnails` 関数内の `item` 作成時に `item.setAttribute('draggable', 'true')` を追加。

- [ ] **Step 4: initDragAndDrop を DOMContentLoaded に追加**

- [ ] **Step 5: 検証**

`clasp push` → PDFを開き、サムネイルをドラッグ&ドロップでページ順序を変更できることを確認。Ctrl+Zで元に戻ることを確認。

---

### Task 13: コピー/カット/ペースト

**Files:**
- Modify: `Scripts.html`

- [ ] **Step 1: コピー/カット/ペースト処理を実装**

```javascript
async function copyPages() {
  const tab = App.getActiveTab();
  if (!tab || tab.selectedPages.length === 0) return;
  App.clipboard = {
    sourceTabId: tab.id,
    pages: [...tab.selectedPages].sort((a, b) => a - b),
    mode: 'copy',
    pdfBytes: tab.pdfBytes, // コピー元のPDFを保存
  };
}

async function cutPages() {
  const tab = App.getActiveTab();
  if (!tab || tab.selectedPages.length === 0) return;

  if (tab.selectedPages.length >= tab.pageCount) {
    alert('最低1ページは残す必要があります。');
    return;
  }

  App.clipboard = {
    sourceTabId: tab.id,
    pages: [...tab.selectedPages].sort((a, b) => a - b),
    mode: 'cut',
    pdfBytes: tab.pdfBytes,
  };

  // カット：ページを削除
  const snapshotBefore = tab.pdfBytes;
  const sorted = [...tab.selectedPages].sort((a, b) => b - a);
  for (const idx of sorted) {
    tab.pdfDoc.removePage(idx);
  }
  const bytesAfter = await tab.pdfDoc.save();

  pushUndo(tab, {
    type: 'cut',
    pages: App.clipboard.pages,
    pdfBytesSnapshot: snapshotBefore,
    pdfBytesAfter: bytesAfter,
  });

  tab.pdfBytes = bytesAfter;
  tab.pageCount = tab.pdfDoc.getPageCount();
  tab.selectedPages = tab.selectedPages.filter(i => i < tab.pageCount);
  if (tab.selectedPages.length === 0 && tab.pageCount > 0) {
    tab.selectedPages = [0];
  }
  updateUI();
}

async function pastePages() {
  const tab = App.getActiveTab();
  if (!tab || !App.clipboard) return;

  const snapshotBefore = tab.pdfBytes;
  const insertAt = tab.selectedPages.length > 0
    ? Math.max(...tab.selectedPages) + 1
    : tab.pageCount;

  const sourceDoc = await PDFLib.PDFDocument.load(App.clipboard.pdfBytes);
  const copiedPages = await tab.pdfDoc.copyPages(sourceDoc, App.clipboard.pages);
  for (let i = 0; i < copiedPages.length; i++) {
    tab.pdfDoc.insertPage(insertAt + i, copiedPages[i]);
  }

  const bytesAfter = await tab.pdfDoc.save();
  pushUndo(tab, {
    type: 'paste',
    at: insertAt,
    count: copiedPages.length,
    pdfBytesSnapshot: snapshotBefore,
    pdfBytesAfter: bytesAfter,
  });

  tab.pdfBytes = bytesAfter;
  tab.pageCount = tab.pdfDoc.getPageCount();
  tab.selectedPages = Array.from({ length: copiedPages.length }, (_, i) => insertAt + i);
  updateUI();
}
```

- [ ] **Step 2: キーボードショートカットにコピー/カット/ペーストを追加**

`initKeyboardShortcuts` のイベントハンドラに追加:

```javascript
// Ctrl+C: コピー
if (e.ctrlKey && e.key === 'c') {
  e.preventDefault();
  copyPages();
  return;
}

// Ctrl+X: カット
if (e.ctrlKey && e.key === 'x') {
  e.preventDefault();
  cutPages();
  return;
}

// Ctrl+V: ペースト
if (e.ctrlKey && e.key === 'v') {
  e.preventDefault();
  pastePages();
  return;
}
```

- [ ] **Step 3: 編集メニューにコピー/カット/ペースト項目を追加**

Page.html の編集メニューに追加し、`updateMenuStates` でクリップボード有無に応じてペーストの有効/無効を制御。

- [ ] **Step 4: 検証**

`clasp push` → ページをCtrl+Cでコピー → 別のページを選択 → Ctrl+Vでペースト → ページが挿入されることを確認。Ctrl+Xでカット → ページが消え → Ctrl+Vで別の場所にペースト。タブ間でのコピー&ペーストも確認。

---

### Task 14: ページ複製

**Files:**
- Modify: `Scripts.html`

- [ ] **Step 1: ページ複製処理を実装**

```javascript
async function duplicatePages() {
  const tab = App.getActiveTab();
  if (!tab || tab.selectedPages.length === 0) return;

  const snapshotBefore = tab.pdfBytes;
  const sorted = [...tab.selectedPages].sort((a, b) => a - b);

  // 元のドキュメントから一度にコピー（stale-bytes問題を回避）
  const sourceDoc = await PDFLib.PDFDocument.load(tab.pdfBytes);
  const copiedPages = await tab.pdfDoc.copyPages(sourceDoc, sorted);

  // 後ろから挿入してインデックスずれを防止
  for (let i = copiedPages.length - 1; i >= 0; i--) {
    tab.pdfDoc.insertPage(sorted[i] + 1, copiedPages[i]);
  }

  const bytesAfter = await tab.pdfDoc.save();
  pushUndo(tab, {
    type: 'duplicate',
    pages: sorted,
    pdfBytesSnapshot: snapshotBefore,
    pdfBytesAfter: bytesAfter,
  });

  tab.pdfBytes = bytesAfter;
  tab.pageCount = tab.pdfDoc.getPageCount();
  updateUI();
}
```

- [ ] **Step 2: Ctrl+Shift+D ショートカットを追加**

- [ ] **Step 3: 編集メニューに「ページ複製」を追加**

- [ ] **Step 4: 検証**

`clasp push` → ページ選択 → Ctrl+Shift+D → 直後に複製が挿入されることを確認。

---

### Task 15: PDF結合

**Files:**
- Modify: `Page.html` — 結合ダイアログHTML
- Modify: `Styles.html` — ダイアログCSS
- Modify: `Scripts.html` — 結合ロジック

- [ ] **Step 1: 結合ダイアログHTMLを Page.html に追加**

```html
<div id="merge-modal" class="modal-overlay" style="display:none">
  <div class="modal-content">
    <div class="modal-header">
      <h2>PDF結合</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
        結合するタブを選択し、ドラッグで並び順を調整してください。
      </p>
      <div id="merge-tab-list"></div>
    </div>
    <div class="modal-footer">
      <button id="merge-cancel" class="btn btn-secondary">キャンセル</button>
      <button id="merge-execute" class="btn btn-primary">結合</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: ボタンCSS、ダイアログフッターCSSを追加**

```css
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid var(--border-color);
}

.btn-primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

#merge-tab-list .merge-tab-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-bottom: 4px;
  cursor: grab;
  background: var(--bg-primary);
}

#merge-tab-list .merge-tab-item input {
  margin-right: 8px;
}
```

- [ ] **Step 3: 結合ロジックを実装**

```javascript
function showMergeDialog() {
  if (App.tabs.length < 2) {
    alert('結合するには2つ以上のPDFを開いてください。');
    return;
  }

  const modal = document.getElementById('merge-modal');
  const list = document.getElementById('merge-tab-list');
  list.innerHTML = '';

  App.tabs.forEach(tab => {
    const item = document.createElement('div');
    item.className = 'merge-tab-item';
    item.draggable = true;
    item.dataset.tabId = tab.id;
    item.innerHTML = '<input type="checkbox" checked>'
      + '<span>' + escapeHtml(tab.fileName) + '</span>';
    list.appendChild(item);
  });

  // 結合ダイアログ内のドラッグ&ドロップ並び替え
  let dragItem = null;
  list.addEventListener('dragstart', (e) => {
    dragItem = e.target.closest('.merge-tab-item');
    if (dragItem) dragItem.style.opacity = '0.4';
  });
  list.addEventListener('dragend', () => {
    if (dragItem) dragItem.style.opacity = '1';
    dragItem = null;
  });
  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.merge-tab-item');
    if (target && target !== dragItem) {
      const rect = target.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        list.insertBefore(dragItem, target);
      } else {
        list.insertBefore(dragItem, target.nextSibling);
      }
    }
  });

  modal.style.display = 'flex';
}

async function executeMerge() {
  const list = document.getElementById('merge-tab-list');
  const items = list.querySelectorAll('.merge-tab-item');
  const selectedTabIds = [];

  items.forEach(item => {
    if (item.querySelector('input').checked) {
      selectedTabIds.push(item.dataset.tabId);
    }
  });

  if (selectedTabIds.length < 2) {
    alert('2つ以上のタブを選択してください。');
    return;
  }

  const mergedDoc = await PDFLib.PDFDocument.create();
  const fileNames = [];

  for (const tabId of selectedTabIds) {
    const tab = App.tabs.find(t => t.id === tabId);
    if (!tab) continue;
    fileNames.push(tab.fileName);
    const sourceDoc = await PDFLib.PDFDocument.load(tab.pdfBytes);
    const copiedPages = await mergedDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
    copiedPages.forEach(page => mergedDoc.addPage(page));
  }

  const mergedBytes = await mergedDoc.save();
  const mergedName = '結合_' + fileNames[0];
  const newTab = App.createTab(mergedName, mergedBytes);
  await loadTab(newTab);

  document.getElementById('merge-modal').style.display = 'none';
  updateUI();
}
```

- [ ] **Step 4: ダイアログのイベントバインドと編集メニューに「PDF結合」追加**

- [ ] **Step 5: 検証**

`clasp push` → 2つ以上のPDFを開き、「編集」→「PDF結合」→ ダイアログでタブ選択 → 結合 → 新しいタブに結合PDFが表示されることを確認。

---

### Task 16: PDF分割

**Files:**
- Modify: `Page.html` — 分割ダイアログHTML
- Modify: `Scripts.html` — 分割ロジック

- [ ] **Step 1: 分割ダイアログHTMLを Page.html に追加**

```html
<div id="split-modal" class="modal-overlay" style="display:none">
  <div class="modal-content">
    <div class="modal-header">
      <h2>PDF分割</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom:12px;">
        <label style="font-size:13px;">
          <input type="radio" name="split-mode" value="selection" checked>
          選択中のページで分割
        </label>
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:13px;">
          <input type="radio" name="split-mode" value="range">
          ページ範囲を指定
        </label>
        <input type="text" id="split-range-input" placeholder="例: 1-3, 5, 7-10"
          style="width:100%;margin-top:4px;padding:6px 8px;border:1px solid var(--border-color);
          border-radius:4px;background:var(--bg-primary);color:var(--text-primary);font-size:13px;">
      </div>
      <p style="font-size:12px;color:var(--text-secondary);">
        指定されたページが新しいタブとして開きます。元のPDFはそのまま残ります。
      </p>
    </div>
    <div class="modal-footer">
      <button id="split-cancel" class="btn btn-secondary">キャンセル</button>
      <button id="split-execute" class="btn btn-primary">分割</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 分割ロジックを実装**

```javascript
function showSplitDialog() {
  const tab = App.getActiveTab();
  if (!tab) return;
  document.getElementById('split-modal').style.display = 'flex';
}

function parsePageRange(rangeStr, pageCount) {
  const pages = new Set();
  const parts = rangeStr.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr) - 1;
      const end = parseInt(endStr) - 1;
      if (isNaN(start) || isNaN(end) || start < 0 || end >= pageCount) continue;
      for (let i = start; i <= end; i++) pages.add(i);
    } else {
      const idx = parseInt(trimmed) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < pageCount) pages.add(idx);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

async function executeSplit() {
  const tab = App.getActiveTab();
  if (!tab) return;

  const mode = document.querySelector('input[name="split-mode"]:checked').value;
  let pages;

  if (mode === 'selection') {
    pages = [...tab.selectedPages].sort((a, b) => a - b);
  } else {
    const rangeStr = document.getElementById('split-range-input').value;
    pages = parsePageRange(rangeStr, tab.pageCount);
  }

  if (pages.length === 0) {
    alert('分割するページを選択してください。');
    return;
  }

  const sourceDoc = await PDFLib.PDFDocument.load(tab.pdfBytes);
  const newDoc = await PDFLib.PDFDocument.create();
  const copiedPages = await newDoc.copyPages(sourceDoc, pages);
  copiedPages.forEach(page => newDoc.addPage(page));

  const newBytes = await newDoc.save();
  const pageLabel = pages.map(p => p + 1).join(',');
  const newName = tab.fileName.replace('.pdf', '') + '_p' + pageLabel + '.pdf';
  const newTab = App.createTab(newName, newBytes);
  await loadTab(newTab);

  document.getElementById('split-modal').style.display = 'none';
  updateUI();
}
```

- [ ] **Step 3: Ctrl+Shift+E ショートカットと編集メニューに「PDF分割」を追加**

- [ ] **Step 4: 検証**

`clasp push` → PDFを開き、ページを選択して「編集」→「PDF分割」→「選択中のページで分割」→ 新タブに分割PDFが開くことを確認。範囲入力「1-3, 5」でも動作確認。

---

### Task 17: グリッド表示

**Files:**
- Modify: `Styles.html` — グリッドCSS
- Modify: `Scripts.html` — 表示切替ロジック
- Modify: `Page.html` — グリッド表示コンテナ

- [ ] **Step 1: Page.html にグリッド表示コンテナを追加**

```html
<div id="grid-view" style="display:none"></div>
```

`#main-container` の内部または代替として配置。

- [ ] **Step 2: グリッドCSSを追加**

```css
#grid-view {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  padding: 16px;
  overflow-y: auto;
  background: var(--bg-secondary);
}

#grid-view .thumbnail-item {
  cursor: pointer;
}
```

- [ ] **Step 3: 表示切替ロジックを実装**

```javascript
function toggleViewMode() {
  App.viewMode = App.viewMode === 'sidebar' ? 'grid' : 'sidebar';
  applyViewMode();
}

function applyViewMode() {
  const sidebar = document.getElementById('sidebar');
  const preview = document.getElementById('preview-area');
  const grid = document.getElementById('grid-view');

  if (App.viewMode === 'grid') {
    sidebar.style.display = 'none';
    preview.style.display = 'none';
    grid.style.display = 'grid';
    renderGridView();
  } else {
    sidebar.style.display = 'flex';
    preview.style.display = 'flex';
    grid.style.display = 'none';
  }
}
```

- [ ] **Step 4: グリッドレンダリングを実装**

```javascript
async function renderGridView() {
  const grid = document.getElementById('grid-view');
  grid.innerHTML = '';
  const tab = App.getActiveTab();
  if (!tab) return;

  const pdfJsDoc = tab.pdfJsDoc;

  for (let i = 0; i < tab.pageCount; i++) {
    const item = document.createElement('div');
    item.className = 'thumbnail-item' + (tab.selectedPages.includes(i) ? ' selected' : '');
    item.dataset.pageIndex = i;
    item.setAttribute('draggable', 'true');

    const canvas = document.createElement('canvas');
    const label = document.createElement('div');
    label.className = 'thumbnail-label';
    label.textContent = (i + 1) + ' / ' + tab.pageCount;

    item.appendChild(canvas);
    item.appendChild(label);
    grid.appendChild(item);

    renderThumbnailCanvas(pdfJsDoc, i, canvas);
    item.addEventListener('click', (e) => {
      handleThumbnailClick(e, i);
      if (App.viewMode === 'grid') updateGridSelection();
    });
  }
}

function updateGridSelection() {
  const tab = App.getActiveTab();
  document.querySelectorAll('#grid-view .thumbnail-item').forEach(item => {
    const idx = parseInt(item.dataset.pageIndex);
    item.classList.toggle('selected', tab && tab.selectedPages.includes(idx));
  });
}
```

- [ ] **Step 5: Ctrl+G ショートカットと表示メニューにグリッド切替を追加**

- [ ] **Step 6: 検証**

`clasp push` → Ctrl+Gでグリッド表示に切り替わり、サムネイルがタイル状に表示されることを確認。再度Ctrl+Gでサイドバー+プレビューに戻ることを確認。

---

### Task 18: ページ挿入（別PDFから）

**Files:**
- Modify: `Page.html` — 挿入ダイアログHTML
- Modify: `Scripts.html` — 挿入ロジック

- [ ] **Step 1: 挿入ダイアログHTMLを Page.html に追加**

```html
<div id="insert-modal" class="modal-overlay" style="display:none">
  <div class="modal-content">
    <div class="modal-header">
      <h2>ページ挿入</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom:12px;">
        <label style="font-size:13px;">挿入元のPDFファイル:</label>
        <input type="file" id="insert-file-input" accept=".pdf"
          style="width:100%;margin-top:4px;font-size:13px;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:13px;">挿入するページ（空欄で全ページ）:</label>
        <input type="text" id="insert-range-input" placeholder="例: 1-3, 5"
          style="width:100%;margin-top:4px;padding:6px 8px;border:1px solid var(--border-color);
          border-radius:4px;background:var(--bg-primary);color:var(--text-primary);font-size:13px;">
      </div>
      <p style="font-size:12px;color:var(--text-secondary);">
        現在選択中のページの後ろに挿入されます。
      </p>
    </div>
    <div class="modal-footer">
      <button id="insert-cancel" class="btn btn-secondary">キャンセル</button>
      <button id="insert-execute" class="btn btn-primary">挿入</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 挿入ロジックを実装**

```javascript
function showInsertDialog() {
  const tab = App.getActiveTab();
  if (!tab) return;
  document.getElementById('insert-file-input').value = '';
  document.getElementById('insert-range-input').value = '';
  document.getElementById('insert-modal').style.display = 'flex';
}

async function executeInsert() {
  const tab = App.getActiveTab();
  if (!tab) return;

  const fileInput = document.getElementById('insert-file-input');
  if (!fileInput.files.length) {
    alert('挿入元のPDFファイルを選択してください。');
    return;
  }

  const file = fileInput.files[0];
  const arrayBuffer = await file.arrayBuffer();
  const sourcePdfBytes = new Uint8Array(arrayBuffer);

  let sourceDoc;
  try {
    sourceDoc = await PDFLib.PDFDocument.load(sourcePdfBytes);
  } catch (err) {
    alert('PDFの読み込みに失敗しました: ' + err.message);
    return;
  }

  const rangeStr = document.getElementById('insert-range-input').value.trim();
  let pageIndices;
  if (rangeStr) {
    pageIndices = parsePageRange(rangeStr, sourceDoc.getPageCount());
    if (pageIndices.length === 0) {
      alert('有効なページ範囲を指定してください。');
      return;
    }
  } else {
    pageIndices = sourceDoc.getPageIndices();
  }

  const snapshotBefore = tab.pdfBytes;
  const insertAt = tab.selectedPages.length > 0
    ? Math.max(...tab.selectedPages) + 1
    : tab.pageCount;

  const copiedPages = await tab.pdfDoc.copyPages(sourceDoc, pageIndices);
  for (let i = 0; i < copiedPages.length; i++) {
    tab.pdfDoc.insertPage(insertAt + i, copiedPages[i]);
  }

  const bytesAfter = await tab.pdfDoc.save();
  pushUndo(tab, {
    type: 'insert',
    at: insertAt,
    count: copiedPages.length,
    pdfBytesSnapshot: snapshotBefore,
    pdfBytesAfter: bytesAfter,
  });

  tab.pdfBytes = bytesAfter;
  await refreshPdfJsCache(tab);
  tab.pageCount = tab.pdfDoc.getPageCount();
  tab.selectedPages = Array.from({ length: copiedPages.length }, (_, i) => insertAt + i);

  document.getElementById('insert-modal').style.display = 'none';
  updateUI();
}
```

- [ ] **Step 3: ダイアログのイベントバインドを追加**

初期化時に挿入モーダルの「挿入」「キャンセル」「閉じる」ボタンにイベントリスナーをバインド。

- [ ] **Step 4: 検証**

`clasp push` → PDFを開き、「編集」→「ページ挿入」→ 別PDFを選択 → ページ範囲を指定して挿入 → 正しい位置にページが追加されることを確認。Ctrl+Zで元に戻ることを確認。

---

### Task 19: 編集メニューのPhase 2項目を完成

**Files:**
- Modify: `Page.html` — メニュー項目追加
- Modify: `Scripts.html` — handleMenuAction に全アクション追加

- [ ] **Step 1: Page.html の編集メニューに全Phase 2項目を追加**

コピー、カット、ペースト、複製、挿入、結合、分割のボタンを追加。

- [ ] **Step 2: 表示メニューにグリッド切替を追加**

- [ ] **Step 3: handleMenuAction に全アクションを接続**

```javascript
case 'copy-pages': copyPages(); break;
case 'cut-pages': cutPages(); break;
case 'paste-pages': pastePages(); break;
case 'duplicate-pages': duplicatePages(); break;
case 'insert-pages': showInsertDialog(); break;
case 'merge-pdfs': showMergeDialog(); break;
case 'split-pdf': showSplitDialog(); break;
case 'toggle-grid': toggleViewMode(); break;
```

- [ ] **Step 4: updateMenuStates を更新**

クリップボードの有無、タブ数などに応じてメニューの有効/無効を制御。

- [ ] **Step 5: 検証**

`clasp push` → すべての編集メニュー項目が正しく表示され、各操作が動作することを確認。

---

## Phase 3: Drive連携

### Task 20: Code.gs にDrive関数を追加

**Files:**
- Modify: `Code.gs`

- [ ] **Step 1: Drive読み込み・保存・一覧取得関数を追加**

```javascript
function loadPdfFromDrive(fileId) {
  var file = DriveApp.getFileById(fileId);
  var blob = file.getBlob();
  var base64 = Utilities.base64Encode(blob.getBytes());
  return {
    name: file.getName(),
    data: base64
  };
}

function savePdfToDrive(base64Data, fileName, folderId) {
  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, 'application/pdf', fileName);
  if (folderId) {
    var folder = DriveApp.getFolderById(folderId);
    return folder.createFile(blob).getId();
  } else {
    return DriveApp.createFile(blob).getId();
  }
}

function listPdfsInFolder(folderId) {
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFilesByType('application/pdf');
  var list = [];
  while (files.hasNext()) {
    var f = files.next();
    list.push({ id: f.getId(), name: f.getName() });
  }
  return list;
}
```

- [ ] **Step 2: 検証**

GASエディタで `loadPdfFromDrive('テスト用ファイルID')` を手動実行し、結果が返ることを確認。

---

### Task 21: Drive UIと連携

**Files:**
- Modify: `Page.html` — Driveメニューとダイアログ
- Modify: `Scripts.html` — Drive連携ロジック
- Modify: `Styles.html` — ダイアログCSS

- [ ] **Step 1: Page.html にDriveメニューを追加**

```html
<div class="menu-item" data-menu="drive">
  <span class="menu-label">Drive</span>
  <div class="menu-dropdown">
    <button data-action="drive-open">Driveから開く</button>
    <button data-action="drive-save" disabled>Driveに保存</button>
  </div>
</div>
```

- [ ] **Step 2: Drive読み込みダイアログHTMLを追加**

ファイルID入力フィールドを持つシンプルなダイアログ。

- [ ] **Step 3: Drive連携ロジックを実装**

```javascript
function uint8ArrayToBase64(uint8Array) {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function openFromDrive(fileId) {
  google.script.run
    .withSuccessHandler(async (result) => {
      try {
        const pdfBytes = base64ToUint8Array(result.data);
        await PDFLib.PDFDocument.load(pdfBytes);
        const tab = App.createTab(result.name, pdfBytes);
        await loadTab(tab);
        updateUI();
      } catch (err) {
        alert('PDFの読み込みに失敗しました: ' + err.message);
      }
    })
    .withFailureHandler((err) => {
      alert('Driveからの読み込みに失敗しました: ' + err.message);
    })
    .loadPdfFromDrive(fileId);
}

async function saveToDrive() {
  const tab = App.getActiveTab();
  if (!tab) return;
  const base64 = uint8ArrayToBase64(await tab.pdfDoc.save());
  google.script.run
    .withSuccessHandler((fileId) => {
      alert('保存完了しました（ファイルID: ' + fileId + '）');
    })
    .withFailureHandler((err) => {
      alert('保存に失敗しました: ' + err.message);
    })
    .savePdfToDrive(base64, tab.fileName);
}
```

- [ ] **Step 4: handleMenuAction にDriveアクションを追加**

- [ ] **Step 5: 検証**

`clasp push` → 「Drive」→「Driveから開く」でファイルIDを入力 → PDFが新タブで開くことを確認。「Driveに保存」で保存されることを確認。

---

### Task 22: 最終検証とPencilデザイン確認

**Files:** なし（検証のみ）

- [ ] **Step 1: Phase 1 全機能テスト**

ファイルオープン、サムネイル表示、プレビュー、ページ選択（クリック/Ctrl/Shift）、ページ削除、Undo/Redo、ダウンロード、テーマ切替、ヘルプモーダル、全Phase 1ショートカットを通しで検証。

- [ ] **Step 2: Phase 2 全機能テスト**

D&D並べ替え、コピー/カット/ペースト（同一タブ、タブ間）、複製、PDF結合、PDF分割（選択/範囲入力）、グリッド表示切替、全Phase 2ショートカットを通しで検証。

- [ ] **Step 3: Phase 3 全機能テスト**

Driveからの読み込み、Driveへの保存を検証。

- [ ] **Step 4: Pencilスクリーンショットで最終デザイン確認**

`get_screenshot` で完成したUIをPencilデザインと比較し、差異があれば調整。

- [ ] **Step 5: ライト/ダークテーマの両方で表示崩れがないことを確認**
