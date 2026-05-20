import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const projectRoot = process.cwd();
const indexPath = path.join(projectRoot, 'index.html');
const codePath = path.join(projectRoot, 'Code.gs');
const pdfLibPath = path.join(projectRoot, 'PdfLib.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const codeSource = fs.readFileSync(codePath, 'utf8');
const pdfLibHtml = fs.readFileSync(pdfLibPath, 'utf8');

function extractStyleBlock(source) {
  const match = source.match(/<style>\s*[\s\S]*?\s*<\/style>/);
  assert.ok(match, 'index.html is missing an inline style block');
  return match[0];
}

function extractScriptSourceByMarker(source, marker) {
  const scriptPattern = /<script(?:\s[^>]*)?>\s*([\s\S]*?)\s*<\/script>/gi;
  let match = scriptPattern.exec(source);
  while (match) {
    if (match[1].includes(marker)) return match[1];
    match = scriptPattern.exec(source);
  }
  assert.fail(`index.html is missing an inline script containing ${marker}`);
}

function extractWorkerSource(source) {
  const match = source.match(/<script\s+id="pdfjs-worker-source"\s+type="text\/plain">\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match, 'index.html is missing inline PDF.js worker source');
  return match[1];
}

const stylesHtml = extractStyleBlock(indexHtml);
const scriptSource = extractScriptSourceByMarker(indexHtml, '// === 状態管理 ===');
const workerSource = extractWorkerSource(indexHtml);
const pdfDependencySource = pdfLibHtml.trim();

function createElementStub() {
  return {
    style: {},
    dataset: {},
    disabled: false,
    value: '',
    checked: false,
    innerHTML: '',
    textContent: '',
    className: '',
    files: [],
    width: 0,
    height: 0,
    appendChild() {},
    removeChild() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return createElementStub(); },
    querySelectorAll() { return []; },
    setAttribute() {},
    getAttribute() { return null; },
    getBoundingClientRect() {
      return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
    },
    getContext() {
      return {};
    },
    scrollIntoView() {},
    click() {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
  };
}

function loadContext(overrides = {}) {
  const documentListeners = [];
  let context;
  const documentStub = {
    body: createElementStub(),
    documentElement: createElementStub(),
    head: {
      appendChild(element) {
        if (element.textContent) {
          vm.runInContext(element.textContent, context, { filename: 'inline-worker-fallback.js' });
        }
      },
    },
    addEventListener(type, handler) {
      documentListeners.push({ type, handler });
    },
    removeEventListener() {},
    getElementById(id) {
      if (id === 'pdfjs-worker-source') {
        return { textContent: 'globalThis.pdfjsWorker={WorkerMessageHandler:{setup:function(){}}};' };
      }
      return createElementStub();
    },
    querySelector() { return createElementStub(); },
    querySelectorAll() { return []; },
    createElement() { return createElementStub(); },
  };

  context = {
    console,
    globalThis: null,
    localStorage: {
      getItem() { return null; },
      setItem() {},
    },
    document: documentStub,
    window: { document: documentStub },
    PDFLib: {
      PDFDocument: {
        load: async () => ({}),
      },
    },
    pdfjsLib: {
      GlobalWorkerOptions: {},
    },
    google: {
      script: {
        run: {},
      },
    },
    alert() {},
    Blob,
    URL: {
      createObjectURL() { return 'blob:mock'; },
      revokeObjectURL() {},
    },
    Uint8Array,
    Array,
    Math,
    setTimeout,
    clearTimeout,
    __documentListeners: documentListeners,
    ...overrides,
  };
  context.globalThis = context;
  context.window.globalThis = context;

  vm.createContext(context);
  vm.runInContext(scriptSource, context, { filename: 'index.html' });
  return context;
}

function runTest(name, fn) {
  try {
    fn();
    console.log('PASS', name);
  } catch (error) {
    console.error('FAIL', name);
    throw error;
  }
}

function getDocumentListener(context, type) {
  const listener = context.__documentListeners.find(item => item.type === type);
  assert.ok(listener, `${type} listener should be registered`);
  return listener.handler;
}

runTest('GAS source files are consolidated for manual deployment', () => {
  const gasSourceFiles = fs.readdirSync(projectRoot)
    .filter(fileName => /\.(?:gs|html)$/i.test(fileName))
    .sort();

  assert.deepEqual(gasSourceFiles, ['Code.gs', 'PdfLib.html', 'index.html']);
});

runTest('index loads bundled PDF libraries from a single GAS template include', () => {
  assert.doesNotMatch(indexHtml, /<script\s+src=["']https?:\/\/[^"']+/);
  assert.doesNotMatch(indexHtml, /unpkg\.com|cdnjs\.cloudflare\.com/);
  assert.match(indexHtml, /<head>[\s\S]*<script\s+src="<\?!=\s*getAssetUrl\('PdfLib'\)\s*\?>"><\/script>/);
  assert.doesNotMatch(indexHtml, /<\?!=\s*include\('(?:PdfJs|PdfJsWorker|Styles|Scripts)'\)\s*\?>/);
  assert.match(workerSource, /WorkerMessageHandler/);
});

runTest('PDF dependency asset avoids nested script tags during GAS rendering', () => {
  assert.doesNotMatch(pdfLibHtml, /<\/?script\b/i);
  assert.doesNotMatch(pdfDependencySource, /<\/script/i);
  assert.match(codeSource, /ContentService[\s\S]*\.createTextOutput\([\s\S]*getRawContent_\('PdfLib'\)[\s\S]*\)\s*\.setMimeType\(ContentService\.MimeType\.JAVASCRIPT\)/);
  assert.match(codeSource, /function\s+getAssetUrl\s*\(\s*assetName\s*\)/);
});

runTest('Scripts configures the PDF.js worker from bundled source without external URLs', () => {
  assert.doesNotMatch(scriptSource, /unpkg\.com|cdnjs\.cloudflare\.com/);
  assert.doesNotMatch(scriptSource, /workerSrc\s*=\s*['"]https?:\/\//);
  assert.match(scriptSource, /pdfjs-worker-source/);
  assert.match(scriptSource, /URL\.createObjectURL/);
  assert.match(scriptSource, /new Blob/);
});

runTest('bundled PDF.js worker also executes on the main thread for fake worker fallback', () => {
  assert.match(indexHtml, /<script\s+id="pdfjs-worker-source"\s+type="text\/plain">/);

  const workerContext = {
    console,
    Uint8Array,
    ArrayBuffer,
    Promise,
  };
  workerContext.globalThis = workerContext;
  workerContext.window = workerContext;
  workerContext.self = workerContext;
  vm.createContext(workerContext);
  vm.runInContext(workerSource, workerContext, { filename: 'pdf.worker.js' });

  assert.equal(typeof workerContext.pdfjsWorker?.WorkerMessageHandler?.setup, 'function');
});

runTest('app initialization is registered even when Blob worker URLs are blocked', () => {
  const context = loadContext({
    console: {
      error() {},
      log() {},
      warn() {},
    },
    URL: {
      createObjectURL() {
        throw new Error('blob URL blocked');
      },
      revokeObjectURL() {},
    },
  });

  assert.ok(
    context.__documentListeners.some(listener => listener.type === 'DOMContentLoaded'),
    'DOMContentLoaded initialization listener should still be registered'
  );
});

runTest('Code.gs renders index as a template and exposes include helper', () => {
  assert.match(codeSource, /function\s+doGet\s*\(\s*e\s*\)\s*{[\s\S]*HtmlService\.createTemplateFromFile\('index'\)/);
  assert.match(codeSource, /function\s+getRawContent_\s*\(\s*filename\s*\)\s*{[\s\S]*createTemplateFromFile\(filename\)\.getRawContent\(\)/);
});

runTest('bundled PDF dependencies are present without runtime CDN access', () => {
  assert.match(pdfLibHtml, /PDFLib/);
  assert.match(pdfLibHtml, /pdfjsLib/);
  assert.match(pdfDependencySource, /^!function/);
  assert.match(workerSource, /WorkerMessageHandler/);
  assert.doesNotMatch(pdfLibHtml, /unpkg\.com|cdnjs\.cloudflare\.com/);

  const dependencyContext = {
    console,
    setTimeout,
    clearTimeout,
    TextEncoder,
    TextDecoder,
    URL,
    Blob,
    Uint8Array,
    ArrayBuffer,
    Promise,
  };
  dependencyContext.globalThis = dependencyContext;
  dependencyContext.window = dependencyContext;
  dependencyContext.self = dependencyContext;
  vm.createContext(dependencyContext);
  vm.runInContext(pdfDependencySource, dependencyContext, { filename: 'PdfLib.html' });
  assert.ok(dependencyContext.PDFLib, 'PDFLib global is missing after evaluating PdfLib.html');
  assert.ok(dependencyContext.pdfjsLib, 'pdfjsLib global is missing after evaluating PdfLib.html');
});

runTest('normalizeZoomShortcutKey maps existing and JP keyboard shortcuts', () => {
  const context = loadContext();

  assert.equal(typeof context.normalizeZoomShortcutKey, 'function');
  assert.equal(context.normalizeZoomShortcutKey({ key: '+', code: 'Equal' }), 'zoom-in');
  assert.equal(context.normalizeZoomShortcutKey({ key: '。', code: 'Period' }), 'zoom-in');
  assert.equal(context.normalizeZoomShortcutKey({ key: '-', code: 'Minus' }), 'zoom-out');
  assert.equal(context.normalizeZoomShortcutKey({ key: '、', code: 'Comma' }), 'zoom-out');
  assert.equal(context.normalizeZoomShortcutKey({ key: '/', code: 'Slash' }), 'fit');
  assert.equal(context.normalizeZoomShortcutKey({ key: '￥', code: 'IntlYen' }), 'reset');
  assert.equal(context.normalizeZoomShortcutKey({ key: '\\', code: 'Backslash' }), 'reset');
  assert.equal(context.normalizeZoomShortcutKey({ key: 'x', code: 'KeyX' }), null);
});

runTest('computeFitZoom respects both width and height constraints', () => {
  const context = loadContext();

  assert.equal(typeof context.computeFitZoom, 'function');

  const widePageZoom = context.computeFitZoom({
    pageWidth: 800,
    pageHeight: 1200,
    containerWidth: 800,
    containerHeight: 1200,
    paddingX: 80,
    paddingY: 120,
    baseScale: 1.5,
    minZoom: 0.25,
    maxZoom: 5,
  });
  assert.equal(widePageZoom, 0.6);

  const clampedZoom = context.computeFitZoom({
    pageWidth: 100,
    pageHeight: 100,
    containerWidth: 4000,
    containerHeight: 4000,
    paddingX: 0,
    paddingY: 0,
    baseScale: 1.5,
    minZoom: 0.25,
    maxZoom: 5,
  });
  assert.equal(clampedZoom, 5);
});

runTest('computePageReorderTargetIndex adjusts insertion index for before and after drops', () => {
  const context = loadContext();

  assert.equal(typeof context.computePageReorderTargetIndex, 'function');
  assert.equal(context.computePageReorderTargetIndex(4, 1, false), 1);
  assert.equal(context.computePageReorderTargetIndex(1, 4, false), 3);
  assert.equal(context.computePageReorderTargetIndex(1, 4, true), 4);
});

runTest('computeDropPlacement uses vertical axis for list and horizontal axis for grid', () => {
  const context = loadContext();

  assert.equal(typeof context.computeDropPlacement, 'function');
  const rect = { left: 10, top: 20, width: 100, height: 80 };

  assert.equal(context.computeDropPlacement(rect, 50, 40, 'list'), 'before');
  assert.equal(context.computeDropPlacement(rect, 50, 90, 'list'), 'after');
  assert.equal(context.computeDropPlacement(rect, 30, 90, 'grid'), 'before');
  assert.equal(context.computeDropPlacement(rect, 90, 30, 'grid'), 'after');
});

runTest('computeGridNavigationTarget moves by rows and columns with clamped bounds', () => {
  const context = loadContext();

  assert.equal(typeof context.computeGridNavigationTarget, 'function');
  assert.equal(context.computeGridNavigationTarget(4, 'ArrowLeft', 3, 10), 3);
  assert.equal(context.computeGridNavigationTarget(4, 'ArrowRight', 3, 10), 5);
  assert.equal(context.computeGridNavigationTarget(4, 'ArrowUp', 3, 10), 1);
  assert.equal(context.computeGridNavigationTarget(4, 'ArrowDown', 3, 10), 7);
  assert.equal(context.computeGridNavigationTarget(1, 'ArrowUp', 3, 10), 0);
  assert.equal(context.computeGridNavigationTarget(8, 'ArrowDown', 3, 10), 9);
});

runTest('Enter in grid view returns to sidebar view for the selected page', () => {
  const context = loadContext();
  let applyCount = 0;
  let prevented = false;

  context.applyViewMode = () => {
    applyCount += 1;
  };

  vm.runInContext(`
    App.tabs = [{
      id: 'tab-1',
      pageCount: 5,
      selectedPages: [2],
      lastSelectedPage: 2,
      undoStack: [],
      redoStack: []
    }];
    App.activeTabId = 'tab-1';
    App.viewMode = 'grid';
    initKeyboardShortcuts();
  `, context);

  getDocumentListener(context, 'keydown')({
    key: 'Enter',
    code: 'Enter',
    target: { tagName: 'BODY' },
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.equal(vm.runInContext('App.viewMode', context), 'sidebar');
  assert.equal(applyCount, 1);
});

runTest('help modal documents continuous view and grid keyboard navigation', () => {
  assert.match(indexHtml, /<h2>キーボードショートカット<\/h2>/);
  assert.match(indexHtml, /<kbd>&uarr;<\/kbd>\s*\/\s*<kbd>&darr;<\/kbd><span>通常表示でプレビューをスクロール<\/span>/);
  assert.match(indexHtml, /<kbd>&larr;<\/kbd>\s*\/\s*<kbd>&rarr;<\/kbd><span>通常表示で前\/次のページ<\/span>/);
  assert.match(indexHtml, /<kbd>&uarr;<\/kbd>\s*\/\s*<kbd>&darr;<\/kbd>\s*\/\s*<kbd>&larr;<\/kbd>\s*\/\s*<kbd>&rarr;<\/kbd><span>グリッド表示で選択ページを移動<\/span>/);
  assert.match(indexHtml, /<kbd>Enter<\/kbd><span>グリッド表示から通常表示へ戻る<\/span>/);
});

runTest('preview markup separates scrollable content from fixed overlay controls', () => {
  assert.match(
    indexHtml,
    /<main id="preview-area">\s*<div id="preview-scroll">[\s\S]*<div id="preview-container">[\s\S]*<\/div>\s*<div id="preview-empty">[\s\S]*<\/div>\s*<\/div>\s*<div id="view-controls"/
  );
  assert.doesNotMatch(indexHtml, /<canvas\s+id="preview-canvas"/);
});

runTest('styles keep preview horizontally centered, top visible, and controls fixed bottom-right', () => {
  assert.match(stylesHtml, /#preview-area\s*{[\s\S]*overflow:\s*hidden;/);
  assert.match(stylesHtml, /#preview-scroll\s*{[\s\S]*overflow:\s*auto;/);
  assert.match(stylesHtml, /#preview-container\s*{[\s\S]*display:\s*none;[\s\S]*justify-content:\s*flex-start;/);
  assert.match(stylesHtml, /#preview-container\s*{[\s\S]*align-items:\s*center;/);
  assert.match(stylesHtml, /#preview-container\s*{[\s\S]*flex-direction:\s*column;/);
  assert.match(stylesHtml, /#preview-container\s*{[\s\S]*gap:\s*12px;/);
  assert.match(stylesHtml, /\.preview-page\s*{[\s\S]*scroll-margin:/);
  assert.match(stylesHtml, /#view-controls\s*{[\s\S]*right:\s*20px;[\s\S]*bottom:\s*20px;/);
  assert.match(stylesHtml, /#view-controls button\s*{[\s\S]*background:\s*color-mix\([\s\S]*transparent[\s\S]*\);/);
});

runTest('renderMainPreview keeps preview container as flex for continuous pages', () => {
  assert.match(scriptSource, /container\.style\.display = 'flex';/);
  assert.doesNotMatch(scriptSource, /preview-canvas/);
});

runTest('updateUI requests one main preview render in sidebar mode', () => {
  const context = loadContext();
  let renderCount = 0;

  context.renderTabBar = () => {};
  context.renderThumbnails = () => {};
  context.renderMainPreview = () => {
    renderCount += 1;
  };
  context.updateMenuStates = () => {};
  context.updateViewControlsState = () => {};
  context.applySidebarWidth = () => {};
  vm.runInContext("App.viewMode = 'sidebar';", context);
  vm.runInContext('updateUI();', context);

  assert.equal(renderCount, 1);
});
