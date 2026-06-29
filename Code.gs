const REQUIRED_ASSETS = ['PdfLib'];
const OPTIONAL_ASSETS = ['Plugin'];

function doGet(e) {
  const asset = e && e.parameter && e.parameter.asset;
  if (asset) {
    return serveAsset_(asset);
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('PDF Editor on GWS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function serveAsset_(assetName) {
  const isRequired = REQUIRED_ASSETS.includes(assetName);
  const isOptional = OPTIONAL_ASSETS.includes(assetName);

  if (!isRequired && !isOptional) {
    return ContentService
      .createTextOutput('/* Unknown asset */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  try {
    return ContentService
      .createTextOutput(getRawContent_(assetName))
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (err) {
    if (isOptional) {
      return ContentService
        .createTextOutput([
          '/* Optional plugin not installed */',
          'window.__PDF_EDITOR_PLUGIN_STATUS__ = window.__PDF_EDITOR_PLUGIN_STATUS__ || {};',
          'window.__PDF_EDITOR_PLUGIN_STATUS__.assetReturned = false;',
          'window.__PDF_EDITOR_PLUGIN_STATUS__.message = "Optional plugin not installed";',
        ].join('\n'))
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput('throw new Error("Required asset not found: ' + assetName + '");')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

function getAssetUrl(assetName) {
  const serviceUrl = ScriptApp.getService().getUrl();
  if (!serviceUrl) {
    throw new Error('Web app URL is unavailable.');
  }
  return serviceUrl + '?asset=' + encodeURIComponent(assetName) + '&v=' + Date.now();
}

function getRawContent_(filename) {
  return HtmlService.createTemplateFromFile(filename).getRawContent();
}
