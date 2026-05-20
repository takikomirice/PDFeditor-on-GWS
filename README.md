# PDF Editor on GWS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/takikomirice/PDFeditor-on-GWS?label=release)](https://github.com/takikomirice/PDFeditor-on-GWS/releases/tag/v1.0.0)

Google Apps Script (GAS) で配信する、Google Workspace 向けの PDF 編集 Web アプリです。  
PDF の編集処理はブラウザ側で `pdf-lib` と `PDF.js` を使って実行し、GAS は画面配信を担当します。

## 概要

PDF Editor on GWS は、Google Apps Script の Web アプリとして動作するクライアントサイド PDF エディタです。PDF データを外部サーバーへ送信せず、ブラウザ内でページの並べ替え、削除、コピー、分割、結合、ダウンロード保存を行えます。

## 現在の実装内容

現時点でコード上に実装されている主な機能は次のとおりです。

- ローカル PDF の複数読み込み
- タブでの複数 PDF 管理
- サイドバーでのページサムネイル表示
- メインプレビュー表示
  - 縦連続ページ表示
  - 左右中央寄せ表示
  - ズームイン / ズームアウト
  - 画面に合わせる
  - 100% に戻す
  - 右下固定の表示コントロール
- ページ選択
  - クリック
  - `Ctrl` / `Cmd` + クリック
  - `Shift` + クリック
  - `Ctrl+A`
- ページ削除
- ページのドラッグ&ドロップ並べ替え
  - サイドバー表示
  - グリッド表示
- ページコピー / カット / ペースト
- ページ複製
- 別 PDF からのページ挿入
- 複数タブの PDF 結合
- 選択ページまたは範囲指定による PDF 分割
- 編集結果のダウンロード保存
- ライト / ダークテーマ切り替え
- グリッド表示切り替え
- ショートカット一覧モーダル

## 技術構成

- Google Apps Script
- `pdf-lib` 1.17.1（`PdfLib.html` に同梱）
- `PDF.js` 3.11.174（`PdfLib.html` と `index.html` 内 worker に同梱）
- HTML Service テンプレート
  - `index.html`
  - `PdfLib.html`

PDF のページ操作はブラウザ内で完結します。GAS は画面配信のみを担当し、`google.script.run` による通信は行いません。PDF データを外部 API や外部サーバーへ送信する処理はありません。

実行時に `unpkg.com` や `cdnjs.cloudflare.com` から PDF ライブラリを取得しません。`index.html` は同じ Web アプリの `?asset=PdfLib` から、`ContentService` の JavaScript MIME で同梱済みの `PdfLib.html` を読み込みます。`PdfLib.html` は script タグを含まない JavaScript 本文として管理します。

PDF.js worker は `index.html` 内の非実行 script 要素へテキストとして埋め込み、同じ `index.html` 内のアプリスクリプトで `Blob` URL を生成して `pdfjsLib.GlobalWorkerOptions.workerSrc` に設定します。GAS の HTML Service / ブラウザ側 CSP で `Blob` worker が拒否される環境では、同梱 worker を main thread で実行する PDF.js fake worker fallback を使います。大きめの PDF では表示速度が落ちる可能性があります。

## ファイル構成

```text
.
├── appsscript.json
├── Code.gs
├── PdfLib.html
├── index.html
├── tests/
└── docs/
```

各ファイルの役割:

- `appsscript.json`
  - GAS のプロジェクト設定
- `Code.gs`
  - `doGet`
  - HTML インクルード
- `index.html`
  - 画面レイアウト
  - 各モーダル定義
  - テーマ変数 / レイアウト / メニュー / モーダル / サムネイルのスタイル
  - 状態管理 / PDF 編集処理 / UI 更新 / キーボードショートカット
  - PDF.js worker の埋め込み
- `PdfLib.html`
  - `pdf-lib` 1.17.1 の minified JS
  - `PDF.js` 3.11.174 の minified JS
- `tests/view-controls.test.mjs`
  - GAS 手動投入用の3ファイル構成
  - ズームショートカット
  - 表示レイアウト
  - グリッド並べ替え関連のテスト

## セットアップ

### 1. GAS プロジェクトを用意

`clasp` を使って Apps Script プロジェクトに接続します。

```bash
npm install -g @google/clasp
clasp login
clasp clone <SCRIPT_ID>
```

既存プロジェクトに紐付けない場合は、`.clasp.example.json` を `.clasp.json` にコピーして、`scriptId` を自分の Apps Script プロジェクト ID に置き換えてください。`.clasp.json` はローカル環境ごとの設定として Git 管理対象外にしています。

### 2. ファイルを反映

```bash
clasp push
```

### 3. Web アプリとしてデプロイ

Apps Script エディタから Web アプリとしてデプロイします。  
想定は、組織内ユーザー向けの公開です。

## 使い方

### ローカル PDF を開く

- メニュー `ファイル > ファイルを開く`
- または `Ctrl+O`

### 基本操作

- サムネイルをクリックしてページ選択
- `Delete` で削除
- `Ctrl+S` でダウンロード保存
- 通常表示では `↑` / `↓` でプレビューをスクロール
- `←` / `→` で前後ページを選択
- `+` / `。` でズームイン
- `-` / `、` でズームアウト
- `/` で画面に合わせる
- `￥` / `\` で 100% に戻す

### 複数ページ操作

- `Ctrl` / `Cmd` + クリックで複数選択
- `Shift` + クリックで範囲選択
- `Ctrl+C`, `Ctrl+X`, `Ctrl+V`
- `Ctrl+Shift+D` で複製
- サイドバーまたはグリッド表示のサムネイルをドラッグして並べ替え
- グリッド表示では `↑` / `↓` / `←` / `→` で選択ページを移動
- グリッド表示では `Enter` で選択ページの通常表示へ戻る

### PDF 単位の操作

- `編集 > PDF結合`
- `編集 > PDF分割`
- `編集 > ページ挿入（別PDFから）`

## ショートカット

現在 UI 上に表示されている主なショートカット:

- `Ctrl+O`: ファイルを開く
- `Ctrl+S`: ダウンロード保存
- `Ctrl+Z`: 元に戻す
- `Ctrl+Shift+Z`: やり直し
- `Ctrl+A`: 全ページ選択
- `Ctrl+C`: ページコピー
- `Ctrl+X`: ページカット
- `Ctrl+V`: ページペースト
- `Ctrl+Shift+D`: ページ複製
- `Ctrl+Shift+E`: PDF 分割ダイアログ
- `Ctrl+G`: グリッド表示切り替え
- `Delete`: 選択ページ削除
- `Alt+←` / `Alt+→`: タブ切り替え
- 通常表示の `↑` / `↓`: プレビューをスクロール
- 通常表示の `←` / `→`: 前後ページ選択
- グリッド表示の `↑` / `↓` / `←` / `→`: 選択ページ移動
- グリッド表示の `Enter`: 選択ページの通常表示へ戻る
- `Home` / `End`: 最初 / 最後のページへ移動
- `+` / `。`: ズームイン
- `-` / `、`: ズームアウト
- `/`: 画面に合わせる
- `￥` / `\`: 100% に戻す

## 実装上の前提と注意点

- PDF ライブラリは GAS プロジェクト内に同梱しています。実行時に `unpkg.com` / `cdnjs.cloudflare.com` へアクセスしません。
- PDF データはブラウザ内で処理します。外部 API への送信処理はありません。
- パスワード付き PDF は非対応です。
- Undo / Redo は操作前後の PDF バイト列をフルスナップショットで保持する方式です。大きいファイル（目安: 10 MB 超）を多く操作するとメモリ使用量が増加します。上限は PDF サイズに応じて 5〜10 件に制限していますが、抜本的な改善は今後の課題です。
- 自動テストは `tests/view-controls.test.mjs` に一部ありますが、主に表示制御とショートカットの回帰確認用です。
- 全体の動作確認は引き続き GAS デプロイ後の手動確認が前提です。

## ライセンス

このプロジェクトは [MIT License](LICENSE) で公開しています。

同梱ライブラリ:

- `pdf-lib` 1.17.1: MIT License
- `PDF.js` 3.11.174: Apache License 2.0

PDF.js の minified JS に含まれるライセンスコメントは保持しています。`pdf-lib` のライセンスはこのREADMEで明記しています。
