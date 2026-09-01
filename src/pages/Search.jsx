import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../supabase.js'
import AppIcon from '../components/AppIcon.jsx'
import { getCatalogSnapshot, loadCatalogSnapshot } from '../lib/catalogCache.js'
import { contentKindBadgeLabel, statusLabel } from '../lib/uiText.js'

function visibleSearchGuides(items = []) {
  return (items || []).filter(item => item?.title !== '__OCULTA__')
}

function Search() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [brands, setBrands] = useState([])
  const [families, setFamilies] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [guides, setGuides] = useState([])
  const [loading, setLoading] = useState(false)
  const [catalog, setCatalog] = useState(() => getCatalogSnapshot())
  const [kindFilter, setKindFilter] = useState('TODOS')
  const [brandFilter, setBrandFilter] = useState('TODOS')
  const [searchError, setSearchError] = useState('')

  useEffect(() => { buscar(params.get('q') || '') }, [params])

  useEffect(() => {
    let active = true
    loadCatalogSnapshot()
      .then(data => { if (active) setCatalog(data) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  async function buscar(term) {
    const text = term.trim()
    if (!text) {
      setBrands([])
      setFamilies([])
      setVehicles([])
      setGuides([])
      setLoading(false)
      return
    }

    setLoading(true)
    setSearchError('')
    const pattern = `%${text}%`
    const q = text.toLowerCase()
    const cached = getCatalogSnapshot()
    if (cached) setCatalog(cached)

    // Si el catálogo ya fue cargado por Inicio/Layout, mostramos coincidencias al instante.
    if (cached) {
      const brandById = new Map(cached.brands.map(item => [item.id, item]))
      const familyById = new Map(cached.families.map(item => [item.id, item]))
      const localBrands = cached.brands.filter(item => item.name.toLowerCase().includes(q)).slice(0, 20)
      const localFamilies = cached.families
        .filter(item => item.name.toLowerCase().includes(q))
        .slice(0, 30)
        .map(item => ({ ...item, brands: brandById.get(item.brand_id) || null }))
      const localGuides = cached.guides
        .filter(item => `${item.title || ''} ${item.summary || ''} ${item.equipment || ''} ${item.variant || ''}`.toLowerCase().includes(q))
        .slice(0, 80)
        .map(item => {
          const family = familyById.get(item.family_id)
          return { ...item, families: family ? { ...family, brands: brandById.get(family.brand_id) || null } : null }
        })

      setBrands(localBrands)
      setFamilies(localFamilies)
      setGuides(localGuides)
      setLoading(false)

      // Sólo buscamos en servidor lo que no está en el snapshot: modelos y texto interno de secciones.
      const [vehicleResult, sectionResult] = await Promise.all([
        supabase.from('vehicles').select('id,name,family_id,families(name,slug,brands(name,slug))').ilike('name', pattern).limit(50),
        supabase.from('guide_sections').select('guide_id').ilike('content', pattern).limit(250),
      ])
      setVehicles(vehicleResult.data || [])

      if (vehicleResult.error || sectionResult.error) setSearchError('La búsqueda se completó parcialmente. Algunos contenidos internos no están disponibles en este momento.')

      const byId = new Map(localGuides.map(item => [item.id, item]))
      const sectionGuideIds = [...new Set((sectionResult.data || []).map(row => row.guide_id))].filter(id => !byId.has(id))
      if (sectionGuideIds.length) {
        const extra = await supabase
          .from('guides')
          .select('id,title,slug,family_id,summary,status,content_kind,families(name,slug,brands(name,slug))')
          .in('id', sectionGuideIds)
          .limit(100)
        for (const item of visibleSearchGuides(extra.data)) byId.set(item.id, item)
        setGuides([...byId.values()])
      }
      return
    }

    // Entrada directa a /buscar sin catálogo precargado: conserva la búsqueda completa.
    const [b, f, v, g, sectionResult] = await Promise.all([
      supabase.from('brands').select('id,name,slug').ilike('name', pattern).limit(20),
      supabase.from('families').select('id,name,slug,brand_id,brands(name,slug)').ilike('name', pattern).limit(30),
      supabase.from('vehicles').select('id,name,family_id,families(name,slug,brands(name,slug))').ilike('name', pattern).limit(50),
      supabase.from('guides').select('id,title,slug,family_id,summary,status,content_kind,families(name,slug,brands(name,slug))').or(`title.ilike.${pattern},summary.ilike.${pattern}`).limit(80),
      supabase.from('guide_sections').select('guide_id').ilike('content', pattern).limit(250),
    ])

    const byId = new Map(visibleSearchGuides(g.data).map(item => [item.id, item]))
    const sectionGuideIds = [...new Set((sectionResult.data || []).map(row => row.guide_id))].filter(id => !byId.has(id))
    if (sectionGuideIds.length) {
      const extra = await supabase
        .from('guides')
        .select('id,title,slug,family_id,summary,status,content_kind,families(name,slug,brands(name,slug))')
        .in('id', sectionGuideIds)
        .limit(100)
      for (const item of visibleSearchGuides(extra.data)) byId.set(item.id, item)
    }

    if (b.error || f.error || v.error || g.error || sectionResult.error) setSearchError('La búsqueda se completó parcialmente. Algunos resultados no están disponibles en este momento.')
    setBrands(b.data || [])
    setFamilies(f.data || [])
    setVehicles(v.data || [])
    setGuides([...byId.values()])
    setLoading(false)
  }

  const brandOptions = useMemo(() => {
    const items = catalog?.brands || [...brands]
    return [...items].sort((a, b) => a.name.localeCompare(b.name))
  }, [catalog, brands])

  const visibleGuides = useMemo(() => guides.filter(item => {
    const kind = item.content_kind || 'INSTRUCTIVO'
    return (kindFilter === 'TODOS' || kind === kindFilter) && (brandFilter === 'TODOS' || item.families?.brands?.slug === brandFilter)
  }), [guides, kindFilter, brandFilter])
  const visibleFamilies = useMemo(() => families.filter(item => brandFilter === 'TODOS' || item.brands?.slug === brandFilter), [families, brandFilter])
  const visibleVehicles = useMemo(() => vehicles.filter(item => brandFilter === 'TODOS' || item.families?.brands?.slug === brandFilter), [vehicles, brandFilter])
  const visibleBrands = useMemo(() => brands.filter(item => brandFilter === 'TODOS' || item.slug === brandFilter), [brands, brandFilter])
  const count = useMemo(() => visibleGuides.length + (kindFilter === 'TODOS' ? visibleBrands.length + visibleFamilies.length + visibleVehicles.length : 0), [visibleBrands, visibleFamilies, visibleVehicles, visibleGuides, kindFilter])
  const hasQuery = Boolean(params.get('q'))
  const hasFilters = kindFilter !== 'TODOS' || brandFilter !== 'TODOS'

  return (
    <>
      <header className="search-header-v6">
        <div className="page-eyebrow">BÚSQUEDA</div>
        <h1>Buscar documentación técnica</h1>
        <p>Realice búsquedas por marca, familia, modelo, equipo o contenido técnico.</p>
      </header>

      <form className="search-form-v6" onSubmit={event => { event.preventDefault(); setParams(q.trim() ? { q: q.trim() } : {}) }}>
        <AppIcon name="search" size={22} />
        <label htmlFor="search-page-input" className="sr-only">Buscar en la documentación técnica</label>
        <input id="search-page-input" value={q} onChange={event => setQ(event.target.value)} placeholder="Ej.: Daily, Sprinter, CAN2 o FMS" autoComplete="off" />
        <button type="submit">Buscar</button>
      </form>

      <div className="search-filters-v13" aria-label="Filtros de búsqueda">
        <label>
          <span>Tipo de documento</span>
          <select value={kindFilter} onChange={event => setKindFilter(event.target.value)} aria-label="Filtrar por tipo de documento">
            <option value="TODOS">Todos los tipos</option>
            <option value="INSTRUCTIVO">Instructivos</option>
            <option value="PARCIAL">Instalaciones parciales</option>
            <option value="REFERENCIA">Referencias técnicas</option>
          </select>
        </label>
        <label>
          <span>Marca</span>
          <select value={brandFilter} onChange={event => setBrandFilter(event.target.value)} aria-label="Filtrar por marca">
            <option value="TODOS">Todas las marcas</option>
            {brandOptions.map(brand => <option key={brand.id} value={brand.slug}>{brand.name}</option>)}
          </select>
        </label>
        {hasFilters && <button type="button" className="search-clear-filters-v13" onClick={() => { setKindFilter('TODOS'); setBrandFilter('TODOS') }}>Restablecer filtros</button>}
      </div>

      {loading ? <div className="page-card" role="status">Consultando documentación…</div> : (
        <section className="search-results-v6" aria-live="polite">
          {searchError && <div className="search-notice-v13" role="status">{searchError}</div>}
          <div className="search-results-count-v6">{hasQuery || hasFilters ? <><strong>{count}</strong> {count === 1 ? 'resultado disponible' : 'resultados disponibles'}</> : 'Ingrese un criterio para iniciar la búsqueda.'}</div>

          {visibleGuides.map(item => (
            <Link key={`g${item.id}`} to={`/${item.families?.brands?.slug}/${item.families?.slug}#guide-${item.id}`} className="search-item-v6">
              <div className="search-item-icon-v6"><AppIcon name="installations" size={20} /></div>
              <div className="search-item-copy-v6"><span>{contentKindBadgeLabel(item.content_kind)}</span><strong>{item.title}</strong><small>{item.families?.brands?.name} · {item.families?.name}</small></div>
              <span className={item.status === 'VALIDADA' ? 'guide-status valid' : 'guide-status draft'}>{statusLabel(item.status)}</span>
            </Link>
          ))}

          {kindFilter === 'TODOS' && visibleFamilies.map(item => (
            <Link key={`f${item.id}`} to={`/${item.brands?.slug}/${item.slug}`} className="search-item-v6">
              <div className="search-item-icon-v6"><AppIcon name="truck" size={20} /></div>
              <div className="search-item-copy-v6"><span>FAMILIA</span><strong>{item.brands?.name} {item.name}</strong></div>
              <AppIcon name="arrow" size={18} />
            </Link>
          ))}

          {kindFilter === 'TODOS' && visibleVehicles.map(item => (
            <Link key={`v${item.id}`} to={`/${item.families?.brands?.slug}/${item.families?.slug}`} className="search-item-v6">
              <div className="search-item-icon-v6"><AppIcon name="truck" size={20} /></div>
              <div className="search-item-copy-v6"><span>MODELO</span><strong>{item.name}</strong><small>{item.families?.brands?.name} · {item.families?.name}</small></div>
              <AppIcon name="arrow" size={18} />
            </Link>
          ))}

          {kindFilter === 'TODOS' && visibleBrands.map(item => (
            <Link key={`b${item.id}`} to={`/${item.slug}`} className="search-item-v6">
              <div className="search-item-icon-v6"><AppIcon name="truck" size={20} /></div>
              <div className="search-item-copy-v6"><span>MARCA</span><strong>{item.name}</strong></div>
              <AppIcon name="arrow" size={18} />
            </Link>
          ))}

          {(hasQuery || hasFilters) && count === 0 && <div className="search-empty-v13"><strong>No se encontraron resultados</strong><span>Verifique el término ingresado o ajuste los filtros de búsqueda.</span></div>}
        </section>
      )}
    </>
  )
}

export default Search
