import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import VehiclePlaceholder from '../components/VehiclePlaceholder.jsx'
import AppIcon from '../components/AppIcon.jsx'
import { getCatalogSnapshot, loadCatalogSnapshot } from '../lib/catalogCache.js'

function buildItems(snapshot) {
  if (!snapshot) return []
  const familyById = new Map(snapshot.families.map(item => [item.id, item]))
  const brandById = new Map(snapshot.brands.map(item => [item.id, item]))
  const collectionById = new Map(snapshot.collections.map(item => [item.id, item]))

  return snapshot.guides.map(guide => {
    const family = familyById.get(guide.family_id)
    const brand = family ? brandById.get(family.brand_id) : null
    return { ...guide, family, brand, collection: collectionById.get(guide.library_collection_id) }
  }).filter(item => item.family && item.brand)
}

function TechnicalLibrary() {
  const cached = getCatalogSnapshot()
  const [items, setItems] = useState(() => buildItems(cached))
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    loadCatalogSnapshot()
      .then(data => { if (active) setItems(buildItems(data)) })
      .catch(() => { if (active) setError('No se pudieron cargar las instalaciones.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(item => `${item.brand.name} ${item.family.name} ${item.title} ${item.summary || ''} ${item.equipment || ''}`.toLowerCase().includes(q))
  }, [items, search])

  const brandGroups = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      if (!map.has(item.brand.id)) map.set(item.brand.id, { brand: item.brand, guides: [], families: new Map(), covers: [] })
      const group = map.get(item.brand.id)
      group.guides.push(item)
      group.families.set(item.family.id, item.family)
      const cover = item.cover_url || item.collection?.cover_url
      if (cover && !group.covers.includes(cover) && group.covers.length < 4) group.covers.push(cover)
    }
    return [...map.values()].sort((a, b) => a.brand.name.localeCompare(b.brand.name))
  }, [items])

  const instructivos = items.filter(item => item.content_kind === 'INSTRUCTIVO').length
  const parciales = items.filter(item => item.content_kind === 'PARCIAL').length
  const referencias = items.filter(item => item.content_kind === 'REFERENCIA').length

  if (loading && !items.length) return <div className="page-card skeleton-card-v124">Cargando instalaciones…</div>
  if (error && !items.length) return <div className="page-card">{error}</div>

  return (
    <>
      <header className="catalog-hero-v6">
        <div>
          <div className="page-eyebrow">BASE DE INSTALACIONES</div>
          <h1>Instalaciones</h1>
          <p>Todas las marcas y familias disponibles. Cada caso se identifica como instructivo, parcial o referencia técnica.</p>
        </div>
        <div className="catalog-stats-v6">
          <div><strong>{instructivos}</strong><span>Instructivos</span></div>
          <div><strong>{parciales}</strong><span>Parciales</span></div>
          <div><strong>{referencias}</strong><span>Referencias</span></div>
          <div><strong>{brandGroups.length}</strong><span>Marcas</span></div>
        </div>
      </header>

      <section className="catalog-search-v6" role="search">
        <AppIcon name="search" size={21} />
        <label htmlFor="catalog-search" className="sr-only">Buscar instalación</label>
        <input id="catalog-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar marca, familia o instalación..." autoComplete="off" />
        {search && <button type="button" onClick={() => setSearch('')}>Limpiar</button>}
      </section>

      {!search.trim() ? (
        <section className="catalog-brand-grid-v6" aria-label="Marcas disponibles">
          {brandGroups.map((group, index) => {
            const cover = group.covers[0]
            return (
              <Link key={group.brand.id} to={`/${group.brand.slug}`} className="catalog-brand-card-v6">
                <div className="catalog-brand-cover-v6">
                  {cover ? <img src={cover} alt={`Vehículo ${group.brand.name}`} loading={index < 4 ? 'eager' : 'lazy'} decoding="async" /> : <VehiclePlaceholder label={`Sin foto de ${group.brand.name}`} />}
                  {group.covers.length > 1 && (
                    <div className="catalog-cover-thumbs-v6" aria-hidden="true">
                      {group.covers.slice(1, 4).map(item => <img key={item} src={item} alt="" loading="lazy" decoding="async" />)}
                    </div>
                  )}
                </div>
                <div className="catalog-brand-copy-v6">
                  <div className="catalog-brand-title-v6"><div><span>Marca</span><h2>{group.brand.name}</h2></div><AppIcon name="arrow" size={20} /></div>
                  <p>{group.guides.length} instalación{group.guides.length === 1 ? '' : 'es'} · {group.families.size} familia{group.families.size === 1 ? '' : 's'}</p>
                  <div className="catalog-family-list-v6">
                    {[...group.families.values()].slice(0, 5).map(family => <span key={family.id}>{family.name}</span>)}
                    {group.families.size > 5 && <span>+{group.families.size - 5}</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </section>
      ) : (
        <section className="catalog-results-v6" aria-live="polite">
          <div className="catalog-result-count-v6"><strong>{filtered.length}</strong><span>resultado{filtered.length === 1 ? '' : 's'}</span></div>
          <div className="catalog-result-grid-v6">
            {filtered.map(item => (
              <Link key={item.id} to={`/${item.brand.slug}/${item.family.slug}#guide-${item.id}`} className="catalog-result-card-v6">
                <div className="catalog-result-cover-v6">
                  {(item.cover_url || item.collection?.cover_url) ? <img src={item.cover_url || item.collection.cover_url} alt={`Vehículo ${item.title}`} loading="lazy" decoding="async" /> : <VehiclePlaceholder compact />}
                </div>
                <div className="catalog-result-copy-v6">
                  <span>{item.brand.name} · {item.family.name}</span>
                  <h3>{item.title}</h3>
                  <p>{item.content_kind === 'REFERENCIA' ? 'Material técnico de referencia' : item.content_kind === 'PARCIAL' ? 'Documentación parcial de instalación' : (item.summary || item.equipment || 'Instructivo de instalación')}</p>
                  <span className={`content-kind-mini-v8 ${String(item.content_kind || '').toLowerCase()}`}>{item.content_kind}</span>
                </div>
                <AppIcon name="arrow" size={20} />
              </Link>
            ))}
          </div>
          {filtered.length === 0 && <div className="library-empty">No se encontraron instalaciones.</div>}
        </section>
      )}
    </>
  )
}

export default TechnicalLibrary
