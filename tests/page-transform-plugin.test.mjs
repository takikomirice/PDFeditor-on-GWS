import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const projectRoot = process.cwd();
const pluginPath = path.join(projectRoot, 'Plugin.html');
const pdfLibPath = path.join(projectRoot, 'PdfLib.html');

async function runTest(name, fn) {
  try {
    await fn();
    console.log('PASS', name);
  } catch (error) {
    console.error('FAIL', name);
    throw error;
  }
}

function createElementStub(tagName = 'div') {
  const children = [];
  const listeners = {};
  const classNames = new Set();
  const rect = { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
  const element = {
    tagName: tagName.toUpperCase(),
    id: '',
    className: '',
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false,
    style: {},
    dataset: {},
    children,
    appendChild(child) {
      child.parentNode = this;
      children.push(child);
      return child;
    },
    append(child) {
      child.parentNode = this;
      children.push(child);
      return child;
    },
    insertBefore(child, beforeChild) {
      child.parentNode = this;
      const index = children.indexOf(beforeChild);
      if (index < 0) {
        children.push(child);
      } else {
        children.splice(index, 0, child);
      }
      return child;
    },
    removeChild(child) {
      const index = children.indexOf(child);
      if (index >= 0) children.splice(index, 1);
      child.parentNode = null;
      return child;
    },
    remove() {
      if (this.parentNode && typeof this.parentNode.removeChild === 'function') {
        this.parentNode.removeChild(this);
      }
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    dispatchEvent(type, event) {
      const nextEvent = event || {};
      const previousStopPropagation = nextEvent.stopPropagation;
      if (!nextEvent.target) nextEvent.target = this;
      nextEvent.currentTarget = this;
      nextEvent.stopPropagation = () => {
        nextEvent.cancelBubble = true;
        if (typeof previousStopPropagation === 'function') {
          previousStopPropagation.call(nextEvent);
        }
      };
      const result = listeners[type] ? listeners[type](nextEvent) : undefined;
      if (!nextEvent.cancelBubble && this.parentNode && typeof this.parentNode.dispatchEvent === 'function') {
        const bubbleResult = this.parentNode.dispatchEvent(type, nextEvent);
        return result === undefined ? bubbleResult : result;
      }
      return result;
    },
    querySelector(selector) {
      return findFirstChild(this, selector);
    },
    querySelectorAll(selector) {
      return findAllChildren(this, selector);
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    getAttribute(name) {
      return this[name] || null;
    },
    getBoundingClientRect() {
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.right || rect.left + rect.width,
        bottom: rect.bottom || rect.top + rect.height,
      };
    },
    setBoundingClientRect(nextRect) {
      Object.assign(rect, nextRect);
      rect.right = nextRect.right ?? rect.left + rect.width;
      rect.bottom = nextRect.bottom ?? rect.top + rect.height;
    },
    click() {
      return this.dispatchEvent('click', {});
    },
    classList: {
      add(name) {
        String(element.className || '').split(/\s+/).filter(Boolean).forEach(item => classNames.add(item));
        classNames.add(name);
        element.className = Array.from(classNames).join(' ');
      },
      remove(name) {
        String(element.className || '').split(/\s+/).filter(Boolean).forEach(item => classNames.add(item));
        classNames.delete(name);
        element.className = Array.from(classNames).join(' ');
      },
      contains(name) {
        return String(element.className || '').split(/\s+/).includes(name) || classNames.has(name);
      },
    },
  };
  return element;
}

function matchesSelector(element, selector) {
  if (!element) return false;
  if (selector === 'canvas') return element.tagName === 'CANVAS';
  const classDataMatch = selector.match(/^\.([a-z0-9_-]+)\[data-page-index(?:="(\d+)")?\]$/i);
  if (classDataMatch) {
    const hasClass = String(element.className || '').split(/\s+/).includes(classDataMatch[1]);
    const hasPageIndex = element.dataset && element.dataset.pageIndex !== undefined;
    return hasClass && hasPageIndex && (classDataMatch[2] === undefined || element.dataset.pageIndex === classDataMatch[2]);
  }
  if (selector.startsWith('.')) return String(element.className || '').split(/\s+/).includes(selector.slice(1));
  if (selector.startsWith('#')) return element.id === selector.slice(1);
  return element.tagName === selector.toUpperCase();
}

function findFirstChild(root, selector) {
  return findAllChildren(root, selector)[0] || null;
}

function findAllChildren(root, selector) {
  const results = [];
  const visit = element => {
    (element.children || []).forEach(child => {
      if (matchesSelector(child, selector)) results.push(child);
      visit(child);
    });
  };
  visit(root);
  return results;
}

function loadPlugin() {
  assert.ok(fs.existsSync(pluginPath), 'Plugin.html should exist');
  const pluginSource = fs.readFileSync(pluginPath, 'utf8');
  assert.doesNotMatch(pluginSource, /<\/?script\b/i);
  assert.doesNotMatch(pluginSource, /https?:\/\/|google\.script\.run|unpkg\.com|cdnjs\.cloudflare\.com/);

  const body = createElementStub('body');
  const elementsById = new Map();
  const documentStub = {
    body,
    createElement(tagName) {
      return createElementStub(tagName);
    },
    getElementById(id) {
      return elementsById.get(id) || null;
    },
    querySelector() {
      return null;
    },
  };
  body.appendChild = child => {
    body.children.push(child);
    if (child.id) elementsById.set(child.id, child);
    return child;
  };

  const context = {
    console,
    document: documentStub,
    window: {
      __PDF_EDITOR_PLUGIN_STATUS__: {
        requested: true,
        loaded: false,
        registered: 0,
        pluginIds: [],
        error: null,
        assetUrl: 'mock-plugin-url',
      },
      PDFEditorPlugins: {
        plugins: [],
        register(plugin) {
          this.plugins.push(plugin);
        },
      },
    },
    Number,
    Math,
    Array,
    ArrayBuffer,
    Promise,
    TextEncoder,
    Uint8Array,
    setTimeout,
    clearTimeout,
  };
  context.globalThis = context;
  context.window.window = context.window;
  context.window.document = documentStub;
  vm.createContext(context);
  vm.runInContext(pluginSource, context, { filename: 'Plugin.html' });

  assert.ok(context.window.PDFEditorPlugins.plugins.length >= 1);
  assert.equal(context.window.__PDF_EDITOR_PLUGIN_STATUS__.assetReturned, true);
  assert.equal(context.window.__PDF_EDITOR_PLUGIN_STATUS__.loaded, true);
  assert.equal(context.window.__PDF_EDITOR_PLUGIN_STATUS__.registered, 4);
  assert.deepEqual(
    context.window.__PDF_EDITOR_PLUGIN_STATUS__.pluginIds,
    ['page-transform', 'insert-tools', 'stamp-tools', 'form-flatten']
  );
  return {
    plugin: context.window.PDFEditorPlugins.plugins.find(plugin => plugin.id === 'page-transform'),
    plugins: context.window.PDFEditorPlugins.plugins,
    pluginSource,
    context,
    documentStub,
    body,
  };
}

function loadPluginWithoutRegistrationContext() {
  const pluginSource = fs.readFileSync(pluginPath, 'utf8');
  const context = {
    console: {
      warn() {},
      error() {},
      log() {},
    },
    window: {
      __PDF_EDITOR_PLUGIN_STATUS__: {},
    },
  };
  context.globalThis = context;
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(pluginSource, context, { filename: 'Plugin.html' });
  return context.window.__PDF_EDITOR_PLUGIN_STATUS__;
}

function loadPluginWithImmediateSetup() {
  const pluginSource = fs.readFileSync(pluginPath, 'utf8');
  const body = createElementStub('body');
  const elementsById = new Map();
  const documentStub = {
    body,
    head: createElementStub('head'),
    documentElement: createElementStub('html'),
    createElement(tagName) {
      return createElementStub(tagName);
    },
    getElementById(id) {
      return elementsById.get(id) || null;
    },
    querySelector() {
      return null;
    },
    addEventListener() {},
  };
  body.appendChild = child => {
    body.children.push(child);
    child.parentNode = body;
    if (child.id) elementsById.set(child.id, child);
    return child;
  };
  documentStub.head.appendChild = child => {
    documentStub.head.children.push(child);
    child.parentNode = documentStub.head;
    if (child.id) elementsById.set(child.id, child);
    return child;
  };
  const tab = createTab([createPage()]);
  const harness = createPluginContext(tab);
  const setupErrors = [];

  const context = {
    console: {
      error() {},
      warn() {},
      log() {},
    },
    document: documentStub,
    window: {
      __PDF_EDITOR_PLUGIN_STATUS__: {
        requested: true,
        loaded: false,
        registered: 0,
        pluginIds: [],
        error: null,
        assetUrl: 'mock-plugin-url',
      },
      PDFEditorContext: harness.ctx,
      PDFEditorPlugins: {
        plugins: [],
        register(plugin) {
          this.plugins.push(plugin);
          context.window.__PDF_EDITOR_PLUGIN_STATUS__.registered = this.plugins.length;
          context.window.__PDF_EDITOR_PLUGIN_STATUS__.pluginIds = this.plugins.map(item => item.id);
          if (typeof plugin.setup === 'function') {
            try {
              plugin.setup(harness.ctx);
            } catch (err) {
              const message = err && err.message ? err.message : String(err);
              setupErrors.push({ pluginId: plugin.id, message });
              context.window.__PDF_EDITOR_PLUGIN_STATUS__.error = message;
              harness.ctx.showToast('拡張機能の読み込みに失敗しました。', 'error');
            }
          }
        },
      },
    },
    Number,
    Math,
    Array,
    ArrayBuffer,
    Promise,
    TextEncoder,
    Uint8Array,
    setTimeout,
    clearTimeout,
  };
  context.globalThis = context;
  context.window.window = context.window;
  context.window.document = documentStub;
  context.window.globalThis = context;
  vm.createContext(context);
  vm.runInContext(pluginSource, context, { filename: 'Plugin.html' });

  return {
    context,
    harness,
    setupErrors,
  };
}

function loadBundledPdfLib() {
  const pdfDependencySource = fs.readFileSync(pdfLibPath, 'utf8').trim();
  const context = {
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
  context.globalThis = context;
  context.window = context;
  context.self = context;
  vm.createContext(context);
  vm.runInContext(pdfDependencySource, context, { filename: 'PdfLib.html' });
  assert.ok(context.PDFLib, 'bundled PDFLib should evaluate in the test VM');
  return context.PDFLib;
}

function createPluginContext(tab) {
  const menuItems = [];
  const separators = [];
  const topMenus = [];
  const topMenuIds = new Set();
  const toasts = [];
  const undoDescriptors = [];
  let refreshCount = 0;

  return {
    ctx: {
      PDFLib: {
        StandardFonts: {
          Helvetica: 'Helvetica',
        },
        degrees(angle) {
          return { angle };
        },
        rgb(red, green, blue) {
          return { red, green, blue };
        },
      },
      getActiveTab() {
        return tab;
      },
      addMenuSeparator(menuId) {
        separators.push(menuId);
      },
      addMenuItem(menuId, item) {
        menuItems.push({ menuId, item });
        return item;
      },
      addTopMenu(menuId, label, options) {
        if (!topMenuIds.has(menuId)) {
          topMenuIds.add(menuId);
          topMenus.push({ menuId, label, options });
        }
        return { dataset: { menu: menuId }, label };
      },
      showToast(message, type) {
        toasts.push({ message, type });
      },
      pushUndo(targetTab, descriptor) {
        assert.equal(targetTab, tab);
        undoDescriptors.push(descriptor);
      },
      async refreshTab(targetTab) {
        assert.equal(targetTab, tab);
        refreshCount += 1;
      },
      openModal(modal) {
        modal.style.display = 'flex';
      },
      closeModal(modal) {
        modal.style.display = 'none';
      },
    },
    menuItems,
    separators,
    topMenus,
    toasts,
    undoDescriptors,
    get refreshCount() {
      return refreshCount;
    },
  };
}

function createPage(width = 200, height = 300, rotation = 0) {
  const calls = [];
  return {
    calls,
    getSize() {
      return { width, height };
    },
    getRotation() {
      return { angle: rotation };
    },
    setRotation(degrees) {
      rotation = degrees.angle;
      calls.push(['setRotation', degrees.angle]);
    },
    setCropBox(x, y, cropWidth, cropHeight) {
      calls.push(['setCropBox', x, y, cropWidth, cropHeight]);
    },
    setSize(nextWidth, nextHeight) {
      width = nextWidth;
      height = nextHeight;
      calls.push(['setSize', nextWidth, nextHeight]);
    },
    translateContent(x, y) {
      calls.push(['translateContent', x, y]);
    },
    scaleContent(x, y) {
      calls.push(['scaleContent', x, y]);
    },
    drawLine(options) {
      calls.push(['drawLine', options]);
    },
    drawCircle(options) {
      calls.push(['drawCircle', options]);
    },
    drawRectangle(options) {
      calls.push(['drawRectangle', options]);
    },
    drawEllipse(options) {
      calls.push(['drawEllipse', options]);
    },
    drawImage(image, options) {
      calls.push(['drawImage', image, options]);
    },
    drawText(text, options) {
      calls.push(['drawText', text, options]);
    },
  };
}

function createTab(pages) {
  const beforeBytes = new Uint8Array([1, 2, 3]);
  const afterBytes = new Uint8Array([9, 8, 7]);
  return {
    id: 'tab-1',
    pdfBytes: beforeBytes,
    selectedPages: pages.map((_, index) => index),
    pageCount: pages.length,
    undoStack: [],
    redoStack: [],
    pdfDoc: {
      getPage(index) {
        return pages[index];
      },
      async embedPng(bytes) {
        return { type: 'png', bytes };
      },
      async embedJpg(bytes) {
        return { type: 'jpg', bytes };
      },
      async embedFont(fontName) {
        return {
          name: fontName,
          widthOfTextAtSize(text, size) {
            return text.length * size * 0.5;
          },
        };
      },
      getPageCount() {
        return pages.length;
      },
      async save() {
        return afterBytes;
      },
    },
  };
}

function getPlugin(plugins, id) {
  const plugin = plugins.find(item => item.id === id);
  assert.ok(plugin, `${id} plugin should be registered`);
  return plugin;
}

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 0.0001, `${message}: expected ${expected}, got ${actual}`);
}

function getModalMarkup(body, modalId) {
  const modal = body.children.find(child => child.id === modalId);
  assert.ok(modal, `${modalId} should be created`);
  return modal.innerHTML;
}

function getFunctionSource(source, functionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `${functionName} should have a body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${functionName} source should be parseable`);
}

function createPreviewPageStub({ pageIndex = 0, canvasRect = { left: 10, top: 20, width: 400, height: 600 } } = {}) {
  const pageElement = createElementStub('div');
  pageElement.className = 'preview-page';
  pageElement.dataset.pageIndex = String(pageIndex);
  const canvas = createElementStub('canvas');
  canvas.setBoundingClientRect(canvasRect);
  const label = createElementStub('div');
  label.className = 'preview-page-label';
  pageElement.appendChild(canvas);
  pageElement.appendChild(label);
  return { pageElement, canvas, label };
}

await runTest('page transform plugin registers menus and modal copy from Plugin.html only', () => {
  const { plugin, body } = loadPlugin();
  const harness = createPluginContext(createTab([createPage()]));

  plugin.setup(harness.ctx);

  assert.equal(plugin.id, 'page-transform');
  assert.equal(plugin.name, 'ページ調整');
  assert.deepEqual(harness.topMenus.map(entry => [entry.menuId, entry.label]), [['page-tools', 'ページ調整']]);
  assert.deepEqual(harness.separators, []);
  assert.deepEqual(
    harness.menuItems.map(entry => entry.item.label),
    ['右に90度回転', '左に90度回転', '180度回転', 'トリミング/余白調整', '余白追加/内容縮小', 'ページサイズ変更']
  );
  assert.deepEqual(harness.menuItems.map(entry => entry.menuId), Array(6).fill('page-tools'));
  assert.match(
    body.children.map(child => child.innerHTML).join('\n'),
    /このトリミングは表示範囲の変更です。PDF内部の情報削除や墨消しではありません。/
  );
});

await runTest('insert, stamp, and form plugins register menus and modals from Plugin.html only', () => {
  const { plugins, body, pluginSource } = loadPlugin();
  const tab = createTab([createPage()]);
  const harness = createPluginContext(tab);

  getPlugin(plugins, 'insert-tools').setup(harness.ctx);
  getPlugin(plugins, 'stamp-tools').setup(harness.ctx);
  getPlugin(plugins, 'form-flatten').setup(harness.ctx);

  assert.deepEqual(
    plugins.map(plugin => plugin.id),
    ['page-transform', 'insert-tools', 'stamp-tools', 'form-flatten']
  );
  assert.deepEqual(harness.topMenus.map(entry => [entry.menuId, entry.label]), [['insert-tools', '挿入']]);
  assert.deepEqual(harness.separators, []);
  assert.deepEqual(
    harness.menuItems.filter(entry => entry.menuId === 'insert-tools').map(entry => entry.item.label),
    ['画像を挿入', 'QRコードを挿入', '図形・直線を挿入', 'ページ番号を挿入', '日付を挿入', '透かしスタンプ']
  );
  assert.deepEqual(
    harness.menuItems.filter(entry => entry.menuId === 'edit').map(entry => entry.item.label),
    ['フォームを固定']
  );
  const modalMarkup = body.children.map(child => child.innerHTML).join('\n');
  assert.match(modalMarkup, /PNG\/JPEG画像/);
  assert.match(modalMarkup, /URLまたは文字列/);
  assert.doesNotMatch(modalMarkup, /PNG\/JPEGのQR画像/);
  assert.doesNotMatch(modalMarkup, /insert-image-x|insert-image-y|insert-qr-x|insert-qr-y|fixed-stamp-x|fixed-stamp-y/);
  assert.doesNotMatch(modalMarkup, /x座標 mm（左下原点）|y座標 mm（左下原点）/);
  assert.match(modalMarkup, /画像はページ中央に仮配置されます。PDF上でドラッグ移動・リサイズしてから「適用」を押してください。/);
  assert.match(modalMarkup, /QRコードはブラウザ内で生成し、ページ中央に仮配置されます。PDF上でドラッグ移動・リサイズしてから「適用」を押してください。外部サービスは使用しません。/);
  assert.match(modalMarkup, /日付スタンプは指定したページの選択位置に固定配置します。/);
  assert.match(modalMarkup, /入力欄を編集できない通常のPDF表示に固定します。元に戻すにはUndoを使ってください。/);

  const imageModal = getModalMarkup(body, 'insert-tools-image-modal');
  assert.doesNotMatch(imageModal, /insert-image-x|insert-image-y/);
  assert.match(imageModal, /insert-image-width/);
  assert.match(imageModal, /insert-image-height/);
  assert.match(imageModal, /初期幅 mm/);
  assert.match(imageModal, /初期高さ mm/);
  assert.doesNotMatch(imageModal, /insert-image-target|選択ページすべて|配置先ページ|選択中の先頭ページ|現在の選択ページ/);

  const fixedStampModal = getModalMarkup(body, 'stamp-tools-fixed-modal');
  assert.doesNotMatch(fixedStampModal, /fixed-stamp-preset|fixed-stamp-width|fixed-stamp-height|fixed-stamp-opacity|fixed-stamp-rotate/);
  assert.match(fixedStampModal, /透かしスタンプ/);
  assert.doesNotMatch(fixedStampModal, /確認用スタンプ|DRAFT/);
  assert.match(fixedStampModal, /SAMPLE/);
  assert.match(fixedStampModal, /取扱注意/);
  assert.match(fixedStampModal, /確認用/);
  assert.match(fixedStampModal, /社外秘/);
  assert.match(fixedStampModal, /カスタム/);
  assert.match(fixedStampModal, /id="fixed-stamp-custom-field"[^>]*display:\s*none/);
  assert.match(fixedStampModal, /色/);
  assert.doesNotMatch(fixedStampModal, /最初のページ|このページ/);
  assert.match(fixedStampModal, /全ページ/);
  assert.match(fixedStampModal, /指定したページ/);
  assert.match(fixedStampModal, /id="fixed-stamp-pages-field"[^>]*display:\s*none/);
  assert.match(fixedStampModal, /例: 1,3-5/);

  const shapeModal = getModalMarkup(body, 'insert-tools-shape-modal');
  assert.match(shapeModal, /図形・直線を挿入/);
  assert.doesNotMatch(shapeModal, /insert-shape-target|対象ページ|選択ページすべて|現在選択中のページ/);
  assert.match(shapeModal, /種類/);
  assert.match(shapeModal, /線/);

  const qrModal = getModalMarkup(body, 'insert-tools-qr-modal');
  assert.doesNotMatch(qrModal, /insert-qr-x|insert-qr-y|x座標|y座標/);
  assert.doesNotMatch(qrModal, /insert-qr-target|配置先ページ|選択中の先頭ページ|現在の選択ページ|選択ページすべて/);

  const dateModal = getModalMarkup(body, 'stamp-tools-date-modal');
  assert.doesNotMatch(dateModal, /date-stamp-x|date-stamp-y|x座標|y座標|選択ページすべて|配置先ページ|選択中の先頭ページ|現在の選択ページ/);
  assert.match(dateModal, /全ページ/);
  assert.match(dateModal, /選択ページ/);
  assert.match(dateModal, /id="date-stamp-pages-field"[^>]*display:\s*none/);
  assert.match(dateModal, /例: 1,3-5/);
  assert.match(dateModal, /下中央/);
  assert.match(dateModal, /上右/);

  const pageNumberModal = getModalMarkup(body, 'stamp-tools-page-number-modal');
  assert.match(pageNumberModal, /全ページ/);
  assert.match(pageNumberModal, /選択ページ/);
  assert.match(pageNumberModal, /id="page-number-pages-field"[^>]*display:\s*none/);
  assert.match(pageNumberModal, /例: 1,3-5/);

  [
    'applyImageFromModal',
    'applyQrFromModal',
  ].forEach(functionName => {
    const functionSource = getFunctionSource(pluginSource, functionName);
    assert.match(functionSource, /centeredTemporaryRect/);
    assert.doesNotMatch(functionSource, /readNumber\([^)]*-(?:x|y)['"]\)/);
  });

  const imageSource = getFunctionSource(pluginSource, 'applyImageFromModal');
  assert.match(imageSource, /getTargetPageIndices\(tab, 'selected'\)/);
  assert.doesNotMatch(imageSource, /insert-image-target|resolveModalTargetPage/);

  const shapeSource = getFunctionSource(pluginSource, 'applyShapeFromModal');
  assert.match(shapeSource, /getTargetPageIndices\(tab, 'selected'\)/);
  assert.doesNotMatch(shapeSource, /insert-shape-target|resolveModalTargetPage/);

  const qrSource = getFunctionSource(pluginSource, 'applyQrFromModal');
  assert.match(qrSource, /getTargetPageIndices\(tab, 'selected'\)/);
  assert.doesNotMatch(qrSource, /insert-qr-target|resolveModalTargetPage/);

  const fixedStampSource = getFunctionSource(pluginSource, 'applyFixedStampFromModal');
  assert.match(fixedStampSource, /applyFixedStamp/);
  assert.doesNotMatch(fixedStampSource, /centeredTemporaryRect|createTemporaryObject|readNumber\([^)]*-(?:width|height|opacity|rotate)['"]\)/);
  assert.match(getFunctionSource(pluginSource, 'installFixedStampModalToggles'), /selectedTarget\.value === 'pages'/);
  assert.match(getFunctionSource(pluginSource, 'installFixedStampModalToggles'), /selectedText\.value === 'custom'/);

  const pageNumberSource = getFunctionSource(pluginSource, 'applyPageNumbersFromModal');
  assert.match(pageNumberSource, /page-number-pages/);
  assert.match(pageNumberSource, /selectedTarget === 'selected'/);

  const dateStampSource = getFunctionSource(pluginSource, 'applyDateStampFromModal');
  assert.match(dateStampSource, /applyDateStamp/);
  assert.match(dateStampSource, /date-stamp-pages/);
  assert.match(dateStampSource, /date-stamp-position/);
  assert.match(dateStampSource, /date-stamp-margin/);
  assert.doesNotMatch(dateStampSource, /centeredTemporaryRect|createTemporaryObject|resolveModalTargetPage/);
});

await runTest('plugin records diagnostic error and returns safely when registration context is missing', () => {
  const status = loadPluginWithoutRegistrationContext();

  assert.equal(status.assetReturned, true);
  assert.equal(status.loaded, false);
  assert.equal(status.registered, 0);
  assert.deepEqual(Array.from(status.pluginIds), []);
  assert.equal(status.error, 'PDFEditorPlugins context is missing');
});

await runTest('plugin connects all bundled plugins when registration immediately runs setup', () => {
  const { context, harness, setupErrors } = loadPluginWithImmediateSetup();

  assert.deepEqual(setupErrors, []);
  assert.equal(context.window.__PDF_EDITOR_PLUGIN_STATUS__.loaded, true);
  assert.equal(context.window.__PDF_EDITOR_PLUGIN_STATUS__.error, null);
  assert.deepEqual(
    context.window.__PDF_EDITOR_PLUGIN_STATUS__.pluginIds,
    ['page-transform', 'insert-tools', 'stamp-tools', 'form-flatten']
  );
  assert.deepEqual(harness.toasts.filter(toast => toast.type === 'error'), []);
  assert.deepEqual(
    harness.topMenus.map(entry => [entry.menuId, entry.label]),
    [['page-tools', 'ページ調整'], ['insert-tools', '挿入']]
  );
});

await runTest('shape and image insertion draw on selected pages with snapshot undo', async () => {
  const { plugins } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);

  await plugin.applyShape(harness.ctx, {
    target: 'selected',
    shape: 'rectangle',
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    lineWidth: 2,
    color: '#336699',
    opacity: 0.5,
    fill: true,
  });

  assert.equal(page.calls[0][0], 'drawRectangle');
  assertClose(page.calls[0][1].x, 10 * 72 / 25.4, 'rectangle x');
  assertClose(page.calls[0][1].y, 20 * 72 / 25.4, 'rectangle y');
  assertClose(page.calls[0][1].width, 30 * 72 / 25.4, 'rectangle width');
  assertClose(page.calls[0][1].height, 40 * 72 / 25.4, 'rectangle height');
  assert.equal(page.calls[0][1].opacity, 0.5);
  assert.equal(harness.undoDescriptors[0].plugin, 'insert-tools');

  await plugin.applyImage(harness.ctx, {
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: 'image/png',
    x: 5,
    y: 6,
    width: 20,
    height: 10,
    keepAspect: false,
    opacity: 0.75,
  });

  const imageCall = page.calls.find(call => call[0] === 'drawImage');
  assert.equal(imageCall[1].type, 'png');
  assertClose(imageCall[2].x, 5 * 72 / 25.4, 'image x');
  assertClose(imageCall[2].y, 6 * 72 / 25.4, 'image y');
  assertClose(imageCall[2].width, 20 * 72 / 25.4, 'image width');
  assertClose(imageCall[2].height, 10 * 72 / 25.4, 'image height');
});

await runTest('direct line insertion can bake start and end markers', async () => {
  const { plugins } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);

  await plugin.applyShape(harness.ctx, {
    target: 'selected',
    shape: 'line',
    x: 10,
    y: 20,
    width: 30,
    height: 0,
    lineWidth: 4,
    color: '#336699',
    opacity: 0.5,
    startMarker: 'dot',
    endMarker: 'arrow',
  });

  const drawLineCalls = page.calls.filter(call => call[0] === 'drawLine');
  assert.equal(drawLineCalls.length, 3, 'main line plus arrow head should be drawn');
  assertClose(drawLineCalls[0][1].start.x, 10 * 72 / 25.4, 'direct line start x');
  assertClose(drawLineCalls[0][1].end.x, 40 * 72 / 25.4, 'direct line end x');
  const dotCall = page.calls.find(call => call[0] === 'drawCircle');
  assert.ok(dotCall, 'direct line start dot should be drawn');
  assertClose(dotCall[1].x, 10 * 72 / 25.4, 'direct line dot x');
  assertClose(dotCall[1].y, 20 * 72 / 25.4, 'direct line dot y');
  assert.equal(dotCall[1].size, 4);
  assert.ok(drawLineCalls.slice(1).every(call => call[1].end.x === drawLineCalls[0][1].end.x));
});

await runTest('edit layer mounts on preview pages and converts between screen and PDF coordinates', () => {
  const { plugins, documentStub } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);
  const previewContainer = createElementStub('div');
  previewContainer.id = 'preview-container';
  const { pageElement } = createPreviewPageStub();
  previewContainer.appendChild(pageElement);
  documentStub.querySelector = selector => selector === '#preview-container' ? previewContainer : null;

  plugin.setup(harness.ctx);
  plugin.setEditingMode(true);
  plugin.mountOrUpdateEditLayers();

  const layer = pageElement.querySelector('.plugin-edit-layer');
  assert.ok(layer, 'edit layer should be mounted on main preview page');
  assert.equal(layer.style.pointerEvents, 'auto');
  assert.equal(layer.style.width, '400px');
  assert.equal(layer.style.height, '600px');

  const pdfRect = plugin.screenRectToPdfRect(pageElement, { left: 110, top: 170, width: 100, height: 120 });
  assertClose(pdfRect.x, 50, 'screen to pdf x');
  assertClose(pdfRect.y, 165, 'screen to pdf y');
  assertClose(pdfRect.width, 50, 'screen to pdf width');
  assertClose(pdfRect.height, 60, 'screen to pdf height');

  const screenRect = plugin.pdfRectToScreenRect(pageElement, pdfRect);
  assertClose(screenRect.left, 110, 'pdf to screen left');
  assertClose(screenRect.top, 170, 'pdf to screen top');
  assertClose(screenRect.width, 100, 'pdf to screen width');
  assertClose(screenRect.height, 120, 'pdf to screen height');
});

await runTest('temporary objects can be created, moved, resized, cancelled, and applied with one undo snapshot', async () => {
  const { plugins, documentStub } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);
  const previewContainer = createElementStub('div');
  previewContainer.id = 'preview-container';
  const { pageElement } = createPreviewPageStub();
  previewContainer.appendChild(pageElement);
  documentStub.querySelector = selector => selector === '#preview-container' ? previewContainer : null;
  plugin.setup(harness.ctx);

  const imageObject = plugin.createTemporaryObject(harness.ctx, {
    type: 'image',
    pageIndex: 0,
    rect: { x: 20, y: 30, width: 40, height: 20 },
    data: { imageBytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png', filename: 'stamp.png' },
    options: { opacity: 0.8, keepAspect: false },
  });
  assert.equal(plugin.getTemporaryObjects().length, 1);

  plugin.moveTemporaryObject(imageObject.id, 15, -10);
  plugin.resizeTemporaryObject(imageObject.id, { width: 70, height: 30 });
  assert.deepEqual({ ...plugin.getTemporaryObjects()[0].rect }, { x: 35, y: 20, width: 70, height: 30 });

  plugin.cancelTemporaryObject(imageObject.id);
  assert.equal(plugin.getTemporaryObjects().length, 0);
  assert.deepEqual(page.calls, []);
  assert.equal(harness.undoDescriptors.length, 0);

  plugin.createTemporaryObject(harness.ctx, {
    type: 'image',
    pageIndex: 0,
    rect: { x: 10, y: 12, width: 30, height: 15 },
    data: { imageBytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png', filename: 'stamp.png' },
    options: { opacity: 0.6, keepAspect: false },
  });
  await plugin.applyTemporaryObjects(harness.ctx);

  const imageCall = page.calls.find(call => call[0] === 'drawImage');
  assert.ok(imageCall, 'temporary image should be baked into PDF');
  assertClose(imageCall[2].x, 10, 'temporary image x');
  assertClose(imageCall[2].y, 12, 'temporary image y');
  assertClose(imageCall[2].width, 30, 'temporary image width');
  assertClose(imageCall[2].height, 15, 'temporary image height');
  assert.equal(imageCall[2].opacity, 0.6);
  assert.equal(harness.undoDescriptors.length, 1);
  assert.equal(harness.undoDescriptors[0].plugin, 'plugin-edit-layer');
  assert.deepEqual([...harness.undoDescriptors[0].pdfBytesSnapshot], [1, 2, 3]);
  assert.deepEqual([...harness.undoDescriptors[0].pdfBytesAfter], [9, 8, 7]);
  assert.equal(harness.refreshCount, 1);
  assert.equal(plugin.getTemporaryObjects().length, 0);
});

await runTest('temporary QR and fixed stamp bake through local PNG/image paths', async () => {
  const { plugins, pluginSource } = loadPlugin();
  const insertPlugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);

  assert.doesNotMatch(pluginSource, /fetch\s*\(|XMLHttpRequest|google\.script\.run|https?:\/\//);

  insertPlugin.createTemporaryObject(harness.ctx, {
    type: 'qr',
    pageIndex: 0,
    rect: { x: 40, y: 50, width: 45, height: 45 },
    data: { text: 'school.example.jp/qr' },
    options: { opacity: 1, includeBackground: true },
  });
  insertPlugin.createTemporaryObject(harness.ctx, {
    type: 'stamp',
    pageIndex: 0,
    rect: { x: 70, y: 80, width: 90, height: 30 },
    data: { preset: '確認用' },
    options: { opacity: 0.35, rotate: -25, color: '#d32f2f' },
  });

  await insertPlugin.applyTemporaryObjects(harness.ctx);

  const drawImages = page.calls.filter(call => call[0] === 'drawImage');
  assert.equal(drawImages.length, 2);
  assert.equal(drawImages[0][1].type, 'png');
  assert.deepEqual([...drawImages[0][1].bytes.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(drawImages[1][1].type, 'png');
  assert.equal(harness.undoDescriptors.length, 1);
});

await runTest('temporary rectangle and ellipse objects keep vector properties and bake through pdf-lib APIs', async () => {
  const { plugins } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(240, 320);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);

  const rectObject = plugin.createTemporaryObject(harness.ctx, {
    type: 'rect',
    pageIndex: 0,
    rect: { x: 12, y: 14, width: 60, height: 40 },
    options: { strokeColor: '#d32f2f', fillColor: null, strokeWidth: 2, opacity: 0.5 },
  });
  assert.equal(rectObject.type, 'rect');
  assert.equal(rectObject.options.fillColor, null);

  plugin.updateTemporaryObjectOptions(rectObject.id, { fillColor: '#00ff00', strokeWidth: 3 });
  const resized = plugin.resizeTemporaryObject(rectObject.id, { x: 18, y: 20, width: 80, height: 50 });
  assert.deepEqual({ ...resized.rect }, { x: 18, y: 20, width: 80, height: 50 });
  assert.equal(resized.options.fillColor, '#00ff00');
  assert.equal(resized.options.strokeWidth, 3);

  const ellipseObject = plugin.createTemporaryObject(harness.ctx, {
    type: 'ellipse',
    pageIndex: 0,
    rect: { x: 100, y: 120, width: 70, height: 30 },
    options: { strokeColor: '#0000ff', fillColor: null, strokeWidth: 4, opacity: 0.75 },
  });
  assert.equal(ellipseObject.type, 'ellipse');

  await plugin.applyTemporaryObjects(harness.ctx);

  const rectCall = page.calls.find(call => call[0] === 'drawRectangle');
  assert.ok(rectCall, 'temporary rectangle should be baked with drawRectangle');
  assertClose(rectCall[1].x, 18, 'rectangle x');
  assertClose(rectCall[1].y, 20, 'rectangle y');
  assertClose(rectCall[1].width, 80, 'rectangle width');
  assertClose(rectCall[1].height, 50, 'rectangle height');
  assert.equal(rectCall[1].borderWidth, 3);
  assertClose(rectCall[1].borderOpacity, 0.5, 'rectangle border opacity');
  assertClose(rectCall[1].opacity, 0.5, 'rectangle fill opacity');
  assertClose(rectCall[1].color.green, 1, 'rectangle fill green');

  const ellipseCall = page.calls.find(call => call[0] === 'drawEllipse');
  assert.ok(ellipseCall, 'temporary ellipse should be baked with drawEllipse');
  assertClose(ellipseCall[1].x, 135, 'ellipse center x');
  assertClose(ellipseCall[1].y, 135, 'ellipse center y');
  assertClose(ellipseCall[1].xScale, 35, 'ellipse x scale');
  assertClose(ellipseCall[1].yScale, 15, 'ellipse y scale');
  assert.equal(ellipseCall[1].borderWidth, 4);
  assert.equal(ellipseCall[1].color, undefined);
  assert.equal(harness.undoDescriptors.length, 1);
  assert.equal(harness.undoDescriptors[0].plugin, 'plugin-edit-layer');
  assert.equal(harness.refreshCount, 1);
  assert.equal(plugin.getTemporaryObjects().length, 0);
});

await runTest('temporary line objects can move, edit endpoints, and bake through drawLine', async () => {
  const { plugins } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(240, 320);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);

  const defaultLineObject = plugin.createTemporaryObject(harness.ctx, {
    type: 'line',
    pageIndex: 0,
    width: 100,
  });
  assert.equal(defaultLineObject.line.y1, defaultLineObject.line.y2, 'default temporary line should be horizontal');
  plugin.cancelTemporaryObject(defaultLineObject.id);

  const lineObject = plugin.createTemporaryObject(harness.ctx, {
    type: 'line',
    pageIndex: 0,
    line: { x1: 20, y1: 30, x2: 80, y2: 60 },
    options: { strokeColor: '#0000ff', strokeWidth: 4, opacity: 0.7, startMarker: 'dot', endMarker: 'arrow' },
  });
  assert.equal(lineObject.type, 'line');
  assert.deepEqual({ ...lineObject.line }, { x1: 20, y1: 30, x2: 80, y2: 60 });

  const moved = plugin.moveTemporaryObject(lineObject.id, 10, -5);
  assert.deepEqual({ ...moved.line }, { x1: 30, y1: 25, x2: 90, y2: 55 });

  const endpointMoved = plugin.moveLineEndpoint(lineObject.id, 'end', 120, 80);
  assert.deepEqual({ ...endpointMoved.line }, { x1: 30, y1: 25, x2: 120, y2: 80 });

  const snapped = plugin.moveLineEndpoint(lineObject.id, 'end', 80, 130, { snap: true });
  assertClose(
    Math.abs(snapped.line.x2 - snapped.line.x1),
    Math.abs(snapped.line.y2 - snapped.line.y1),
    'snapped endpoint should land on a 45 degree line'
  );
  plugin.moveLineEndpoint(lineObject.id, 'end', 120, 80);

  plugin.updateTemporaryObjectOptions(lineObject.id, { strokeWidth: 6, opacity: 0.4 });
  await plugin.applyTemporaryObjects(harness.ctx);

  const lineCall = page.calls.find(call => call[0] === 'drawLine');
  assert.ok(lineCall, 'temporary line should be baked with drawLine');
  assert.deepEqual({ ...lineCall[1].start }, { x: 30, y: 25 });
  assert.deepEqual({ ...lineCall[1].end }, { x: 120, y: 80 });
  assert.equal(lineCall[1].thickness, 6);
  assertClose(lineCall[1].opacity, 0.4, 'line opacity');
  assertClose(lineCall[1].color.blue, 1, 'line stroke blue');
  const dotCall = page.calls.find(call => call[0] === 'drawCircle');
  assert.ok(dotCall, 'line start dot should be baked with drawCircle');
  assert.deepEqual({ x: dotCall[1].x, y: dotCall[1].y }, { x: 30, y: 25 });
  assert.equal(dotCall[1].size, 6);
  const arrowCalls = page.calls.filter(call => call[0] === 'drawLine').slice(1);
  assert.equal(arrowCalls.length, 2, 'line end arrow should be baked as two drawLine strokes');
  assert.ok(arrowCalls.every(call => call[1].end.x === 120 && call[1].end.y === 80));
  assert.equal(harness.undoDescriptors.length, 1);
  assert.equal(plugin.getTemporaryObjects().length, 0);
});

await runTest('temporary vector objects render SVG previews and endpoint handles in the edit layer', () => {
  const { plugins, documentStub } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);
  const previewContainer = createElementStub('div');
  previewContainer.id = 'preview-container';
  const { pageElement } = createPreviewPageStub();
  previewContainer.appendChild(pageElement);
  documentStub.querySelector = selector => selector === '#preview-container' ? previewContainer : null;
  plugin.setup(harness.ctx);

  const rectObject = plugin.createTemporaryObject(harness.ctx, {
    type: 'rect',
    pageIndex: 0,
    rect: { x: 20, y: 30, width: 40, height: 20 },
    options: { strokeColor: '#d32f2f', fillColor: null, strokeWidth: 2, opacity: 1 },
  });
  const rectVector = pageElement.querySelector('.plugin-vector-preview');
  assert.ok(rectVector, 'rectangle should render as an SVG/vector preview');
  assert.equal(
    rectVector.getAttribute('preserveAspectRatio'),
    'none',
    'rectangle preview should stretch with the selected frame aspect ratio'
  );

  plugin.cancelTemporaryObject(rectObject.id);
  plugin.createTemporaryObject(harness.ctx, {
    type: 'line',
    pageIndex: 0,
    line: { x1: 20, y1: 30, x2: 80, y2: 50 },
    options: { strokeColor: '#0000ff', strokeWidth: 3, opacity: 1, startMarker: 'dot', endMarker: 'arrow' },
  });
  const lineVector = pageElement.querySelector('.plugin-vector-preview');
  assert.equal(lineVector.querySelectorAll('circle').length, 1, 'line dot marker should render in the SVG preview');
  assert.equal(lineVector.querySelectorAll('polyline').length, 1, 'line arrow marker should render in the SVG preview');
  const endpointHandles = pageElement.querySelectorAll('.plugin-line-endpoint-handle');
  assert.equal(endpointHandles.length, 2);
});

await runTest('temporary edit layer mutations do not reschedule their own render loop', () => {
  const { plugins, documentStub, context } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);
  const previewContainer = createElementStub('div');
  previewContainer.id = 'preview-container';
  const { pageElement } = createPreviewPageStub();
  previewContainer.appendChild(pageElement);
  documentStub.querySelector = selector => selector === '#preview-container' ? previewContainer : null;

  let observed = null;
  let scheduledFrames = 0;
  context.MutationObserver = class MutationObserver {
    constructor(callback) {
      this.callback = callback;
      observed = this;
    }

    observe(target, options) {
      this.target = target;
      this.options = options;
    }
  };
  context.requestAnimationFrame = () => {
    scheduledFrames += 1;
    return scheduledFrames;
  };

  plugin.setup(harness.ctx);
  assert.ok(observed, 'preview container should be observed');

  plugin.createTemporaryObject(harness.ctx, {
    type: 'rect',
    pageIndex: 0,
    rect: { x: 20, y: 30, width: 100, height: 25 },
    options: { strokeColor: '#d32f2f', fillColor: null, strokeWidth: 2, opacity: 1 },
  });

  const layer = pageElement.querySelector('.plugin-edit-layer');
  const objectElement = pageElement.querySelector('.plugin-object');
  assert.ok(layer, 'edit layer should exist');
  assert.ok(objectElement, 'temporary rectangle should render before observer callback');

  observed.callback([{ target: layer, addedNodes: [objectElement], removedNodes: [] }]);
  assert.equal(scheduledFrames, 0, 'edit-layer mutations should not schedule another layer render');

  observed.callback([{ target: previewContainer, addedNodes: [pageElement], removedNodes: [] }]);
  assert.equal(scheduledFrames, 1, 'preview page mutations should still schedule layer maintenance');
});

await runTest('temporary shape property controls update stroke, fill, and opacity from the edit layer UI', () => {
  const { plugins, documentStub } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);
  const previewContainer = createElementStub('div');
  previewContainer.id = 'preview-container';
  const { pageElement } = createPreviewPageStub();
  previewContainer.appendChild(pageElement);
  documentStub.querySelector = selector => selector === '#preview-container' ? previewContainer : null;
  plugin.setup(harness.ctx);

  plugin.createTemporaryObject(harness.ctx, {
    type: 'rect',
    pageIndex: 0,
    rect: { x: 20, y: 30, width: 100, height: 25 },
    options: { strokeColor: '#d32f2f', fillColor: null, strokeWidth: 2, opacity: 1 },
  });

  const collectInputs = panel => (panel.children || [])
    .flatMap(child => child.children || [])
    .filter(child => child.tagName === 'INPUT');

  let inputs = collectInputs(pageElement.querySelector('.plugin-property-panel'));
  assert.equal(inputs.length, 5, 'rectangle property panel should expose stroke, width, opacity, fill, and fill color');
  inputs[0].value = '#00ff00';
  inputs[0].dispatchEvent('change', {});
  assert.equal(plugin.getTemporaryObjects()[0].options.strokeColor, '#00ff00');

  inputs = collectInputs(pageElement.querySelector('.plugin-property-panel'));
  inputs[2].value = '0.4';
  inputs[2].dispatchEvent('change', {});
  assert.equal(plugin.getTemporaryObjects()[0].options.opacity, 0.4);

  inputs = collectInputs(pageElement.querySelector('.plugin-property-panel'));
  inputs[3].checked = true;
  inputs[3].dispatchEvent('change', {});
  assert.equal(plugin.getTemporaryObjects()[0].options.fillColor, '#00ff00');

  inputs = collectInputs(pageElement.querySelector('.plugin-property-panel'));
  inputs[4].value = '#112233';
  inputs[4].dispatchEvent('change', {});
  assert.equal(plugin.getTemporaryObjects()[0].options.fillColor, '#112233');

  plugin.cancelTemporaryObject(plugin.getTemporaryObjects()[0].id);
  plugin.createTemporaryObject(harness.ctx, {
    type: 'line',
    pageIndex: 0,
    line: { x1: 20, y1: 30, x2: 100, y2: 30 },
    options: { strokeColor: '#d32f2f', strokeWidth: 2, opacity: 1 },
  });
  const linePanel = pageElement.querySelector('.plugin-property-panel');
  const markerSelects = (linePanel.children || [])
    .flatMap(child => child.children || [])
    .filter(child => child.tagName === 'SELECT');
  assert.equal(markerSelects.length, 2, 'line property panel should expose start and end marker selects');
  markerSelects[0].value = 'dot';
  markerSelects[0].dispatchEvent('change', {});
  markerSelects[1].value = 'arrow';
  markerSelects[1].dispatchEvent('change', {});
  assert.equal(plugin.getTemporaryObjects()[0].options.startMarker, 'dot');
  assert.equal(plugin.getTemporaryObjects()[0].options.endMarker, 'arrow');
});

await runTest('temporary object opacity does not make edit toolbar controls transparent', () => {
  const { plugins, documentStub } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);
  const previewContainer = createElementStub('div');
  previewContainer.id = 'preview-container';
  const { pageElement } = createPreviewPageStub();
  previewContainer.appendChild(pageElement);
  documentStub.querySelector = selector => selector === '#preview-container' ? previewContainer : null;
  plugin.setup(harness.ctx);

  plugin.createTemporaryObject(harness.ctx, {
    type: 'stamp',
    pageIndex: 0,
    rect: { x: 20, y: 30, width: 120, height: 40 },
    data: { preset: 'DRAFT' },
    options: { opacity: 0.35, rotate: -25, color: '#d32f2f' },
  });

  const objectElement = pageElement.querySelector('.plugin-object');
  assert.ok(objectElement, 'temporary stamp should render');
  assert.notEqual(objectElement.style.opacity, '0.35');

  const preview = objectElement.querySelector('.plugin-object-preview');
  assert.ok(preview, 'stamp preview should carry the visual opacity');
  assert.equal(preview.style.opacity, '0.35');

  const toolbar = objectElement.querySelector('.plugin-edit-toolbar');
  assert.ok(toolbar, 'selected temporary stamp should show the toolbar');
  assert.equal(toolbar.style.opacity || '', '');
});

await runTest('temporary shape toolbar apply does not start drag before baking into the PDF', async () => {
  const { plugins, documentStub } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);
  const previewContainer = createElementStub('div');
  previewContainer.id = 'preview-container';
  const { pageElement } = createPreviewPageStub();
  previewContainer.appendChild(pageElement);
  documentStub.querySelector = selector => selector === '#preview-container' ? previewContainer : null;
  plugin.setup(harness.ctx);

  plugin.createTemporaryObject(harness.ctx, {
    type: 'rect',
    pageIndex: 0,
    rect: { x: 20, y: 30, width: 40, height: 20 },
    options: { strokeColor: '#d32f2f', fillColor: null, strokeWidth: 2, opacity: 1 },
  });

  const objectElement = pageElement.querySelector('.plugin-object');
  assert.ok(objectElement, 'temporary rectangle should be rendered in the edit layer');
  const toolbar = objectElement.querySelector('.plugin-edit-toolbar');
  assert.ok(toolbar, 'selected temporary rectangle should show the edit toolbar');
  const applyButton = toolbar.children[0];
  assert.ok(applyButton, 'edit toolbar should include an apply button');

  applyButton.dispatchEvent('pointerdown', { clientX: 120, clientY: 160 });
  assert.equal(
    pageElement.querySelector('.plugin-object'),
    objectElement,
    'toolbar pointerdown should stay inside the toolbar instead of remounting the object as a drag'
  );

  await applyButton.click();

  const rectCall = page.calls.find(call => call[0] === 'drawRectangle');
  assert.ok(rectCall, 'toolbar apply should bake the rectangle into the PDF');
  assertClose(rectCall[1].x, 20, 'toolbar-applied rectangle x');
  assertClose(rectCall[1].y, 30, 'toolbar-applied rectangle y');
  assertClose(rectCall[1].width, 40, 'toolbar-applied rectangle width');
  assertClose(rectCall[1].height, 20, 'toolbar-applied rectangle height');
  assert.equal(harness.undoDescriptors.length, 1);
  assert.equal(harness.refreshCount, 1);
  assert.equal(plugin.getTemporaryObjects().length, 0);
});

await runTest('temporary shape toolbar cancel and delete remove the selected object', async () => {
  const { plugins, documentStub } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);
  const previewContainer = createElementStub('div');
  previewContainer.id = 'preview-container';
  const { pageElement } = createPreviewPageStub();
  previewContainer.appendChild(pageElement);
  documentStub.querySelector = selector => selector === '#preview-container' ? previewContainer : null;
  plugin.setup(harness.ctx);

  plugin.createTemporaryObject(harness.ctx, {
    type: 'rect',
    pageIndex: 0,
    rect: { x: 20, y: 30, width: 40, height: 20 },
    options: { strokeColor: '#d32f2f', fillColor: null, strokeWidth: 2, opacity: 1 },
  });

  let toolbar = pageElement.querySelector('.plugin-edit-toolbar');
  assert.ok(toolbar, 'selected temporary rectangle should show toolbar before cancel');
  await toolbar.children[1].click();
  assert.equal(plugin.getTemporaryObjects().length, 0);
  assert.equal(pageElement.querySelector('.plugin-object'), null);

  plugin.createTemporaryObject(harness.ctx, {
    type: 'rect',
    pageIndex: 0,
    rect: { x: 20, y: 30, width: 40, height: 20 },
    options: { strokeColor: '#d32f2f', fillColor: null, strokeWidth: 2, opacity: 1 },
  });

  toolbar = pageElement.querySelector('.plugin-edit-toolbar');
  assert.ok(toolbar, 'selected temporary rectangle should show toolbar before delete');
  await toolbar.children[2].click();
  assert.equal(plugin.getTemporaryObjects().length, 0);
  assert.equal(pageElement.querySelector('.plugin-object'), null);
});

await runTest('page number, date, and watermark stamps use text or canvas image paths', async () => {
  const { plugins } = loadPlugin();
  const plugin = getPlugin(plugins, 'stamp-tools');
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);

  await plugin.applyPageNumbers(harness.ctx, {
    target: 'all',
    format: 'page',
    position: 'bottom-center',
    margin: 10,
    fontSize: 12,
    color: '#000000',
  });
  assert.equal(page.calls[0][0], 'drawText');
  assert.equal(page.calls[0][1], 'Page 1');

  await plugin.applyDateStamp(harness.ctx, {
    text: '2026-06-10',
    position: 'top-right',
    margin: 10,
    fontSize: 10,
    color: '#111111',
  });
  assert.ok(page.calls.some(call => call[0] === 'drawText' && call[1] === '2026-06-10'));

  await plugin.applyFixedStamp(harness.ctx, {
    color: '#d32f2f',
  });
  const stampTextCall = page.calls.find(call => call[0] === 'drawText' && call[1] === 'SAMPLE');
  assert.ok(stampTextCall, 'watermark stamp should insert the default SAMPLE watermark');
  assertClose(stampTextCall[2].opacity, 0.35, 'watermark stamp opacity');
  assert.equal(stampTextCall[2].rotate.angle, -25);
  assert.equal(stampTextCall[2].color.red, 211 / 255);

  const japanesePage = createPage(200, 300);
  const japaneseHarness = createPluginContext(createTab([japanesePage]));
  await plugin.applyFixedStamp(japaneseHarness.ctx, {
    text: '社外秘',
    color: '#112233',
  });
  const stampImageCall = japanesePage.calls.find(call => call[0] === 'drawImage');
  assert.ok(stampImageCall, 'Japanese watermark stamp should be inserted as image');
  assert.equal(stampImageCall[1].type, 'png');
  assertClose(stampImageCall[2].opacity, 0.35, 'Japanese watermark opacity');
});

await runTest('page number and date stamps accept comma and range page targets from selected-page controls', async () => {
  const { plugins } = loadPlugin();
  const plugin = getPlugin(plugins, 'stamp-tools');
  const pages = [createPage(200, 300), createPage(200, 300), createPage(200, 300), createPage(200, 300)];
  const tab = createTab(pages);
  tab.selectedPages = [0, 3];
  const harness = createPluginContext(tab);

  await plugin.applyPageNumbers(harness.ctx, {
    target: 'pages:1,4',
    format: 'number',
    position: 'bottom-center',
    margin: 10,
    fontSize: 12,
    color: '#000000',
  });

  assert.deepEqual(
    pages.map(page => page.calls.filter(call => call[0] === 'drawText').map(call => call[1])),
    [['1'], [], [], ['4']]
  );
  assert.equal(harness.undoDescriptors.at(-1).pages.join(','), '0,3');

  pages.forEach(page => {
    page.calls.length = 0;
  });
  await plugin.applyDateStamp(harness.ctx, {
    target: 'pages:2-3',
    text: '2026-06-29',
    format: 'yyyy/mm/dd',
    position: 'top-left',
    margin: 8,
    fontSize: 10,
    color: '#111111',
  });

  assert.deepEqual(
    pages.map(page => page.calls.filter(call => call[0] === 'drawText').map(call => call[1])),
    [[], ['2026/06/29'], ['2026/06/29'], []]
  );
  assert.equal(harness.undoDescriptors.at(-1).pages.join(','), '1,2');
});

await runTest('watermark stamp targets all pages by default and explicit page ranges', async () => {
  const { plugins } = loadPlugin();
  const plugin = getPlugin(plugins, 'stamp-tools');
  const pages = [createPage(200, 300), createPage(200, 300), createPage(200, 300), createPage(200, 300), createPage(200, 300)];
  const tab = createTab(pages);
  tab.selectedPages = [2];
  const harness = createPluginContext(tab);

  await plugin.applyFixedStamp(harness.ctx, { color: '#112233' });
  assert.equal(harness.undoDescriptors.at(-1).pages.join(','), '0,1,2,3,4');

  pages.forEach(page => {
    page.calls.length = 0;
  });
  await plugin.applyFixedStamp(harness.ctx, { target: 'pages:2,4-5', color: '#112233' });
  assert.equal(pages[0].calls.filter(call => call[0] === 'drawText' && call[1] === 'SAMPLE').length, 0);
  assert.equal(pages[1].calls.filter(call => call[0] === 'drawText' && call[1] === 'SAMPLE').length, 1);
  assert.equal(pages[2].calls.filter(call => call[0] === 'drawText' && call[1] === 'SAMPLE').length, 0);
  assert.equal(pages[3].calls.filter(call => call[0] === 'drawText' && call[1] === 'SAMPLE').length, 1);
  assert.equal(pages[4].calls.filter(call => call[0] === 'drawText' && call[1] === 'SAMPLE').length, 1);
  assert.equal(harness.undoDescriptors.at(-1).pages.join(','), '1,3,4');
});

await runTest('watermark stamp rejects malformed page ranges and empty custom text without mutating the PDF', async () => {
  const { plugins } = loadPlugin();
  const plugin = getPlugin(plugins, 'stamp-tools');
  const pages = [createPage(200, 300), createPage(200, 300)];
  const tab = createTab(pages);
  const harness = createPluginContext(tab);

  const applied = await plugin.applyFixedStamp(harness.ctx, { target: 'pages:2-', color: '#112233' });

  assert.equal(applied, false);
  assert.deepEqual(pages.map(page => page.calls.length), [0, 0]);
  assert.equal(harness.undoDescriptors.length, 0);
  assert.equal(harness.toasts.at(-1).type, 'warning');
  assert.match(harness.toasts.at(-1).message, /1,3-5/);

  const emptyApplied = await plugin.applyFixedStamp(harness.ctx, { text: '   ', color: '#112233' });
  assert.equal(emptyApplied, false);
  assert.deepEqual(pages.map(page => page.calls.length), [0, 0]);
  assert.equal(harness.undoDescriptors.length, 0);
  assert.equal(harness.toasts.at(-1).type, 'warning');
  assert.match(harness.toasts.at(-1).message, /透かし文字/);
});

await runTest('form flatten flattens AcroForm and skips PDFs without fields', async () => {
  const { plugins } = loadPlugin();
  const plugin = getPlugin(plugins, 'form-flatten');
  const page = createPage();
  const tab = createTab([page]);
  let flattenCount = 0;
  let appearanceCount = 0;
  tab.pdfDoc.getForm = () => ({
    getFields() {
      return [{ name: 'field-1' }];
    },
    updateFieldAppearances() {
      appearanceCount += 1;
    },
    flatten() {
      flattenCount += 1;
    },
  });
  const harness = createPluginContext(tab);

  await plugin.flattenForm(harness.ctx, { confirmed: true });

  assert.equal(flattenCount, 1);
  assert.equal(appearanceCount, 1);
  assert.equal(harness.undoDescriptors[0].type, 'insert');
  assert.equal(harness.undoDescriptors[0].plugin, 'form-flatten');
  assert.deepEqual([...harness.undoDescriptors[0].pdfBytesSnapshot], [1, 2, 3]);
  assert.deepEqual([...harness.undoDescriptors[0].pdfBytesAfter], [9, 8, 7]);

  const noFormTab = createTab([createPage()]);
  noFormTab.pdfDoc.getForm = () => ({ getFields: () => [] });
  const noFormHarness = createPluginContext(noFormTab);
  await plugin.flattenForm(noFormHarness.ctx, { confirmed: true });

  assert.equal(noFormHarness.undoDescriptors.length, 0);
  assert.equal(noFormHarness.refreshCount, 0);
  assert.deepEqual([...noFormTab.pdfBytes], [1, 2, 3]);
  assert.equal(noFormHarness.toasts.at(-1).type, 'info');
  assert.equal(noFormHarness.toasts.at(-1).message, 'フォームは見つかりませんでした。');

  const throwingFormTab = createTab([createPage()]);
  throwingFormTab.pdfDoc.getForm = () => {
    throw new Error('No AcroForm');
  };
  const throwingFormHarness = createPluginContext(throwingFormTab);
  await plugin.flattenForm(throwingFormHarness.ctx, { confirmed: true });

  assert.equal(throwingFormHarness.undoDescriptors.length, 0);
  assert.equal(throwingFormHarness.refreshCount, 0);
  assert.equal(throwingFormHarness.toasts.at(-1).message, 'フォームは見つかりませんでした。');
});

await runTest('rotation applies relative angles to all selected pages and records snapshot undo', async () => {
  const { plugin } = loadPlugin();
  const pages = [createPage(200, 300, 90), createPage(200, 300, 270)];
  const tab = createTab(pages);
  const harness = createPluginContext(tab);

  await plugin.rotateSelectedPages(harness.ctx, 90);

  assert.deepEqual(pages[0].calls, [['setRotation', 180]]);
  assert.deepEqual(pages[1].calls, [['setRotation', 0]]);
  assert.equal(harness.undoDescriptors.length, 1);
  assert.equal(harness.undoDescriptors[0].type, 'insert');
  assert.equal(harness.undoDescriptors[0].plugin, 'page-transform');
  assert.equal(harness.refreshCount, 1);
  assert.equal(tab.pdfBytes[0], 9);
});

await runTest('crop validates page bounds and uses CropBox in PDF points', async () => {
  const { plugin } = loadPlugin();
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);

  await plugin.applyCrop(harness.ctx, { top: 10, right: 5, bottom: 20, left: 5 });

  const cropCall = page.calls[0];
  assert.equal(cropCall[0], 'setCropBox');
  assertClose(cropCall[1], 5 * 72 / 25.4, 'left crop');
  assertClose(cropCall[2], 20 * 72 / 25.4, 'bottom crop');
  assertClose(cropCall[3], 200 - 10 * 72 / 25.4, 'crop width');
  assertClose(cropCall[4], 300 - 30 * 72 / 25.4, 'crop height');

  const invalidPage = createPage(50, 50);
  const invalidTab = createTab([invalidPage]);
  const invalidHarness = createPluginContext(invalidTab);
  await plugin.applyCrop(invalidHarness.ctx, { top: 20, right: 0, bottom: 20, left: 0 });

  assert.deepEqual(invalidPage.calls, []);
  assert.equal(invalidHarness.undoDescriptors.length, 0);
  assert.equal(invalidHarness.toasts.at(-1).type, 'warning');
});

await runTest('margin, page size, and content shrink call pdf-lib content transform APIs', async () => {
  const { plugin } = loadPlugin();
  const marginPage = createPage(200, 300);
  const marginHarness = createPluginContext(createTab([marginPage]));
  await plugin.applyMargins(marginHarness.ctx, { top: 10, right: 10, bottom: 5, left: 5 });

  assert.equal(marginPage.calls[0][0], 'setSize');
  assertClose(marginPage.calls[0][1], 200 + 15 * 72 / 25.4, 'margin width');
  assertClose(marginPage.calls[0][2], 300 + 15 * 72 / 25.4, 'margin height');
  assert.equal(marginPage.calls[1][0], 'translateContent');
  assertClose(marginPage.calls[1][1], 5 * 72 / 25.4, 'margin translate x');
  assertClose(marginPage.calls[1][2], 5 * 72 / 25.4, 'margin translate y');
  assert.equal(marginPage.calls[2][0], 'setCropBox');
  assert.equal(marginPage.calls[2][1], 0);
  assert.equal(marginPage.calls[2][2], 0);

  const resizePage = createPage(800, 1000);
  const resizeHarness = createPluginContext(createTab([resizePage]));
  await plugin.applyPageSize(resizeHarness.ctx, { preset: 'a4-portrait', fitContent: true });

  assert.equal(resizePage.calls[0][0], 'scaleContent');
  assert.equal(resizePage.calls[1][0], 'translateContent');
  assert.equal(resizePage.calls[2][0], 'setSize');
  assertClose(resizePage.calls[2][1], 210 * 72 / 25.4, 'A4 portrait width');
  assertClose(resizePage.calls[2][2], 297 * 72 / 25.4, 'A4 portrait height');
  assert.equal(resizePage.calls[3][0], 'setCropBox');
  assert.equal(resizePage.calls[3][1], 0);
  assert.equal(resizePage.calls[3][2], 0);

  const shrinkPage = createPage(200, 300);
  const shrinkHarness = createPluginContext(createTab([shrinkPage]));
  await plugin.applyContentShrink(shrinkHarness.ctx, { percent: 80, center: true });

  assert.deepEqual(shrinkPage.calls[0], ['scaleContent', 0.8, 0.8]);
  assert.equal(shrinkPage.calls[1][0], 'translateContent');
  assertClose(shrinkPage.calls[1][1], 20, 'content shrink translate x');
  assertClose(shrinkPage.calls[1][2], 30, 'content shrink translate y');
});

await runTest('page size presets include school A and B sizes converted from mm to PDF points', async () => {
  const { plugin } = loadPlugin();
  const presets = {
    'a3-portrait': [297, 420],
    'a3-landscape': [420, 297],
    'a4-portrait': [210, 297],
    'a4-landscape': [297, 210],
    'a5-portrait': [148, 210],
    'a5-landscape': [210, 148],
    'b4-portrait': [257, 364],
    'b4-landscape': [364, 257],
    'b5-portrait': [182, 257],
    'b5-landscape': [257, 182],
  };

  for (const [preset, [widthMm, heightMm]] of Object.entries(presets)) {
    const page = createPage(200, 300);
    const harness = createPluginContext(createTab([page]));
    await plugin.applyPageSize(harness.ctx, { preset, fitContent: false });
    const setSizeCall = page.calls.find(call => call[0] === 'setSize');
    assert.ok(setSizeCall, `${preset} should resize the page`);
    assertClose(setSizeCall[1], widthMm * 72 / 25.4, `${preset} width`);
    assertClose(setSizeCall[2], heightMm * 72 / 25.4, `${preset} height`);
  }
});

await runTest('QR code insertion generates PNG bytes locally from text input', async () => {
  const { plugins, pluginSource } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const page = createPage(200, 300);
  const tab = createTab([page]);
  const harness = createPluginContext(tab);

  assert.doesNotMatch(pluginSource, /fetch\s*\(|XMLHttpRequest|google\.script\.run|https?:\/\//);

  await plugin.applyQrImage(harness.ctx, {
    target: 'selected',
    text: 'school.example.jp/class-a',
    x: 10,
    y: 12,
    size: 30,
    includeBackground: true,
  });

  const imageCall = page.calls.find(call => call[0] === 'drawImage');
  assert.ok(imageCall, 'QR PNG should be drawn on the page');
  assert.equal(imageCall[1].type, 'png');
  assert.deepEqual([...imageCall[1].bytes.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assertClose(imageCall[2].width, 30 * 72 / 25.4, 'QR width');
  assertClose(imageCall[2].height, 30 * 72 / 25.4, 'QR height');
});

await runTest('QR code insertion embeds generated PNG with bundled pdf-lib', async () => {
  const { plugins } = loadPlugin();
  const plugin = getPlugin(plugins, 'insert-tools');
  const PDFLib = loadBundledPdfLib();
  const pdfDoc = await PDFLib.PDFDocument.create();
  pdfDoc.addPage();
  const beforeBytes = await pdfDoc.save();
  const tab = {
    id: 'real-pdf-tab',
    pdfBytes: beforeBytes,
    selectedPages: [0],
    pageCount: 1,
    undoStack: [],
    redoStack: [],
    pdfDoc,
  };
  const harness = createPluginContext(tab);
  harness.ctx.PDFLib = PDFLib;

  const applied = await plugin.applyQrImage(harness.ctx, {
    target: 'selected',
    text: 'https://example.com/school/class-a/attendance',
    x: 10,
    y: 12,
    size: 30,
    includeBackground: true,
  });

  assert.equal(applied, true);
  assert.ok(tab.pdfBytes.byteLength > beforeBytes.byteLength, 'saved PDF should include the embedded QR image');
  assert.equal(harness.undoDescriptors.length, 1);
  assert.equal(harness.refreshCount, 1);
});
