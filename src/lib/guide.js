const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.xlsm', '.xltx', '.ods', '.csv'])

export function isSpreadsheetAsset(asset) {
  return SPREADSHEET_EXTENSIONS.has((asset?.extension || '').toLowerCase())
}

export function visibleGuideAssets(assets = []) {
  return assets.filter(asset => !isSpreadsheetAsset(asset) && asset.asset_type !== 'shortcut')
}

export function guideTags(text = '', assets = []) {
  const haystack = `${text} ${assets.map(a => `${a.filename || ''} ${a.relative_path || ''}`).join(' ')}`.toLowerCase()
  const tags = []
  const add = (label, condition) => { if (condition && !tags.includes(label)) tags.push(label) }

  add('OBDII', haystack.includes('obdii') || haystack.includes('obd ii'))
  add('FMS', /\bfms\b/.test(haystack))
  add('CAN2', haystack.includes('can2') || haystack.includes('can 2'))
  add('CAN 500', /500\s*(kbps|khz|k\b)/.test(haystack) || haystack.includes('can 500'))
  add('CAN 250', /250\s*(kbps|khz|k\b)/.test(haystack) || haystack.includes('can 250'))
  add('J1939', haystack.includes('j1939'))
  add('DG-600', haystack.includes('dg-600') || haystack.includes('dg600'))
  add('FMD-1000', haystack.includes('fmd-1000') || haystack.includes('fmd1000'))
  add('VDO', /\bvdo\b/.test(haystack))
  add('Pulsos', haystack.includes('pulso'))
  add('GPS', /\bgps\b/.test(haystack))

  return tags.slice(0, 7)
}

export function sectionKind(sectionType = '') {
  const type = String(sectionType || '').toLowerCase()
  const v8 = type.match(/^v(?:8|83|9|10|11|12)_(?:main|support)_([a-z0-9_]+)_\d+$/)
  const v7 = type.match(/^v7_([a-z0-9_]+)_\d+$/)
  const custom = type.match(/^custom_([a-z0-9]+)_/)
  const base = v8 ? v8[1] : v7 ? v7[1] : custom ? custom[1] : type

  if (base.startsWith('technical_table')) return 'technical_table'
  if (base.startsWith('configuration_files')) return 'configuration_files'
  if (base.startsWith('source_files')) return 'source_files'
  if (base.startsWith('materials')) return 'materials'
  if (base.startsWith('verification')) return 'verification'
  if (base.startsWith('configuration')) return 'configuration'
  if (base.startsWith('technical') || base.startsWith('signals')) return 'technical'
  if (base.startsWith('procedure') || base.startsWith('step') || base.startsWith('access') || base.startsWith('location') || base.startsWith('connector') || base.startsWith('wiring') || base.startsWith('power') || base.startsWith('antennas') || base.startsWith('final')) return 'procedure'
  if (base.startsWith('intro') || base.startsWith('overview')) return 'intro'
  if (base.startsWith('material')) return 'material'
  return 'notes'
}

export function guideLevel(sections = [], assets = []) {
  const kinds = new Set(sections.map(section => sectionKind(section.section_type)))
  const hasText = sections.some(section => (section.content || '').trim())
  const visual = visibleGuideAssets(assets).filter(asset => asset.asset_type === 'image' || asset.asset_type === 'video').length

  if (kinds.has('procedure')) return { key: 'complete', label: 'Documentada' }
  if (kinds.has('technical') || kinds.has('technical_table') || kinds.has('configuration')) return { key: 'partial', label: 'Datos técnicos' }
  if (hasText) return { key: 'source', label: 'Información disponible' }
  if (visual > 0) return { key: 'visual', label: 'Material visual' }
  return { key: 'source', label: 'Sin procedimiento documentado' }
}

export function compactAssetStats(assets = []) {
  const visible = visibleGuideAssets(assets)
  const counts = { image: 0, video: 0, document: 0, can: 0, data: 0 }
  for (const asset of visible) {
    if (asset.asset_type === 'image') counts.image += 1
    else if (asset.asset_type === 'video') counts.video += 1
    else if (asset.asset_type === 'document' || asset.asset_type === 'text') counts.document += 1
    else if (asset.asset_type === 'can-data') counts.can += 1
    else counts.data += 1
  }
  const out = []
  if (counts.image) out.push(`${counts.image} imagen${counts.image === 1 ? '' : 'es'}`)
  if (counts.video) out.push(`${counts.video} video${counts.video === 1 ? '' : 's'}`)
  if (counts.document) out.push(`${counts.document} documento${counts.document === 1 ? '' : 's'}`)
  if (counts.can) out.push(`${counts.can} CAN/datos`)
  if (counts.data) out.push(`${counts.data} archivo${counts.data === 1 ? '' : 's'}`)
  return out
}

export function sectionLane(sectionType = '') {
  const type = String(sectionType || '').toLowerCase()
  if (type.startsWith('v8_support_') || type.startsWith('v83_support_') || type.startsWith('v9_support_') || type.startsWith('v10_support_') || type.startsWith('v11_support_') || type.startsWith('v12_support_')) return 'support'
  if (type.startsWith('v8_main_') || type.startsWith('v83_main_') || type.startsWith('v9_main_') || type.startsWith('v10_main_') || type.startsWith('v11_main_') || type.startsWith('v12_main_')) return 'main'
  const kind = sectionKind(type)
  if (['technical', 'technical_table', 'configuration', 'configuration_files', 'source_files', 'material', 'notes'].includes(kind)) return 'support'
  return 'main'
}
