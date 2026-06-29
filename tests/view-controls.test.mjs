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
  const children = [];
  const listeners = {};
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
    children,
    width: 0,
    height: 0,
    appendChild(child) {
      children.push(child);
      return child;
    },
    removeChild() {},
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
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
    click() {
      if (listeners.click) listeners.click({ stopPropagation() {} });
    },
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

runTest('GAS source files stay consolidated while allowing one optional plugin file', () => {
  const gasSourceFiles = fs.readdirSync(projectRoot)
    .filter(fileName => /\.(?:gs|html)$/i.test(fileName))
    .sort();

  assert.deepEqual(
    gasSourceFiles.filter(fileName => fileName !== 'Plugin.html'),
    ['Code.gs', 'PdfLib.html', 'index.html']
  );
  assert.ok(
    gasSourceFiles.every(fileName => ['Code.gs', 'PdfLib.html', 'Plugin.html', 'index.html'].includes(fileName)),
    'only core GAS files and optional Plugin.html should be present'
  );
});

runTest('index loads bundled PDF libraries and optional plugin dynamically from GAS asset URLs', () => {
  assert.doesNotMatch(indexHtml, /<script\s+src=["']https?:\/\/[^"']+/);
  assert.doesNotMatch(indexHtml, /unpkg\.com|cdnjs\.cloudflare\.com/);
  assert.match(indexHtml, /<head>[\s\S]*<script\s+src="<\?!=\s*getAssetUrl\('PdfLib'\)\s*\?>"><\/script>/);
  assert.match(indexHtml, /window\.__PDF_EDITOR_PLUGIN_STATUS__\s*=/);
  assert.match(indexHtml, /const\s+OPTIONAL_PLUGIN_URL\s*=\s*"<\?!=\s*getAssetUrl\('Plugin'\)\s*\?>";/);
  assert.match(indexHtml, /function\s+loadOptionalPlugin\s*\(\s*\)/);
  assert.match(indexHtml, /document\.head\.appendChild\(script\)/);
  assert.match(indexHtml, /window\.PDFEditorContext\s*=/);
  assert.match(indexHtml, /window\.PDFEditorPlugins\s*=/);
  assert.doesNotMatch(indexHtml, /<script\s+src="<\?!=\s*getAssetUrl\('Plugin'\)\s*\?>"><\/script>/);
  assert.doesNotMatch(indexHtml, /<\?!=\s*include\('(?:PdfJs|PdfJsWorker|Styles|Scripts)'\)\s*\?>/);
  assert.match(workerSource, /WorkerMessageHandler/);
});

runTest('core markup has only standard top menus without Plugin.html', () => {
  const menuIds = Array.from(indexHtml.matchAll(/<div class="menu-item" data-menu="([^"]+)">/g), match => match[1]);

  assert.deepEqual(menuIds, ['file', 'edit', 'view']);
  assert.doesNotMatch(indexHtml, /data-menu="(?:page-tools|insert-tools)"/);
  assert.doesNotMatch(indexHtml, /plugin-edit-layer|plugin-object|plugin-resize-handle/);
});

runTest('PDF dependency asset avoids nested script tags during GAS rendering', () => {
  assert.doesNotMatch(pdfLibHtml, /<\/?script\b/i);
  assert.doesNotMatch(pdfDependencySource, /<\/script/i);
  assert.match(codeSource, /const\s+REQUIRED_ASSETS\s*=\s*\[\s*'PdfLib'\s*\]/);
  assert.match(codeSource, /const\s+OPTIONAL_ASSETS\s*=\s*\[\s*'Plugin'\s*\]/);
  assert.match(codeSource, /function\s+serveAsset_\s*\(\s*assetName\s*\)/);
  assert.match(codeSource, /getRawContent_\(assetName\)/);
  assert.match(codeSource, /Optional plugin not installed/);
  assert.match(codeSource, /assetReturned\s*=\s*false/);
  assert.match(codeSource, /Required asset not found:/);
  assert.match(codeSource, /function\s+getAssetUrl\s*\(\s*assetName\s*\)/);
});

runTest('optional plugin diagnostics do not block standard initialization', () => {
  const context = loadContext({
    console: {
      error() {},
      log() {},
      warn() {},
    },
  });

  assert.equal(context.window.__PDF_EDITOR_PLUGIN_STATUS__.requested, false);
  assert.equal(context.window.__PDF_EDITOR_PLUGIN_STATUS__.loaded, false);
  assert.equal(context.window.__PDF_EDITOR_PLUGIN_STATUS__.registered, 0);
  assert.deepEqual(Array.from(context.window.__PDF_EDITOR_PLUGIN_STATUS__.pluginIds), []);
  assert.equal(context.window.__PDF_EDITOR_PLUGIN_STATUS__.error, null);
  assert.equal(typeof context.loadOptionalPlugin, 'function');
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
  assert.match(codeSource, /function\s+doGet\s*\(\s*e\s*\)\s*{[\s\S]*serveAsset_\(asset\)[\s\S]*HtmlService\.createTemplateFromFile\('index'\)/);
  assert.match(codeSource, /function\s+getRawContent_\s*\(\s*filename\s*\)\s*{[\s\S]*createTemplateFromFile\(filename\)\.getRawContent\(\)/);
});

runTest('plugin context exposes only supported extension hooks', () => {
  const context = loadContext();

  assert.equal(typeof context.window.PDFEditorContext, 'object');
  assert.equal(typeof context.window.PDFEditorContext.App.getActiveTab, 'function');
  assert.equal(context.window.PDFEditorContext.App.tabs.length, 0);
  assert.equal(context.window.PDFEditorContext.PDFLib, context.PDFLib);
  [
    'getActiveTab',
    'refreshTab',
    'refreshPdfJsCache',
    'updateUI',
    'showToast',
    'pushUndo',
    'addTopMenu',
    'addMenuItem',
    'addMenuSeparator',
    'openModal',
    'closeModal',
  ].forEach(name => {
    assert.equal(typeof context.window.PDFEditorContext[name], 'function', `${name} should be exposed`);
  });
});

runTest('plugin registration calls setup with editor context', () => {
  const context = loadContext();
  let setupContext = null;

  context.window.PDFEditorPlugins.register({
    id: 'test-plugin',
    setup(ctx) {
      setupContext = ctx;
    },
  });

  assert.equal(context.window.PDFEditorPlugins.plugins.length, 1);
  assert.equal(setupContext, context.window.PDFEditorContext);
});

runTest('addTopMenu creates one reusable top-level plugin menu', () => {
  const menuBar = createElementStub();
  const menus = [];
  const context = loadContext();

  context.document.querySelector = selector => {
    if (selector === '#menu-bar') return menuBar;
    if (selector === '.menu-item[data-menu="page-tools"]') {
      return menus.find(menu => menu.dataset.menu === 'page-tools') || null;
    }
    return null;
  };
  context.document.querySelectorAll = selector => {
    if (selector === '.menu-item') return menus;
    return [];
  };
  context.document.createElement = tagName => {
    const element = createElementStub();
    element.tagName = tagName.toUpperCase();
    element.querySelector = selector => {
      if (selector === '.menu-label') return element.children.find(child => child.className === 'menu-label') || null;
      if (selector === '.menu-dropdown') return element.children.find(child => child.className === 'menu-dropdown') || null;
      return null;
    };
    return element;
  };
  menuBar.appendChild = element => {
    menus.push(element);
    return element;
  };

  const first = context.addTopMenu('page-tools', 'ページ調整');
  const second = context.addTopMenu('page-tools', 'ページ調整');
  const button = context.addMenuItem('page-tools', { label: '右に90度回転', action() {} });

  assert.equal(first, second);
  assert.equal(menus.length, 1);
  assert.equal(first.dataset.menu, 'page-tools');
  assert.equal(first.children[0].className, 'menu-label');
  assert.equal(first.children[0].textContent, 'ページ調整');
  assert.equal(first.children[1].className, 'menu-dropdown');
  assert.equal(button.textContent, '右に90度回転');
});

runTest('addMenuItem safely appends plugin menu actions and ignores missing menus', () => {
  const editDropdown = createElementStub();
  const editMenu = {
    querySelector(selector) {
      return selector === '.menu-dropdown' ? editDropdown : null;
    },
  };
  const createdButtons = [];
  const createdSeparators = [];
  let clickedHandler = null;
  let actionCount = 0;

  const context = loadContext();
  context.document.querySelector = selector => {
    if (selector === '.menu-item[data-menu="edit"]') return editMenu;
    return null;
  };
  context.document.querySelectorAll = () => [];
  context.document.createElement = tagName => {
    const element = createElementStub();
    element.tagName = tagName.toUpperCase();
    if (tagName === 'button') {
      element.appendChild = child => {
        element.appendedChild = child;
      };
      element.addEventListener = (type, handler) => {
        if (type === 'click') clickedHandler = handler;
      };
      createdButtons.push(element);
    }
    if (tagName === 'div') createdSeparators.push(element);
    return element;
  };
  editDropdown.appendChild = element => {
    editDropdown.lastChild = element;
  };

  assert.equal(context.addMenuItem('missing', { label: 'Missing', action() {} }), null);
  const button = context.addMenuItem('edit', {
    label: 'Plugin Action',
    shortcut: 'Ctrl+Alt+P',
    action: async () => {
      actionCount += 1;
    },
  });
  const separator = context.addMenuSeparator('edit');

  assert.equal(button, createdButtons[0]);
  assert.equal(button.textContent, 'Plugin Action');
  assert.equal(button.appendedChild.className, 'shortcut');
  assert.equal(button.appendedChild.textContent, 'Ctrl+Alt+P');
  assert.equal(separator, createdSeparators[0]);
  assert.equal(separator.className, 'menu-separator');

  clickedHandler({
    stopPropagation() {},
  });
  assert.equal(actionCount, 1);
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

runTest('getCanvasOutputScale reflects DPR and clamps unsafe values', () => {
  const context = loadContext();

  assert.equal(typeof context.getCanvasOutputScale, 'function');

  context.window.devicePixelRatio = 1.75;
  assert.equal(context.getCanvasOutputScale(), 1.75);

  context.window.devicePixelRatio = 3;
  assert.equal(context.getCanvasOutputScale({ maxScale: 2 }), 2);

  context.window.devicePixelRatio = 0;
  assert.equal(context.getCanvasOutputScale(), 1);
});

runTest('prepareHiDpiCanvas separates backing pixels from CSS size', () => {
  const context = loadContext();
  const canvas = createElementStub();

  context.window.devicePixelRatio = 2;
  const setup = context.prepareHiDpiCanvas(canvas, { width: 612.4, height: 792.8 }, { maxScale: 2 });

  assert.equal(setup.outputScale, 2);
  assert.deepEqual(Array.from(setup.transform), [2, 0, 0, 2, 0, 0]);
  assert.equal(canvas.width, 1224);
  assert.equal(canvas.height, 1585);
  assert.equal(canvas.style.width, '612px');
  assert.equal(canvas.style.height, 'auto');
  assert.equal(canvas.style.aspectRatio, '612.4 / 792.8');
});

runTest('prepareHiDpiCanvas leaves CSS height flexible so constrained width keeps aspect ratio', () => {
  const context = loadContext();
  const canvas = createElementStub();

  context.window.devicePixelRatio = 2;
  context.prepareHiDpiCanvas(canvas, { width: 612.4, height: 792.8 }, { maxScale: 2 });

  assert.equal(canvas.style.width, '612px');
  assert.equal(canvas.style.height, 'auto');
  assert.equal(canvas.style.aspectRatio, '612.4 / 792.8');
});

runTest('prepareHiDpiCanvas lowers output scale when max pixels would be exceeded', () => {
  const context = loadContext();
  const canvas = createElementStub();

  context.window.devicePixelRatio = 2;
  const setup = context.prepareHiDpiCanvas(canvas, { width: 4000, height: 4000 }, {
    maxScale: 2,
    maxPixels: 16000000,
  });

  assert.equal(setup.outputScale, 1);
  assert.equal(setup.transform, null);
  assert.equal(canvas.width, 4000);
  assert.equal(canvas.height, 4000);
  assert.equal(canvas.style.width, '4000px');
  assert.equal(canvas.style.height, 'auto');
  assert.equal(canvas.style.aspectRatio, '4000 / 4000');
});

runTest('prepareHiDpiCanvas keeps backing pixels within max pixels for huge viewports', () => {
  const context = loadContext();
  const canvas = createElementStub();
  const maxPixels = 16000000;

  context.window.devicePixelRatio = 2;
  const setup = context.prepareHiDpiCanvas(canvas, { width: 8000, height: 4000 }, {
    maxScale: 2,
    maxPixels,
  });

  assert.ok(setup.outputScale < 1);
  assert.ok(canvas.width * canvas.height <= maxPixels);
  assert.equal(canvas.style.width, '8000px');
  assert.equal(canvas.style.height, 'auto');
  assert.equal(canvas.style.aspectRatio, '8000 / 4000');
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

runTest('Ctrl+V in text inputs is left to the browser paste action', () => {
  const context = loadContext();
  let pasteCount = 0;
  let prevented = false;

  context.pastePages = () => {
    pasteCount += 1;
  };
  vm.runInContext('initKeyboardShortcuts();', context);

  getDocumentListener(context, 'keydown')({
    key: 'v',
    code: 'KeyV',
    target: { tagName: 'INPUT', type: 'text' },
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, false);
  assert.equal(pasteCount, 0);
});

runTest('Ctrl+V and Cmd+V in the QR text input are left to the browser paste action', () => {
  const context = loadContext();
  let pasteCount = 0;
  let preventCount = 0;

  context.pastePages = () => {
    pasteCount += 1;
  };
  vm.runInContext('initKeyboardShortcuts();', context);

  const handler = getDocumentListener(context, 'keydown');
  [
    { ctrlKey: true, metaKey: false },
    { ctrlKey: false, metaKey: true },
  ].forEach(modifiers => {
    handler({
      key: 'v',
      code: 'KeyV',
      target: { id: 'insert-qr-text', tagName: 'INPUT', type: 'text' },
      ctrlKey: modifiers.ctrlKey,
      metaKey: modifiers.metaKey,
      altKey: false,
      shiftKey: false,
      preventDefault() {
        preventCount += 1;
      },
    });
  });

  assert.equal(preventCount, 0);
  assert.equal(pasteCount, 0);
});

runTest('Ctrl+V outside editable fields still triggers page paste', () => {
  const context = loadContext();
  let pasteCount = 0;
  let prevented = false;

  context.pastePages = () => {
    pasteCount += 1;
  };
  vm.runInContext('initKeyboardShortcuts();', context);

  getDocumentListener(context, 'keydown')({
    key: 'v',
    code: 'KeyV',
    target: { tagName: 'DIV' },
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.equal(pasteCount, 1);
});

runTest('Cmd+V outside editable fields still triggers page paste', () => {
  const context = loadContext();
  let pasteCount = 0;
  let prevented = false;

  context.pastePages = () => {
    pasteCount += 1;
  };
  vm.runInContext('initKeyboardShortcuts();', context);

  getDocumentListener(context, 'keydown')({
    key: 'v',
    code: 'KeyV',
    target: { tagName: 'BODY' },
    ctrlKey: false,
    metaKey: true,
    altKey: false,
    shiftKey: false,
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.equal(pasteCount, 1);
});

runTest('text inputs keep standard Ctrl+A/C/X/Z/Y text editing shortcuts', () => {
  const context = loadContext();
  const callCounts = {
    copy: 0,
    cut: 0,
    undo: 0,
  };
  let preventCount = 0;

  context.copyPages = () => {
    callCounts.copy += 1;
  };
  context.cutPages = () => {
    callCounts.cut += 1;
  };
  context.performUndo = () => {
    callCounts.undo += 1;
  };

  vm.runInContext(`
    App.tabs = [{
      id: 'tab-1',
      pageCount: 3,
      selectedPages: [1],
      lastSelectedPage: 1,
      undoStack: [],
      redoStack: []
    }];
    App.activeTabId = 'tab-1';
    initKeyboardShortcuts();
  `, context);

  const handler = getDocumentListener(context, 'keydown');
  ['a', 'c', 'x', 'z', 'y'].forEach(key => {
    handler({
      key,
      code: `Key${key.toUpperCase()}`,
      target: { tagName: 'INPUT', type: 'text' },
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault() {
        preventCount += 1;
      },
    });
  });

  assert.equal(preventCount, 0);
  assert.deepEqual(callCounts, { copy: 0, cut: 0, undo: 0 });
  assert.deepEqual(Array.from(vm.runInContext('App.getActiveTab().selectedPages', context)), [1]);
});

runTest('non-text inputs do not suppress page paste shortcuts', () => {
  const context = loadContext();
  let pasteCount = 0;
  let preventCount = 0;

  context.pastePages = () => {
    pasteCount += 1;
  };
  vm.runInContext('initKeyboardShortcuts();', context);

  const handler = getDocumentListener(context, 'keydown');
  ['checkbox', 'file'].forEach(type => {
    handler({
      key: 'v',
      code: 'KeyV',
      target: { tagName: 'INPUT', type },
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault() {
        preventCount += 1;
      },
    });
  });

  assert.equal(preventCount, 2);
  assert.equal(pasteCount, 2);
});

runTest('help modal documents continuous view and grid keyboard navigation', () => {
  assert.match(indexHtml, /<h2>キーボードショートカット<\/h2>/);
  assert.match(indexHtml, /<kbd>&uarr;<\/kbd>\s*\/\s*<kbd>&darr;<\/kbd><span>通常表示でプレビューをスクロール<\/span>/);
  assert.match(indexHtml, /<kbd>&larr;<\/kbd>\s*\/\s*<kbd>&rarr;<\/kbd><span>通常表示で前\/次のページ<\/span>/);
  assert.match(indexHtml, /<kbd>&uarr;<\/kbd>\s*\/\s*<kbd>&darr;<\/kbd>\s*\/\s*<kbd>&larr;<\/kbd>\s*\/\s*<kbd>&rarr;<\/kbd><span>グリッド表示で選択ページを移動<\/span>/);
  assert.match(indexHtml, /<kbd>Enter<\/kbd><span>グリッド表示から通常表示へ戻る<\/span>/);
  assert.match(indexHtml, /入力欄にフォーカスがある場合、コピー・貼り付け・全選択・Undoなどのテキスト編集ショートカットが優先されます。/);
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
  assert.match(stylesHtml, /\.preview-page\s*{[\s\S]*width:\s*max-content;[\s\S]*max-width:\s*none;[\s\S]*margin:\s*0 auto;[\s\S]*scroll-margin:/);
  assert.match(stylesHtml, /\.preview-page canvas\s*{[\s\S]*max-width:\s*none;[\s\S]*height:\s*auto;/);
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
