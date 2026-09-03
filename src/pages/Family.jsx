import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { supabase } from '../supabase.js'
import VehiclePlaceholder from '../components/VehiclePlaceholder.jsx'
import InlineGuide from '../components/InlineGuide.jsx'
import AppIcon from '../components/AppIcon.jsx'
import { useEdit } from '../context/EditContext.jsx'
import { getCatalogSnapshot, invalidateCatalogCache, loadCatalogSnapshot } from '../lib/catalogCache.js'
import { slugify } from '../lib/text.js'
import { statusLabel } from '../lib/uiText.js'

function buildFamilyView(snapshot, brandSlug, familySlug) {
  if (!snapshot) return null
  const brand = snapshot.brands.find(item => item.slug === brandSlug)
  if (!brand) return { brand: null, family: null, guides: [], collections: {} }
  const family = snapshot.families.find(item => item.brand_id === brand.id && item.slug === familySlug)
  if (!family) return { brand, family: null, guides: [], collections: {} }
  const rawGuides = snapshot.guides.filter(item => item.family_id === family.id).sort((a, b) => String(a.content_kind || '').localeCompare(String(b.content_kind || '')) || String(a.title || '').localeCompare(String(b.title || '')))
  const guides = rawGuides
  const collections = Object.fromEntries(snapshot.collections.map(item => [item.id, item]))
  return { brand, family, guides, collections }
}

function folderKind(guide) {
  if (guide.content_kind === 'REFERENCIA') return 'Referencia'
  if (guide.content_kind === 'PARCIAL') return 'Parcial'
  if (guide.guide_type === 'BASE') return 'General'
  if (guide.guide_type === 'VARIANTE') return 'Variante'
  return 'Instalación'
}

function Family() {
  const { brandSlug, familySlug } = useParams()
  const navigate = useNavigate()
  const { editing } = useEdit()
  const initialView = buildFamilyView(getCatalogSnapshot(), brandSlug, familySlug)
  const [view, setView] = useState(initialView)
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(!initialView)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [familyEditing, setFamilyEditing] = useState(false)
  const [familyName, setFamilyName] = useState(initialView?.family?.name || '')
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingGuideId, setDeletingGuideId] = useState(null)
  const [newFolder, setNewFolder] = useState({ title: '', equipment: '', guide_type: 'MODELO', content_kind: 'INSTRUCTIVO' })
  const initialHash = String(window.location.hash || '').replace(/^#guide-/, '')
  const [activeGuideId, setActiveGuideId] = useState(initialHash || null)
  const [showReferences, setShowReferences] = useState(false)

  async function loadView(force = false) {
    const snapshot = await loadCatalogSnapshot({ force })
    const next = buildFamilyView(snapshot, brandSlug, familySlug)
    setView(next)
    return next
  }

  useEffect(() => {
    let active = true
    setError('')
    const local = buildFamilyView(getCatalogSnapshot(), brandSlug, familySlug)
    if (local) { setView(local); setFamilyName(local.family?.name || ''); setLoading(false) } else setLoading(true)
    loadCatalogSnapshot().then(async snapshot => {
      if (!active) return
      const next = buildFamilyView(snapshot, brandSlug, familySlug)
      setView(next)
      setFamilyName(next?.family?.name || '')
      if (!next?.brand) throw new Error('No se encontró la marca.')
      if (!next?.family) throw new Error('No se encontró el modelo.')
      const vehicleResult = await supabase.from('vehicles').select('id,name,generation,emission_standard,year_from,year_to,body_type').eq('family_id', next.family.id).order('name')
      if (!active) return
      if (vehicleResult.error) throw vehicleResult.error
      setVehicles(vehicleResult.data || [])
    }).catch(loadError => { if (active) setError(loadError?.message || 'No se pudieron cargar los datos.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [brandSlug, familySlug])

  const brand = view?.brand || null
  const family = view?.family || null
  const guides = view?.guides || []
  const collections = view?.collections || {}
  const instructionGuides = useMemo(() => guides.filter(guide => guide.content_kind !== 'REFERENCIA'), [guides])
  const references = useMemo(() => guides.filter(guide => guide.content_kind === 'REFERENCIA'), [guides])
  const validated = useMemo(() => instructionGuides.filter(guide => guide.status === 'VALIDADA').length, [instructionGuides])
  const allFolders = useMemo(() => [...instructionGuides, ...references], [instructionGuides, references])
  const displayedFolders = useMemo(() => editing || showReferences ? allFolders : instructionGuides, [editing, showReferences, allFolders, instructionGuides])

  useEffect(() => {
    setShowReferences(false)
  }, [brandSlug, familySlug])

  useEffect(() => {
    const hashGuide = allFolders.find(item => String(item.id) === String(initialHash))
    if (hashGuide?.content_kind === 'REFERENCIA') setShowReferences(true)
  }, [allFolders, initialHash])

  useEffect(() => {
    if (!displayedFolders.length) { setActiveGuideId(null); return }
    const hashId = String(window.location.hash || '').replace(/^#guide-/, '')
    const desired = hashId && displayedFolders.some(item => String(item.id) === hashId) ? hashId : activeGuideId
    if (desired && displayedFolders.some(item => String(item.id) === String(desired))) return
    setActiveGuideId(String(displayedFolders[0].id))
  }, [displayedFolders, brandSlug, familySlug, activeGuideId])

  const activeGuide = displayedFolders.find(item => String(item.id) === String(activeGuideId)) || null
  const heroCover = useMemo(() => {
    for (const guide of instructionGuides.length ? instructionGuides : guides) {
      if (guide.cover_url) return guide.cover_url
      const cover = collections[guide.library_collection_id]?.cover_url
      if (cover) return cover
    }
    return ''
  }, [instructionGuides, guides, collections])


  function handleGuideChanged(updated) {
    setView(current => current ? {
      ...current,
      guides: current.guides.map(item => String(item.id) === String(updated.id) ? { ...item, ...updated } : item),
    } : current)
  }

  function openFolder(guide) {
    setActiveGuideId(String(guide.id))
    window.history.replaceState(null, '', `${window.location.pathname}#guide-${guide.id}`)
    requestAnimationFrame(() => document.getElementById('active-subfolder-v127')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function saveFamilyName() {
    const name = familyName.trim()
    if (!editing || !family || !name) return
    const nextSlug = slugify(name)
    const result = await supabase.from('families').update({ name, slug: nextSlug }).eq('id', family.id)
    if (result.error) return setMessage(result.error.message)
    invalidateCatalogCache()
    setFamilyEditing(false)
    setMessage('✓ Nombre del modelo actualizado')
    navigate(`/${brand.slug}/${nextSlug}`, { replace: true })
  }

  async function createSubfolder(event) {
    event.preventDefault()
    const title = newFolder.title.trim()
    if (!editing || !family || !title) return
    setCreating(true)
    const result = await supabase.from('guides').insert({
      family_id: family.id,
      vehicle_id: null,
      base_guide_id: null,
      guide_type: newFolder.guide_type,
      variant: title,
      slug: slugify(title),
      equipment: newFolder.equipment.trim(),
      status: 'BORRADOR',
      content_kind: newFolder.content_kind,
      title,
      summary: '',
    }).select('*').single()
    setCreating(false)
    if (result.error) return setMessage(result.error.message)

    invalidateCatalogCache()
    const createdId = String(result.data.id)
    setCreateOpen(false)
    setNewFolder({ title: '', equipment: '', guide_type: 'MODELO', content_kind: 'INSTRUCTIVO' })
    await loadView(true)
    setActiveGuideId(createdId)
    window.history.replaceState(null, '', `${window.location.pathname}#guide-${createdId}`)
    setMessage('✓ Instalación creada. Ya puede cargar su biblioteca y sus pasos.')
  }

  async function deleteSubfolder(guide) {
    if (!editing || !guide || deletingGuideId) return
    const confirmed = window.confirm([
      `¿Eliminar la instalación “${guide.title}”?`,
      '',
      'Se eliminarán el instructivo, sus pasos y sus asociaciones. Los archivos de la biblioteca general se conservarán por seguridad.',
    ].join('\n'))
    if (!confirmed) return

    setDeletingGuideId(String(guide.id))
    setMessage('Eliminando instalación…')

    try {
      const sectionResult = await supabase.from('guide_sections').select('id').eq('guide_id', guide.id)
      if (sectionResult.error) throw sectionResult.error
      const sectionIds = (sectionResult.data || []).map(item => item.id)

      if (sectionIds.length) {
        const imageResult = await supabase.from('guide_images').select('storage_path').in('guide_section_id', sectionIds)
        if (!imageResult.error) {
          const storagePaths = (imageResult.data || []).map(item => item.storage_path).filter(Boolean)
          if (storagePaths.length) await supabase.storage.from('guide-images').remove(storagePaths)
        }

        const linkDelete = await supabase.from('guide_section_assets').delete().in('guide_section_id', sectionIds)
        if (linkDelete.error) throw linkDelete.error
        const imageDelete = await supabase.from('guide_images').delete().in('guide_section_id', sectionIds)
        if (imageDelete.error) throw imageDelete.error
        const sectionDelete = await supabase.from('guide_sections').delete().in('id', sectionIds)
        if (sectionDelete.error) throw sectionDelete.error
      }

      const libraryLinkDelete = await supabase.from('guide_library_links').delete().eq('guide_id', guide.id)
      if (libraryLinkDelete.error) throw libraryLinkDelete.error

      // Si otra guía la usaba como base, la desacoplamos antes de borrar.
      const baseDetach = await supabase.from('guides').update({ base_guide_id: null }).eq('base_guide_id', guide.id)
      if (baseDetach.error) throw baseDetach.error

      const guideDelete = await supabase.from('guides').delete().eq('id', guide.id)
      if (guideDelete.error) throw guideDelete.error

      // La colección general se conserva si tiene archivos. Si está vacía y quedó huérfana,
      // la limpiamos para no llenar la biblioteca con carpetas vacías.
      if (guide.library_collection_id) {
        const [usedByGuide, usedByLink, assetCount] = await Promise.all([
          supabase.from('guides').select('id', { count: 'exact', head: true }).eq('library_collection_id', guide.library_collection_id),
          supabase.from('guide_library_links').select('guide_id', { count: 'exact', head: true }).eq('collection_id', guide.library_collection_id),
          supabase.from('library_assets').select('id', { count: 'exact', head: true }).eq('collection_id', guide.library_collection_id),
        ])
        if (!usedByGuide.error && !usedByLink.error && !assetCount.error && (usedByGuide.count || 0) === 0 && (usedByLink.count || 0) === 0 && (assetCount.count || 0) === 0) {
          await supabase.from('library_collections').delete().eq('id', guide.library_collection_id)
        }
      }

      invalidateCatalogCache()
      const deletedId = String(guide.id)
      const nextView = await loadView(true)
      const remaining = nextView?.guides || []
      const nextGuide = remaining.find(item => String(item.id) !== deletedId) || null
      setActiveGuideId(nextGuide ? String(nextGuide.id) : null)
      window.history.replaceState(null, '', window.location.pathname + (nextGuide ? `#guide-${nextGuide.id}` : ''))
      setMessage('✓ Instalación eliminada. Los archivos de su biblioteca se conservaron si había material cargado.')
    } catch (deleteError) {
      setMessage(deleteError?.message || 'No se pudo eliminar la instalación.')
    } finally {
      setDeletingGuideId(null)
    }
  }

  if (loading && !view) return <div className="page-card skeleton-card-v124">Cargando instalaciones…</div>
  if (error && !family) return <div className="page-card">{error}</div>

  return (
    <>
      <Link to={`/${brandSlug}`} className="back-link-v6">← {brand?.name}</Link>

      <header className="family-hero-v9">
        <div className="family-hero-image-v9">
          {heroCover ? <img src={heroCover} alt={`${brand?.name} ${family?.name}`} loading="eager" fetchPriority="high" decoding="async" /> : <VehiclePlaceholder label={`Imagen no disponible para ${family?.name}`} />}
        </div>
        <div className="family-hero-copy-v9">
          <div className="page-eyebrow">{brand?.name}</div>
          <div className="editable-title-row-v127">
            {editing && familyEditing
              ? <input className="structure-title-input-v127" value={familyName} onChange={event => setFamilyName(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Enter') saveFamilyName(); if (event.key === 'Escape') setFamilyEditing(false) }} />
              : <h1>{family?.name}</h1>}
            {editing && (familyEditing
              ? <div className="structure-inline-actions-v127"><button type="button" onClick={saveFamilyName}>Guardar</button><button type="button" onClick={() => { setFamilyEditing(false); setFamilyName(family?.name || '') }}>Cancelar</button></div>
              : <button type="button" className="structure-pencil-v127" onClick={() => setFamilyEditing(true)} title="Editar nombre del modelo"><AppIcon name="edit" size={16} /></button>)}
          </div>
          <p>Consulte la instalación de este modelo y los registros técnicos asociados.</p>
          <div className="family-hero-stats-v9">
            <div><strong>{instructionGuides.length}</strong><span>Instalaciones</span></div>
            <div><strong>{validated}</strong><span>Validadas</span></div>
            <div><strong>{references.length}</strong><span>Referencias</span></div>
          </div>
          {editing && message && <div className="structure-message-v127">{message}</div>}
        </div>
      </header>

      <section className="subfolder-section-v127">
        <div className="section-heading-v9 structure-heading-v127">
          <div><span>INSTALACIONES DEL MODELO</span><h2>Procedimientos de instalación</h2><p>Consulte el procedimiento de montaje correspondiente. Las referencias técnicas adicionales se mantienen disponibles aparte.</p></div>
          <div className="family-content-actions-v1273">
            {references.length > 0 && <button type="button" className="reference-toggle-v1273" onClick={() => setShowReferences(current => !current)}>{showReferences ? 'Ocultar referencias' : `Mostrar referencias (${references.length})`}</button>}
            {editing && <button type="button" className="create-subfolder-v127" onClick={() => setCreateOpen(current => !current)}>+ Nueva instalación</button>}
          </div>
        </div>

        {editing && createOpen && (
          <form className="subfolder-create-panel-v127" onSubmit={createSubfolder}>
            <label><span>Nombre de la instalación</span><input value={newFolder.title} onChange={event => setNewFolder(current => ({ ...current, title: event.target.value }))} placeholder="Ej.: Daily Euro 6 · DG-600" autoFocus /></label>
            <label><span>Equipo</span><input value={newFolder.equipment} onChange={event => setNewFolder(current => ({ ...current, equipment: event.target.value }))} placeholder="Ej.: FMD-1000" /></label>
            <label><span>Tipo</span><select value={newFolder.guide_type} onChange={event => setNewFolder(current => ({ ...current, guide_type: event.target.value }))}><option value="MODELO">Instalación</option><option value="VARIANTE">Variante</option><option value="BASE">General</option></select></label>
            <label><span>Contenido</span><select value={newFolder.content_kind} onChange={event => setNewFolder(current => ({ ...current, content_kind: event.target.value }))}><option value="INSTRUCTIVO">Instructivo</option><option value="PARCIAL">Parcial</option><option value="REFERENCIA">Referencia</option></select></label>
            <div><button type="button" onClick={() => setCreateOpen(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={creating || !newFolder.title.trim()}>{creating ? 'Creando…' : 'Crear instalación'}</button></div>
          </form>
        )}

        <div className="subfolder-grid-v127">
          {displayedFolders.map((guide, index) => {
            const cover = guide.cover_url || collections[guide.library_collection_id]?.cover_url || ''
            const active = String(guide.id) === String(activeGuideId)
            return (
              <div key={guide.id} className={`subfolder-card-shell-v1272 ${active ? 'active' : ''}`}>
                <button type="button" className={`subfolder-card-v127 ${active ? 'active' : ''}`} onClick={() => openFolder(guide)}>
                  <div className="subfolder-cover-v127">{cover ? <img src={cover} alt="" loading={index < 4 ? 'eager' : 'lazy'} decoding="async" /> : <VehiclePlaceholder label="Imagen no disponible" />}</div>
                  <div className="subfolder-copy-v127"><span>{folderKind(guide)}</span><strong>{guide.title}</strong><small>{guide.equipment || 'Equipo no especificado'} · {statusLabel(guide.status)}</small></div>
                  <AppIcon name="arrow" size={18} />
                </button>
                {editing && (
                  <button
                    type="button"
                    className="subfolder-delete-v1272"
                    onClick={() => deleteSubfolder(guide)}
                    disabled={String(deletingGuideId) === String(guide.id)}
                    title="Eliminar instalación"
                    aria-label={`Eliminar instalación ${guide.title}`}
                  >
                    <AppIcon name="trash" size={15} />
                  </button>
                )}
              </div>
            )
          })}
          {displayedFolders.length === 0 && <div className="page-card">{editing ? 'No hay instalaciones todavía. Cree la primera con “Nueva instalación”.' : references.length > 0 ? 'Este modelo no tiene una instalación documentada. Puede consultar sus referencias técnicas.' : 'No hay una instalación documentada para este modelo.'}</div>}
        </div>
      </section>

      {activeGuide && (
        <section id="active-subfolder-v127" className="active-subfolder-v127">
          <InlineGuide key={activeGuide.id} guideSummary={activeGuide} brand={brand} family={family} priority onGuideChanged={handleGuideChanged} />
        </section>
      )}

      {vehicles.length > 0 && (
        <section className="family-section-v6 family-models-v9">
          <div className="section-heading-v9"><span>VERSIONES REGISTRADAS</span><h2>Datos del catálogo</h2></div>
          <div className="vehicle-grid vehicle-grid-v6">
            {vehicles.map(vehicle => <div key={vehicle.id} className="vehicle-card vehicle-card-v6"><strong>{vehicle.name}</strong><span>{[vehicle.emission_standard, vehicle.generation, vehicle.year_from && vehicle.year_to ? `${vehicle.year_from}–${vehicle.year_to}` : vehicle.year_from ? `Desde ${vehicle.year_from}` : '', vehicle.body_type].filter(Boolean).join(' · ')}</span></div>)}
          </div>
        </section>
      )}
    </>
  )
}

export default Family
