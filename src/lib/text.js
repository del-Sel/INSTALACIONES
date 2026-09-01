export function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function safeFileName(name) {
  const lastDot = name.lastIndexOf('.')
  const extension = lastDot >= 0 ? name.slice(lastDot).toLowerCase() : ''
  const base = lastDot >= 0 ? name.slice(0, lastDot) : name
  return slugify(base) + extension
}
