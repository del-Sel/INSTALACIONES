const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.xlsm', '.xltx', '.ods', '.csv'])

export function isSpreadsheetAsset(asset) {
  return SPREADSHEET_EXTENSIONS.has((asset?.extension || '').toLowerCase())
}

export function visibleGuideAssets(assets = []) {
  return assets.filter(asset => !isSpreadsheetAsset(asset) && asset.asset_type !== 'shortcut')
}
