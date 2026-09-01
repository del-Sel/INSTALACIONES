import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import VehiclePlaceholder from '../components/VehiclePlaceholder.jsx'
import AppIcon from '../components/AppIcon.jsx'
import fulmarLogo from '../assets/fulmar-logo.jpg'
import { getCatalogSnapshot, loadCatalogSnapshot } from '../lib/catalogCache.js'

function Home() {
  const initial = getCatalogSnapshot()
  const [snapshot, setSnapshot] = useState(initial)
  const [loading, setLoading] = useState(!initial)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    loadCatalogSnapshot()
      .then(data => { if (active) setSnapshot(data) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const brands = snapshot?.brands || []
  const families = snapshot?.families || []
  const guides = snapshot?.guides || []
  const collections = snapshot?.collections || []
  const validatedGuides = guides.filter(guide => guide.status === 'VALIDADA').length

  const brandMeta = useMemo(() => {
    const familyById = new Map(families.map(family => [family.id, family]))
    const collectionById = new Map(collections.map(collection => [collection.id, collection]))
    const meta = {}

    for (const guide of guides) {
      const family = familyById.get(guide.family_id)
      if (!family) continue
      const current = (meta[family.brand_id] ??= { count: 0, validated: 0, families: new Set(), covers: [] })
      current.count += 1
      current.families.add(family.id)
      if (guide.status === 'VALIDADA') current.validated += 1

      const cover = guide.cover_url || collectionById.get(guide.library_collection_id)?.cover_url
      if (cover && !current.covers.includes(cover) && current.covers.length < 4) current.covers.push(cover)
    }

    return meta
  }, [families, guides, collections])

  const visibleBrands = brands.filter(brand => (brandMeta[brand.id]?.count || 0) > 0)

  function buscar(event) {
    event.preventDefault()
    const q = query.trim()
    if (q) navigate(`/buscar?q=${encodeURIComponent(q)}`)
  }

  return (
    <>
      <section className="home-hero-v6">
        <div className="home-hero-copy-v6">
          <img src={fulmarLogo} alt="FUL-MAR" className="home-hero-logo-v6" fetchPriority="high" decoding="async" />
          <div className="page-eyebrow">BASE TÉCNICA INTERNA</div>
          <h1>Documentación técnica por vehículo</h1>
          <p>Consulte instructivos, instalaciones parciales y referencias técnicas organizadas por marca, modelo y sistema.</p>
        </div>

        <div className="home-hero-side-v13">
          <div className="home-search-panel-v1271">
            <form className="home-search-v6" onSubmit={buscar} role="search">
              <AppIcon name="search" size={21} />
              <label htmlFor="home-search" className="sr-only">Buscar en la documentación técnica</label>
              <input
                id="home-search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Buscar por marca, modelo o sistema..."
                autoComplete="off"
              />
              <button type="submit">Buscar</button>
            </form>
          </div>

          <div className="home-summary-v6" aria-label="Resumen de la biblioteca técnica">
            <div><strong>{brands.length}</strong><span>Marcas</span></div>
            <div><strong>{families.length}</strong><span>Modelos</span></div>
            <div><strong>{guides.length}</strong><span>Documentos</span></div>
            <div><strong>{validatedGuides}</strong><span>Validados</span></div>
          </div>
        </div>
      </section>

      <section className="home-section-v6">
        <div className="section-heading-v6">
          <div>
            <span className="section-label-v6">Acceso rápido</span>
            <h2>Marcas disponibles</h2>
            <p>Seleccione una marca para consultar sus modelos, instructivos y referencias técnicas.</p>
          </div>
        </div>

        {loading && !snapshot ? (
          <div className="page-card skeleton-card-v124" aria-live="polite">Cargando marcas…</div>
        ) : (
          <div className="home-brand-grid-v6">
            {visibleBrands.map((brand, index) => {
              const meta = brandMeta[brand.id] || { count: 0, validated: 0, families: new Set(), covers: [] }
              const cover = meta.covers[0]

              return (
                <Link key={brand.id} to={`/${brand.slug}`} className="home-brand-card-v6">
                  <div className="home-brand-cover-v6">
                    {cover ? <img src={cover} alt={`Vehículo ${brand.name}`} loading={index < 4 ? 'eager' : 'lazy'} fetchPriority={index < 2 ? 'high' : 'auto'} decoding="async" /> : <VehiclePlaceholder label={`Imagen no disponible para ${brand.name}`} />}
                  </div>
                  <div className="home-brand-copy-v6">
                    <div>
                      <span>Marca</span>
                      <h3>{brand.name}</h3>
                    </div>
                    <p>{meta.count} {meta.count === 1 ? 'instalación' : 'instalaciones'} · {meta.families.size} {meta.families.size === 1 ? 'familia' : 'familias'}</p>
                    <div className="home-brand-card-footer-v6"><span>{meta.validated} {meta.validated === 1 ? 'documento validado' : 'documentos validados'}</span><AppIcon name="arrow" size={18} /></div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

export default Home
