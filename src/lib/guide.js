const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.xlsm', '.xltx', '.ods', '.csv'])

function normalizedTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function isObviousInstallationSection(section = {}) {
  const title = normalizedTitle(section.title)
  return title === 'elementos necesarios para la instalacion'
    || title === 'materiales necesarios para la instalacion'
    || title === 'lista de materiales para la instalacion'
    || title === 'equipo utilizado en la prueba'
    || title === 'registro de la instalacion'
}

export function isSpreadsheetAsset(asset) {
  return SPREADSHEET_EXTENSIONS.has((asset?.extension || '').toLowerCase())
}

export function visibleGuideAssets(assets = []) {
  return assets.filter(asset => !isSpreadsheetAsset(asset) && asset.asset_type !== 'shortcut')
}
