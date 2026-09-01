import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getCatalogSnapshot, loadCatalogSnapshot } from '../lib/catalogCache.js'

function AdminPending() {
  const cached = getCatalogSnapshot()
  const [guides, setGuides] = useState(() => (cached?.guides || []).filter(item => item.status === 'BORRADOR' && item.content_kind !== 'REFERENCIA'))
  const [families, setFamilies] = useState(cached?.families || [])
  const [brands, setBrands] = useState(cached?.brands || [])
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const snapshot = await loadCatalogSnapshot()
      setGuides((snapshot.guides || []).filter(item => item.status === 'BORRADOR' && item.content_kind !== 'REFERENCIA').sort((a, b) => a.title.localeCompare(b.title)))
      setFamilies(snapshot.families || [])
      setBrands(snapshot.brands || [])
    } catch (_) {}
  }

  const familyById = useMemo(() => new Map(families.map(item => [item.id, item])), [families])
  const brandById = useMemo(() => new Map(brands.map(item => [item.id, item])), [brands])
  const items = useMemo(() => guides.map(guide => {
    const family = familyById.get(guide.family_id)
    const brand = family ? brandById.get(family.brand_id) : null
    return { ...guide, family, brand }
  }).filter(item => item.family && item.brand), [guides, familyById, brandById])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(item => `${item.brand.name} ${item.family.name} ${item.title}`.toLowerCase().includes(q))
  }, [items, search])

  return (
    <>
      <header className="admin-hero-v7 compact">
        <div><div className="page-eyebrow">ADMINISTRACIÓN</div><h1>Instructivos por revisar</h1><p>Instructivos y documentos parciales pendientes de revisión. Las referencias técnicas se administran por separado.</p></div>
        <div className="admin-stats-v7 single"><div><strong>{items.length}</strong><span>Por revisar</span></div></div>
      </header>

      <section className="admin-toolbar-v7"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar documentación..." /></section>

      <div className="admin-pending-list-v7">
        {filtered.map(item => (
          <Link key={item.id} to={`/${item.brand.slug}/${item.family.slug}#guide-${item.id}`}>
            <div><span>{item.brand.name} · {item.family.name}</span><strong>{item.title}</strong><small>{item.content_kind || 'INSTRUCTIVO'} · {item.equipment || 'Equipo no especificado'}</small></div>
            <b>Revisar →</b>
          </Link>
        ))}
      </div>
    </>
  )
}

export default AdminPending
