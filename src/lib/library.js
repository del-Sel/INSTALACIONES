export function formatBytes(bytes = 0) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / (1024 ** power)
  return `${value >= 10 || power === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`
}

export function assetLabel(type) {
  return {
    image: 'Imagen',
    video: 'Video',
    document: 'Documento',
    'can-data': 'Registro CAN / datos',
    text: 'Nota técnica',
    shortcut: 'Acceso directo',
    backup: 'Copia de respaldo',
    data: 'Archivo técnico',
  }[type] || 'Archivo'
}

export function assetIcon(type) {
  return {
    image: '▧',
    video: '▶',
    document: '▤',
    'can-data': '⌁',
    text: '≡',
    shortcut: '↗',
    backup: '◴',
    data: '◇',
  }[type] || '◇'
}

export function isBrowserImage(extension = '') {
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(extension.toLowerCase())
}

export function isBrowserVideo(extension = '') {
  return ['.mp4', '.webm'].includes(extension.toLowerCase())
}

export function detectedAssetType(asset = {}) {
  return asset?.metadata?.detected_type || assetLabel(asset?.asset_type)
}

function cleanDetectedDescription(description = '') {
  let text = String(description || '').trim()
  if (!text) return ''

  const replacements = [
    [/[^.]*puede mostrar una vista previa[^.]*\.?/gi, ''],
    [/[^.]*muestra una vista previa[^.]*\.?/gi, ''],
    [/no es un archivo desconocido:\s*/gi, ''],
    [/Se conserva como respaldo[^.]*\.?/gi, ''],
    [/Algunos navegadores no la muestran directamente;[^.]*\.?/gi, ''],
    [/Se mantiene disponible como archivo original\.?/gi, ''],
    [/Aunque el archivo no tenga extensión,\s*/gi, ''],
    [/sin obligarte a descargarlo\.?/gi, ''],
  ]

  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement)
  return text.replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim()
}

export function detectedAssetDescription(asset = {}) {
  const explicit = cleanDetectedDescription(asset?.metadata?.detected_description || '')
  if (explicit) return explicit

  const type = detectedAssetType(asset).toLowerCase()
  if (type.includes('can')) return 'Registro de comunicación CAN asociado al vehículo.'
  if (type.includes('config')) return 'Archivo de configuración asociado al equipo o a la aplicación de origen.'
  if (type.includes('cifrado')) return 'Archivo de datos cifrado de la aplicación de origen.'
  if (asset?.asset_type === 'text') return 'Nota técnica asociada al vehículo o a la instalación.'
  if (asset?.asset_type === 'document') return 'Documento técnico asociado al caso.'
  if (asset?.asset_type === 'data') return 'Archivo de datos técnicos asociado al caso.'
  return ''
}

export function detectedAssetPreview(asset = {}) {
  return asset?.metadata?.preview_text || ''
}

export function detectedAssetConfidence(asset = {}) {
  return asset?.metadata?.detected_confidence || ''
}

function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function assetDisplayLabel(asset = {}) {
  if (asset?.metadata?.display_label) return asset.metadata.display_label

  const filename = asset?.filename || ''
  const name = normalize(filename)

  if (/camion|caminhao|vehiculo|frente|lateral|exterior/.test(name)) return 'Vista del vehículo'
  if (/fmd.*instal|equipo.*instal|instalado/.test(name)) return 'Equipo instalado'
  if (/bajo.?fusilera|fusilera|bajo.?volante|detras.?tablero|detras.?guantera|ubicacion/.test(name)) return 'Ubicación de conexión'
  if (/ficha|conector|pinout|2pin|obd/.test(name)) return 'Conector / pinout'
  if (/datos.?leidos|scan|scanner|pgn|rpm|veloc|consumo|km.?tablero|tablero/.test(name)) return 'Datos técnicos / comprobación'
  if (/plano|esquema|esquematico|diagrama/.test(name)) return 'Plano / esquema técnico'
  if (/firmware|config/.test(name)) return 'Configuración'

  return filename || assetLabel(asset?.asset_type)
}

export function assetContextGroup(asset = {}) {
  if (asset?.metadata?.context_group) return asset.metadata.context_group

  const name = normalize(`${asset?.filename || ''} ${asset?.relative_path || ''}`)

  if (/camion|caminhao|vehiculo|frente|lateral|exterior/.test(name)) return 'Vehículo'
  if (/fmd.*instal|equipo.*instal|instalado/.test(name)) return 'Resultado de instalación'
  if (/bajo.?fusilera|fusilera|bajo.?volante|detras.?tablero|detras.?guantera|ubicacion/.test(name)) return 'Ubicación y acceso'
  if (/ficha|conector|pinout|2pin|obd/.test(name)) return 'Conectores y pinout'
  if (/datos.?leidos|scan|scanner|pgn|rpm|veloc|consumo|km.?tablero|tablero/.test(name)) return 'Datos y comprobaciones'
  if (/plano|esquema|esquematico|diagrama|pdf|docx|pptx/.test(name)) return 'Documentación técnica'
  if (/firmware|config|\.dat/.test(name)) return 'Configuración y archivos de datos'
  if (/\.can/.test(name) || asset?.asset_type === 'can-data') return 'Capturas CAN'
  if (asset?.asset_type === 'video') return 'Videos'
  if (asset?.asset_type === 'image') return 'Imágenes de referencia'
  return 'Otros archivos'
}
