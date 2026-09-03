import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import VehiclePlaceholder from '../components/VehiclePlaceholder.jsx'
import AppIcon from '../components/AppIcon.jsx'
import fulmarLogo from '../assets/fulmar-logo.jpg'
import { getCatalogSnapshot, loadCatalogSnapshot } from '../lib/catalogCache.js'
import { formatUpdatedDate, countLabel } from '../lib/uiText.js'

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
  const guideLinks = snapshot?.guideLinks || []
  const totalFiles = useMemo(() => collections.reduce((sum, item) => sum + Number(item.file_count || 0), 0), [collections])

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

  const modelItems = useMemo(() => {
    const brandById = new Map(brands.map(brand => [brand.id, brand]))
    const guideById = new Map(guides.map(guide => [guide.id, guide]))
    const guidesByFamily = new Map()
    const collectionFamilyIds = new Map()

    for (const guide of guides) {
      if (!guidesByFamily.has(guide.family_id)) guidesByFamily.set(guide.family_id, [])
      guidesByFamily.get(guide.family_id).push(guide)
      if (guide.library_collection_id) collectionFamilyIds.set(guide.library_collection_id, guide.family_id)
    }

    for (const link of guideLinks) {
      const guide = guideById.get(link.guide_id)
      if (guide && link.collection_id && !collectionFamilyIds.has(link.collection_id)) collectionFamilyIds.set(link.collection_id, guide.family_id)
    }

    const collectionsByFamily = new Map()
    for (const collection of collections) {
      const familyId = collectionFamilyIds.get(collection.id)
      if (familyId == null) continue
      if (!collectionsByFamily.has(familyId)) collectionsByFamily.set(familyId, [])
      collectionsByFamily.get(familyId).push(collection)
    }

    return families
      .map(family => {
        const familyGuides = guidesByFamily.get(family.id) || []
        const familyCollections = collectionsByFamily.get(family.id) || []
        const brand = brandById.get(family.brand_id)
        const cover = familyGuides.map(guide => guide.cover_url).find(Boolean)
          || familyCollections.map(collection => collection.cover_url).find(Boolean)
        const fileCount = familyCollections.reduce((sum, item) => sum + Number(item.file_count || 0), 0)
        return { family, brand, guides: familyGuides, collections: familyCollections, cover, fileCount }
      })
      .filter(item => item.brand && (item.guides.length > 0 || item.collections.length > 0))
      .sort((a, b) => `${a.brand.name} ${a.family.name}`.localeCompare(`${b.brand.name} ${b.family.name}`))
  }, [brands, families, guides, collections, guideLinks])

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
            <div><strong>{collections.length}</strong><span>Bibliotecas</span></div>
            <div><strong>{totalFiles}</strong><span>Archivos</span></div>
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

      {modelItems.length > 0 && (
        <section className="home-section-v6" aria-labelledby="home-documents-title">
          <div className="section-heading-v6">
            <div>
              <span className="section-label-v6">CATÁLOGO COMPLETO</span>
              <h2 id="home-documents-title">Documentación por modelo</h2>
              <p>Las instalaciones son el contenido principal. Las pruebas y referencias se conservan dentro de cada modelo como contexto técnico.</p>
            </div>
            <span className="home-section-count-v13">{countLabel(modelItems.length, 'modelo', 'modelos')}</span>
          </div>

          <div className="home-document-grid-v13">
            {modelItems.map(({ family, brand, guides: familyGuides, collections: familyCollections, cover, fileCount }) => {
              const kindCounts = familyGuides.reduce((counts, guide) => {
                const kind = guide.content_kind || 'INSTRUCTIVO'
                counts[kind] = (counts[kind] || 0) + 1
                return counts
              }, {})
              const installationCount = (kindCounts.INSTRUCTIVO || 0) + (kindCounts.PARCIAL || 0)
              const referenceCount = kindCounts.REFERENCIA || 0
              return (
                <Link key={family.id} to={`/${brand.slug}/${family.slug}`} className="home-document-card-v13">
                  <div className="home-document-cover-v13">
                    {cover ? <img src={cover} alt={`Vehículo ${brand.name} · ${family.name}`} loading="lazy" decoding="async" /> : <VehiclePlaceholder compact />}
                  </div>
                  <div className="home-document-copy-v13">
                    <span className="home-document-path-v13">{brand.name}</span>
                    <h3>{family.name}</h3>
                    <p>{countLabel(installationCount, 'instalación', 'instalaciones')} · {countLabel(familyCollections.length, 'biblioteca', 'bibliotecas')} · {countLabel(fileCount, 'archivo', 'archivos')}</p>
                    <div className="home-document-meta-v13">
                      {kindCounts.INSTRUCTIVO > 0 && <span className="content-kind-mini-v8 instructivo">{kindCounts.INSTRUCTIVO} instructivos</span>}
                      {kindCounts.PARCIAL > 0 && <span className="content-kind-mini-v8 parcial">{kindCounts.PARCIAL} parciales</span>}
                      {referenceCount > 0 && <span className="content-kind-mini-v8 referencia">{referenceCount} referencias</span>}
                    </div>
                    <small>{familyGuides.length > 0 ? `Última actualización: ${formatUpdatedDate(familyGuides.map(guide => guide.updated_at).filter(Boolean).sort().slice(-1)[0])}` : 'Material técnico disponible'}</small>
                  </div>
                  <AppIcon name="arrow" size={19} />
                </Link>
              )
            })}
          </div>
        </section>
      )}

    </>
  )
}

export default Home
