import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../supabase.js'
import AppIcon from '../components/AppIcon.jsx'
import { getCatalogSnapshot } from '../lib/catalogCache.js'

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

  useEffect(() => { buscar(params.get('q') || '') }, [params])

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
    const pattern = `%${text}%`
    const q = text.toLowerCase()
    const cached = getCatalogSnapshot()

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

    setBrands(b.data || [])
    setFamilies(f.data || [])
    setVehicles(v.data || [])
    setGuides([...byId.values()])
    setLoading(false)
  }

  const count = useMemo(() => brands.length + families.length + vehicles.length + guides.length, [brands, families, vehicles, guides])

  return (
    <>
      <header className="search-header-v6">
        <div className="page-eyebrow">BÚSQUEDA</div>
        <h1>Buscar instalación</h1>
        <p>Buscá por marca, familia, modelo o información técnica.</p>
      </header>

      <form className="search-form-v6" onSubmit={event => { event.preventDefault(); setParams(q.trim() ? { q: q.trim() } : {}) }}>
        <AppIcon name="search" size={22} />
        <label htmlFor="search-page-input" className="sr-only">Buscar instalación</label>
        <input id="search-page-input" value={q} onChange={event => setQ(event.target.value)} placeholder="Ej.: Daily, Sprinter, CAN2, FMS..." autoComplete="off" />
        <button>Buscar</button>
      </form>

      {loading ? <div className="page-card">Buscando...</div> : (
        <section className="search-results-v6" aria-live="polite">
          <div className="search-results-count-v6">{params.get('q') ? <><strong>{count}</strong> resultado{count === 1 ? '' : 's'}</> : 'Escribí algo para buscar.'}</div>

          {guides.map(item => (
            <Link key={`g${item.id}`} to={`/${item.families?.brands?.slug}/${item.families?.slug}#guide-${item.id}`} className="search-item-v6">
              <div className="search-item-icon-v6"><AppIcon name="installations" size={20} /></div>
              <div className="search-item-copy-v6"><span>{item.content_kind === 'REFERENCIA' ? 'REFERENCIA TÉCNICA' : item.content_kind === 'PARCIAL' ? 'INSTALACIÓN PARCIAL' : 'INSTRUCTIVO'}</span><strong>{item.title}</strong><small>{item.families?.brands?.name} · {item.families?.name}</small></div>
              <span className={item.status === 'VALIDADA' ? 'guide-status valid' : 'guide-status draft'}>{item.status === 'VALIDADA' ? 'VALIDADA' : 'BORRADOR'}</span>
            </Link>
          ))}

          {families.map(item => (
            <Link key={`f${item.id}`} to={`/${item.brands?.slug}/${item.slug}`} className="search-item-v6">
              <div className="search-item-icon-v6"><AppIcon name="truck" size={20} /></div>
              <div className="search-item-copy-v6"><span>FAMILIA</span><strong>{item.brands?.name} {item.name}</strong></div>
              <AppIcon name="arrow" size={18} />
            </Link>
          ))}

          {vehicles.map(item => (
            <Link key={`v${item.id}`} to={`/${item.families?.brands?.slug}/${item.families?.slug}`} className="search-item-v6">
              <div className="search-item-icon-v6"><AppIcon name="truck" size={20} /></div>
              <div className="search-item-copy-v6"><span>MODELO</span><strong>{item.name}</strong><small>{item.families?.brands?.name} · {item.families?.name}</small></div>
              <AppIcon name="arrow" size={18} />
            </Link>
          ))}

          {brands.map(item => (
            <Link key={`b${item.id}`} to={`/${item.slug}`} className="search-item-v6">
              <div className="search-item-icon-v6"><AppIcon name="truck" size={20} /></div>
              <div className="search-item-copy-v6"><span>MARCA</span><strong>{item.name}</strong></div>
              <AppIcon name="arrow" size={18} />
            </Link>
          ))}
        </section>
      )}
    </>
  )
}

export default Search
