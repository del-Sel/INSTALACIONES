import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getCatalogSnapshot, loadCatalogSnapshot } from '../lib/catalogCache.js'

function AdminMaterials() {
  const cached = getCatalogSnapshot()
  const [collections, setCollections] = useState(cached?.collections || [])
  const [guides, setGuides] = useState(cached?.guides || [])
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const snapshot = await loadCatalogSnapshot()
      setCollections(snapshot.collections || [])
      setGuides(snapshot.guides || [])
    } catch (_) {}
  }

  const linked = useMemo(() => new Set(guides.map(item => item.library_collection_id).filter(Boolean)), [guides])
  const unlinked = useMemo(() => collections.filter(item => !linked.has(item.id)), [collections, linked])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return unlinked
    return unlinked.filter(item => `${item.source_brand} ${item.title}`.toLowerCase().includes(q))
  }, [unlinked, search])

  return (
    <>
      <header className="admin-hero-v7 compact">
        <div><div className="page-eyebrow">ADMINISTRACIÓN</div><h1>Material sin vincular</h1><p>Colecciones técnicas que todavía no están asociadas a una instalación o referencia.</p></div>
        <div className="admin-stats-v7 single"><div><strong>{unlinked.length}</strong><span>Pendientes</span></div></div>
      </header>

      <section className="admin-toolbar-v7"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar marca o material..." /></section>

      <div className="admin-material-grid-v7">
        {filtered.map(item => (
          <Link key={item.id} to={`/biblioteca/${item.id}`}>
            <span>{item.source_brand}</span>
            <strong>{item.title}</strong>
            <small>{item.file_count || 0} archivos · {item.image_count || 0} imágenes · {item.can_data_count || 0} CAN/datos</small>
            <b>Abrir material →</b>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && <div className="page-card">No hay material sin vincular con ese filtro.</div>}
    </>
  )
}

export default AdminMaterials
