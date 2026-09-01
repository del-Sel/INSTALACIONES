export function contentKindLabel(kind) {
  if (kind === 'REFERENCIA') return 'Referencia técnica'
  if (kind === 'PARCIAL') return 'Instalación parcial'
  return 'Instructivo'
}

export function contentKindBadgeLabel(kind) {
  return contentKindLabel(kind).toUpperCase()
}

export function statusLabel(status) {
  return status === 'VALIDADA' ? 'Validada' : 'Pendiente de revisión'
}

export function countLabel(count, singular, plural = `${singular}s`) {
  const spanishPlural = {
    instalación: 'instalaciones',
    referencia: 'referencias',
    familia: 'familias',
    modelo: 'modelos',
    documento: 'documentos',
  }[singular]
  return `${count} ${count === 1 ? singular : (spanishPlural || plural)}`
}

export function formatUpdatedDate(value) {
  if (!value) return 'Fecha no disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return `Actualizado el ${new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)}`
}
