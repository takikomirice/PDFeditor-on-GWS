function doGet(e) {
  if (e && e.parameter && e.parameter.asset === 'PdfLib') {
    return ContentService
      .createTextOutput(getRawContent_('PdfLib'))
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('PDF Editor on GWS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
