import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import VehiclePlaceholder from '../components/VehiclePlaceholder.jsx'
import AppIcon from '../components/AppIcon.jsx'
import { useEdit } from '../context/EditContext.jsx'
import { supabase } from '../supabase.js'
import { getCatalogSnapshot, invalidateCatalogCache, loadCatalogSnapshot } from '../lib/catalogCache.js'
import { slugify } from '../lib/text.js'

function buildView(snapshot, brandSlug) {
  if (!snapshot) return null
  const brand = snapshot.brands.find(item => item.slug === brandSlug)
  if (!brand) return { brand: null, families: [], meta: {} }

  const families = snapshot.families.filter(item => item.brand_id === brand.id).sort((a, b) => a.name.localeCompare(b.name))
  const ids = new Set(families.map(item => item.id))
  const collectionMap = new Map(snapshot.collections.map(item => [item.id, item]))
  const meta = {}

  for (const guide of snapshot.guides) {
    if (!ids.has(guide.family_id)) continue
    const current = (meta[guide.family_id] ??= { count: 0, references: 0, validated: 0, covers: [] })
    if (guide.content_kind === 'REFERENCIA') current.references += 1
    else current.count += 1
    if (guide.content_kind !== 'REFERENCIA' && guide.status === 'VALIDADA') current.validated += 1
    const cover = guide.cover_url || collectionMap.get(guide.library_collection_id)?.cover_url
    if (cover && !current.covers.includes(cover) && current.covers.length < 4) current.covers.push(cover)
  }

  return { brand, families, meta }
}

function Brand() {
  const { brandSlug } = useParams()
  const navigate = useNavigate()
  const { editing } = useEdit()
  const cached = getCatalogSnapshot()
  const initialView = buildView(cached, brandSlug)
  const [view, setView] = useState(initialView)
  const [loading, setLoading] = useState(!initialView)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [brandEditing, setBrandEditing] = useState(false)
  const [brandName, setBrandName] = useState(initialView?.brand?.name || '')
  const [familyEditingId, setFamilyEditingId] = useState(null)
  const [familyName, setFamilyName] = useState('')
  const [creatingFamily, setCreatingFamily] = useState(false)
  const [newFamilyName, setNewFamilyName] = useState('')

  async function refresh(force = true) {
    const data = await loadCatalogSnapshot({ force })
    const next = buildView(data, brandSlug)
    setView(next)
    return next
  }

  useEffect(() => {
    let active = true
    const local = buildView(getCatalogSnapshot(), brandSlug)
    if (local) {
      setView(local)
      setBrandName(local.brand?.name || '')
      setLoading(false)
    } else setLoading(true)
    setError('')

    loadCatalogSnapshot()
      .then(data => {
        if (!active) return
        const next = buildView(data, brandSlug)
        if (!next?.brand) setError('No se pudo cargar la marca.')
        setView(next)
        setBrandName(next?.brand?.name || '')
      })
      .catch(() => { if (active) setError('No se pudo cargar la marca.') })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [brandSlug])

  const brand = view?.brand || null
  const families = view?.families || []
  const meta = view?.meta || {}
  const visibleFamilies = editing ? families : families.filter(family => ((meta[family.id]?.count || 0) + (meta[family.id]?.references || 0)) > 0)
  const totalGuides = visibleFamilies.reduce((sum, family) => sum + (meta[family.id]?.count || 0), 0)
  const totalValidated = visibleFamilies.reduce((sum, family) => sum + (meta[family.id]?.validated || 0), 0)
  const heroCover = useMemo(() => {
    for (const family of visibleFamilies) {
      const cover = meta[family.id]?.covers?.[0]
      if (cover) return cover
    }
    return ''
  }, [visibleFamilies, meta])

  async function saveBrandName() {
    const name = brandName.trim()
    if (!editing || !brand || !name) return
    const newSlug = slugify(name)
    const oldName = brand.name
    const result = await supabase.from('brands').update({ name, slug: newSlug }).eq('id', brand.id)
    if (result.error) return setMessage(result.error.message)
    // Mantiene alineadas las colecciones históricas cuando usan el nombre de marca como clave.
    await supabase.from('library_collections').update({ source_brand: name }).eq('source_brand', oldName)
    invalidateCatalogCache()
    setBrandEditing(false)
    setMessage('✓ Marca actualizada')
    navigate(`/${newSlug}`, { replace: true })
  }

  async function saveFamilyName(family) {
    const name = familyName.trim()
    if (!editing || !family || !name) return
    const result = await supabase.from('families').update({ name, slug: slugify(name) }).eq('id', family.id)
    if (result.error) return setMessage(result.error.message)
    invalidateCatalogCache()
    setFamilyEditingId(null)
    setMessage('✓ Modelo actualizado')
    await refresh(true)
  }

  async function createFamily(event) {
    event.preventDefault()
    const name = newFamilyName.trim()
    if (!editing || !brand || !name) return
    setCreatingFamily(true)
    const result = await supabase.from('families').insert({ brand_id: brand.id, name, slug: slugify(name) }).select('*').single()
    setCreatingFamily(false)
    if (result.error) return setMessage(result.error.message)
    invalidateCatalogCache()
    setNewFamilyName('')
    setMessage('✓ Modelo creado. Ya podés crear subcarpetas dentro.')
    navigate(`/${brand.slug}/${result.data.slug}`)
  }

  if (loading && !view) return <div className="page-card skeleton-card-v124">Cargando marca…</div>
  if (error && !brand) return <div className="page-card">{error}</div>

  return (
    <>
      <Link to="/biblioteca" className="back-link-v6">← Instalaciones</Link>

      <header className="brand-hero-v6">
        <div className="brand-hero-image-v6">
          {heroCover ? <img src={heroCover} alt={`Vehículo ${brand?.name}`} loading="eager" fetchPriority="high" decoding="async" /> : <VehiclePlaceholder label={`Sin foto general de ${brand?.name}`} />}
        </div>
        <div className="brand-hero-content-v6">
          <div className="page-eyebrow">MARCA</div>
          <div className="editable-title-row-v127">
            {editing && brandEditing
              ? <input className="structure-title-input-v127" value={brandName} onChange={event => setBrandName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveBrandName(); if (event.key === 'Escape') setBrandEditing(false) }} autoFocus />
              : <h1>{brand?.name}</h1>}
            {editing && (brandEditing
              ? <div className="structure-inline-actions-v127"><button type="button" onClick={saveBrandName}>Guardar</button><button type="button" onClick={() => { setBrandEditing(false); setBrandName(brand?.name || '') }}>Cancelar</button></div>
              : <button type="button" className="structure-pencil-v127" onClick={() => { setBrandName(brand?.name || ''); setBrandEditing(true) }} title="Editar nombre de la marca"><AppIcon name="edit" size={16} /></button>)}
          </div>
          <p>Seleccioná un modelo para acceder a sus subcarpetas, instalaciones y material técnico.</p>
          <div className="brand-stats-row-v6">
            <div><strong>{visibleFamilies.length}</strong><span>Modelos</span></div>
            <div><strong>{totalGuides}</strong><span>Instalaciones</span></div>
            <div><strong>{totalValidated}</strong><span>Validadas</span></div>
          </div>
          {editing && message && <div className="structure-message-v127">{message}</div>}
        </div>
      </header>

      <section className="brand-section-v6">
        <div className="section-heading-v6 structure-heading-v127">
          <div>
            <span className="section-label-v6">MODELOS</span>
            <h2>Vehículos disponibles</h2>
            <p>Entrá a un modelo para ver y administrar sus subcarpetas.</p>
          </div>
          {editing && (
            <form className="create-structure-inline-v127" onSubmit={createFamily}>
              <input value={newFamilyName} onChange={event => setNewFamilyName(event.target.value)} placeholder="Nombre del nuevo modelo" />
              <button type="submit" disabled={creatingFamily || !newFamilyName.trim()}>+ {creatingFamily ? 'Creando…' : 'Crear modelo'}</button>
            </form>
          )}
        </div>

        <div className="family-card-grid-v6">
          {visibleFamilies.map((family, index) => {
            const current = meta[family.id] || { count: 0, references: 0, validated: 0, covers: [] }
            const cover = current.covers[0]
            const editingThis = editing && familyEditingId === family.id
            return (
              <article key={family.id} className="family-card-shell-v127">
                <Link to={`/${brand.slug}/${family.slug}`} className="family-card-v6">
                  <div className="family-card-cover-v6">
                    {cover ? <img src={cover} alt={`${brand?.name} ${family.name}`} loading={index < 3 ? 'eager' : 'lazy'} decoding="async" /> : <VehiclePlaceholder label={`Sin foto de ${family.name}`} />}
                  </div>
                  <div className="family-card-copy-v6">
                    <span>{brand?.name}</span>
                    <h2>{family.name}</h2>
                    <p>{current.count} instalación{current.count === 1 ? '' : 'es'} · {current.references} referencia{current.references === 1 ? '' : 's'}</p>
                    <div className="family-card-action-v6">Abrir modelo <AppIcon name="arrow" size={17} /></div>
                  </div>
                </Link>
                {editing && !editingThis && <button type="button" className="family-card-edit-v127" onClick={() => { setFamilyEditingId(family.id); setFamilyName(family.name) }} title="Editar nombre del modelo"><AppIcon name="edit" size={15} /></button>}
                {editingThis && (
                  <div className="family-rename-popover-v127">
                    <input value={familyName} onChange={event => setFamilyName(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Enter') saveFamilyName(family); if (event.key === 'Escape') setFamilyEditingId(null) }} />
                    <button type="button" onClick={() => saveFamilyName(family)}>Guardar</button>
                    <button type="button" onClick={() => setFamilyEditingId(null)}>×</button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      {visibleFamilies.length === 0 && <div className="page-card">{editing ? 'Todavía no hay modelos. Creá el primero desde arriba.' : 'No hay instalaciones registradas para esta marca.'}</div>}
    </>
  )
}

export default Brand
