import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase.js'
import { useEdit } from '../context/EditContext.jsx'
import { safeFileName } from '../lib/text.js'
import { invalidateCatalogCache } from '../lib/catalogCache.js'
import { assetContextGroup, assetDisplayLabel, assetIcon, assetLabel, detectedAssetDescription, detectedAssetPreview, detectedAssetType, formatBytes, isBrowserImage, isBrowserVideo } from '../lib/library.js'
import { visibleGuideAssets } from '../lib/guide.js'
import AppIcon from '../components/AppIcon.jsx'
import VehiclePlaceholder from '../components/VehiclePlaceholder.jsx'
import fulmarLogo from '../assets/fulmar-logo.jpg'


function AssetIdentification({ asset }) {
  const type = detectedAssetType(asset)
  const description = detectedAssetDescription(asset)
  const preview = detectedAssetPreview(asset)

  if (!description && !preview && type === assetLabel(asset.asset_type)) return null

  return (
    <div className="asset-identification-v81">
      <span className="asset-detected-type-v81">{type}</span>
      {description && <p>{description}</p>}
      {preview && (
        <details>
          <summary>Vista previa técnica</summary>
          <pre>{preview}</pre>
        </details>
      )}
    </div>
  )
}

function friendlyType(type) {
  return { BASE: 'GENERAL', VARIANTE: 'VARIANTE', MODELO: 'INSTALACIÓN' }[type] || type
}

const META_LABEL_SECTION_TYPE = 'v1272_meta_labels'
const DEFAULT_META_LABELS = {
  equipment: 'Equipo',
  variant: 'Subcarpeta / variante',
  guideType: 'Tipo de guía',
  year: 'Año / versión',
  sections: 'Apartados principales',
  material: 'Material asociado',
  sectionsValue: '',
  materialValue: '',
}

function parseMetaLabels(section) {
  if (!section?.content) return { ...DEFAULT_META_LABELS }
  try {
    const parsed = JSON.parse(section.content)
    return { ...DEFAULT_META_LABELS, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
  } catch {
    return { ...DEFAULT_META_LABELS }
  }
}

function metaLabelsEqual(a = {}, b = {}) {
  return Object.keys(DEFAULT_META_LABELS).every(key => String(a?.[key] || '') === String(b?.[key] || ''))
}

function isDisplayableImageAsset(asset = {}) {
  if (asset?.asset_type !== 'image') return false
  if (isBrowserImage(asset?.extension || '')) return true
  const mime = String(asset?.mime_type || asset?.metadata?.mime_type || asset?.metadata?.content_type || '').toLowerCase()
  if (mime.startsWith('image/')) return true
  const url = String(asset?.public_url || '').split('?')[0].toLowerCase()
  return /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(url)
}

function paragraphs(content = '') {
  const clean = String(content || '').replace(/\r/g, '').trim()
  if (!clean) return []
  const byBlank = clean.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean)
  if (byBlank.length > 1) return byBlank
  return clean.split('\n').map(x => x.trim()).filter(Boolean)
}

function InlineGuide({ guideSummary, brand, family, priority = false, onGuideChanged }) {
  const { editing: globalEditing } = useEdit()
  const [guideEditOpen, setGuideEditOpen] = useState(false)
  const editing = globalEditing && guideEditOpen
  const rootRef = useRef(null)
  const [shouldLoad, setShouldLoad] = useState(Boolean(priority))

  const [guide, setGuide] = useState(null)
  const [originalGuide, setOriginalGuide] = useState(null)
  const [metaLabels, setMetaLabels] = useState({ ...DEFAULT_META_LABELS })
  const [originalMetaLabels, setOriginalMetaLabels] = useState({ ...DEFAULT_META_LABELS })
  const [metaLabelSectionId, setMetaLabelSectionId] = useState(null)
  const [sections, setSections] = useState([])
  const [assets, setAssets] = useState([])
  const [collection, setCollection] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [coverPicker, setCoverPicker] = useState(false)
  const [assetPickerSectionId, setAssetPickerSectionId] = useState(null)
  const [assetPickerSearch, setAssetPickerSearch] = useState('')
  const [assetPickerType, setAssetPickerType] = useState('images')
  const [assetPickerReturn, setAssetPickerReturn] = useState(null)
  const [assigningAssetId, setAssigningAssetId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!globalEditing) setGuideEditOpen(false)
  }, [globalEditing])

  useEffect(() => {
    setGuideEditOpen(false)
  }, [guideSummary?.id])

  useEffect(() => {
    if (priority) {
      setShouldLoad(true)
      return undefined
    }

    const node = rootRef.current
    if (!node || !('IntersectionObserver' in window)) {
      setShouldLoad(true)
      return undefined
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setShouldLoad(true)
        observer.disconnect()
      }
    }, { rootMargin: '1200px 0px' })

    observer.observe(node)
    return () => observer.disconnect()
  }, [guideSummary?.id, priority])

  useEffect(() => {
    if (shouldLoad) cargarGuia()
  }, [guideSummary?.id, shouldLoad, editing])

  useEffect(() => {
    const close = event => {
      if (event.key === 'Escape') {
        setSelectedImage(null)
        setCoverPicker(false)
        setAssetPickerSectionId(null)
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])

  useEffect(() => {
    if (!assetPickerSectionId) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [assetPickerSectionId])

  async function cargarGuia() {
    if (!guideSummary?.id) return
    setLoading(true)
    setError('')

    // Primera ronda: todo lo que depende solamente del ID de la guía viaja en paralelo.
    const [guideResult, sectionResult, libraryLinkResult] = await Promise.all([
      supabase.from('guides').select('*').eq('id', guideSummary.id).single(),
      supabase.from('guide_sections').select('*').eq('guide_id', guideSummary.id).order('sort_order'),
      supabase.from('guide_library_links').select('collection_id,sort_order').eq('guide_id', guideSummary.id).order('sort_order'),
    ])

    if (guideResult.error) {
      setError('No se pudo cargar esta instalación.')
      setLoading(false)
      return
    }
    if (sectionResult.error) {
      setError('No se pudieron cargar las secciones.')
      setLoading(false)
      return
    }

    const g = guideResult.data
    const rawSectionData = sectionResult.data || []
    const metaLabelSection = rawSectionData.find(section => section.section_type === META_LABEL_SECTION_TYPE) || null
    const sectionData = rawSectionData.filter(section => section.section_type !== META_LABEL_SECTION_TYPE)
    const loadedMetaLabels = parseMetaLabels(metaLabelSection)
    setGuide(g)
    setOriginalGuide(g)
    setMetaLabels(loadedMetaLabels)
    setOriginalMetaLabels(loadedMetaLabels)
    setMetaLabelSectionId(metaLabelSection?.id || null)

    const sectionIds = sectionData.map(section => section.id)
    const collectionIds = new Set()
    if (g.library_collection_id) collectionIds.add(g.library_collection_id)
    if (!libraryLinkResult.error) {
      for (const item of libraryLinkResult.data || []) collectionIds.add(item.collection_id)
    }

    const ids = [...collectionIds]

    // Segunda ronda: imágenes, vínculos y biblioteca también se resuelven en paralelo.
    const [imageResult, sectionAssetResult, collectionResult, assetResult] = await Promise.all([
      sectionIds.length
        ? supabase.from('guide_images').select('*').in('guide_section_id', sectionIds).order('sort_order')
        : Promise.resolve({ data: [], error: null }),
      sectionIds.length
        ? supabase.from('guide_section_assets').select('guide_section_id,library_asset_id,sort_order').in('guide_section_id', sectionIds).order('sort_order')
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? supabase.from('library_collections').select('*').in('id', ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? supabase.from('library_assets').select('*').in('collection_id', ids).order('sort_order')
        : Promise.resolve({ data: [], error: null }),
    ])

    const manualImages = imageResult.data || []
    const sectionAssetLinks = sectionAssetResult.data || []
    const collectionRows = collectionResult.data || []
    const libraryAssets = assetResult.data || []

    setCollection(collectionRows.find(item => item.id === g.library_collection_id) || collectionRows[0] || null)
    setAssets(libraryAssets)

    const assetById = new Map(libraryAssets.map(asset => [asset.id, asset]))
    const linkedBySection = new Map()
    for (const link of sectionAssetLinks) {
      const asset = assetById.get(link.library_asset_id)
      if (!asset) continue
      if (!linkedBySection.has(link.guide_section_id)) linkedBySection.set(link.guide_section_id, [])
      linkedBySection.get(link.guide_section_id).push({ ...asset, link_sort_order: Number(link.sort_order || 0), link_section_id: link.guide_section_id })
    }

    const imagesBySection = new Map()
    for (const image of manualImages) {
      const { data } = supabase.storage.from('guide-images').getPublicUrl(image.storage_path)
      const hydrated = { ...image, publicUrl: data.publicUrl }
      if (!imagesBySection.has(image.guide_section_id)) imagesBySection.set(image.guide_section_id, [])
      imagesBySection.get(image.guide_section_id).push(hydrated)
    }

    const hydratedSections = sectionData.map(section => ({
      ...section,
      original_title: section.title,
      original_content: section.content || '',
      original_sort_order: section.sort_order,
      linkedAssets: (linkedBySection.get(section.id) || []).sort((a, b) => Number(a.link_sort_order || 0) - Number(b.link_sort_order || 0)),
      images: (imagesBySection.get(section.id) || []).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    }))

    setSections(hydratedSections)

    setLoading(false)
  }

  const visibleAssets = useMemo(() => visibleGuideAssets(assets), [assets])
  const cover = guide?.cover_url || ''

  const imageAssets = useMemo(
    () => visibleAssets.filter(isDisplayableImageAsset),
    [visibleAssets],
  )

  const linkedAssetIds = useMemo(() => {
    const ids = new Set()
    for (const section of sections) {
      for (const asset of section.linkedAssets || []) ids.add(asset.id)
    }
    return ids
  }, [sections])

  const unlinkedAssets = useMemo(
    () => visibleAssets.filter(asset => !linkedAssetIds.has(asset.id)),
    [visibleAssets, linkedAssetIds],
  )

  // En modo edición mantenemos visible toda la biblioteca. Así una imagen no desaparece
  // de golpe al asignarla y la página no cambia de altura ni pierde la posición.
  const materialAssets = useMemo(
    () => editing ? visibleAssets : unlinkedAssets,
    [editing, visibleAssets, unlinkedAssets],
  )

  const materialGroups = useMemo(() => {
    const groups = new Map()
    for (const asset of materialAssets) {
      const label = assetContextGroup(asset)
      if (!groups.has(label)) groups.set(label, [])
      groups.get(label).push(asset)
    }
    return [...groups.entries()]
  }, [materialAssets])

  const assetPickerSection = useMemo(
    () => sections.find(section => Number(section.id) === Number(assetPickerSectionId)) || null,
    [sections, assetPickerSectionId],
  )

  const assetPickerSourceAssets = useMemo(() => {
    const merged = new Map()
    for (const asset of visibleAssets) {
      if (asset?.id != null) merged.set(Number(asset.id), asset)
    }
    return [...merged.values()]
  }, [visibleAssets])

  const assetPickerCandidates = useMemo(() => {
    if (!assetPickerSection) return []
    const query = assetPickerSearch.trim().toLowerCase()

    return assetPickerSourceAssets
      .filter(asset => assetPickerType === 'all' || (assetPickerType === 'images' && isDisplayableImageAsset(asset)))
      .filter(asset => {
        if (!query) return true
        return `${asset.filename || ''} ${assetDisplayLabel(asset)} ${assetContextGroup(asset)} ${asset._picker_collection_title || ''}`.toLowerCase().includes(query)
      })
      .sort((a, b) => {
        const imageA = isDisplayableImageAsset(a) ? 0 : 1
        const imageB = isDisplayableImageAsset(b) ? 0 : 1
        if (imageA !== imageB) return imageA - imageB
        return assetContextGroup(a).localeCompare(assetContextGroup(b)) || String(a.filename || '').localeCompare(String(b.filename || ''))
      })
  }, [assetPickerSection, assetPickerSearch, assetPickerType, assetPickerSourceAssets])

  const visibleSections = useMemo(() => sections.filter(section => editing || (section.content || '').trim() || section.linkedAssets?.length || section.images?.length), [sections, editing])
  const mainSections = visibleSections
  const contentKind = guide?.content_kind || 'INSTRUCTIVO'
  const isReference = contentKind === 'REFERENCIA'
  const isPartial = contentKind === 'PARCIAL'

  const hasUnsavedChanges = useMemo(() => {
    if (!guide || !originalGuide) return false

    const guideFields = ['title', 'summary', 'equipment', 'status', 'variant', 'content_kind', 'guide_type', 'year_text']
    if (guideFields.some(field => String(guide?.[field] ?? '') !== String(originalGuide?.[field] ?? ''))) return true

    if (!metaLabelsEqual(metaLabels, originalMetaLabels)) return true

    return sections.some(section =>
      section.title !== section.original_title ||
      (section.content || '') !== (section.original_content || '') ||
      Number(section.sort_order || 0) !== Number(section.original_sort_order || 0)
    )
  }, [guide, originalGuide, sections, metaLabels, originalMetaLabels])

  useEffect(() => {
    if (!editing) return
    const onKeyDown = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveAll()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing, guide, sections, originalGuide, metaLabels, originalMetaLabels])

  useEffect(() => {
    if (!editing || !hasUnsavedChanges) return
    const beforeUnload = event => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [editing, hasUnsavedChanges])

  function changeGuide(field, value) {
    setGuide(current => ({ ...current, [field]: value }))
  }

  function changeMetaLabel(field, value) {
    setMetaLabels(current => ({ ...current, [field]: value }))
  }

  function metaLabel(field) {
    const editValue = String(metaLabels?.[field] ?? DEFAULT_META_LABELS[field])
    const displayValue = editValue.trim() || DEFAULT_META_LABELS[field]
    if (!editing) return <span>{displayValue}</span>
    return (
      <span className="meta-label-editor-v1272">
        <input
          className="meta-label-input-v1272"
          value={editValue}
          onChange={event => changeMetaLabel(field, event.target.value)}
          aria-label={`Editar rótulo ${DEFAULT_META_LABELS[field]}`}
        />
      </span>
    )
  }

  function changeSection(id, field, value) {
    setSections(current => current.map(section => section.id === id ? { ...section, [field]: value } : section))
  }

  async function saveAll() {
    if (!editing || !guide || saving) return

    const guideSnapshot = { ...guide }
    const metaLabelsSnapshot = { ...metaLabels }
    const sectionSnapshots = sections.map(section => ({
      id: section.id,
      title: section.title,
      content: section.content || '',
      sort_order: Number(section.sort_order || 0),
      original_title: section.original_title,
      original_content: section.original_content || '',
      original_sort_order: Number(section.original_sort_order || 0),
    }))

    setSaving(true)
    setMessage('Guardando cambios…')

    try {
      const guideResult = await supabase.from('guides').update({
        title: guideSnapshot.title,
        summary: guideSnapshot.summary || '',
        equipment: guideSnapshot.equipment || '',
        status: guideSnapshot.status,
        variant: guideSnapshot.variant || null,
        cover_url: guideSnapshot.cover_url || null,
        content_kind: guideSnapshot.content_kind || 'INSTRUCTIVO',
        guide_type: guideSnapshot.guide_type || 'MODELO',
        year_text: guideSnapshot.year_text || null,
        updated_at: new Date().toISOString(),
      }).eq('id', guideSnapshot.id)

      if (guideResult.error) throw guideResult.error

      const changedSections = sectionSnapshots.filter(section =>
        section.title !== section.original_title ||
        section.content !== section.original_content ||
        section.sort_order !== section.original_sort_order
      )

      if (changedSections.length) {
        const results = await Promise.all(changedSections.map(section =>
          supabase.from('guide_sections').update({
            title: section.title,
            content: section.content,
            sort_order: section.sort_order,
          }).eq('id', section.id)
        ))
        const sectionError = results.find(result => result.error)?.error
        if (sectionError) throw sectionError
      }

      if (!metaLabelsEqual(metaLabelsSnapshot, originalMetaLabels)) {
        const payload = {
          section_type: META_LABEL_SECTION_TYPE,
          title: '__META_LABELS__',
          content: JSON.stringify(metaLabelsSnapshot),
          sort_order: -9999,
        }
        if (metaLabelSectionId) {
          const labelsResult = await supabase.from('guide_sections').update(payload).eq('id', metaLabelSectionId)
          if (labelsResult.error) throw labelsResult.error
        } else {
          const labelsResult = await supabase.from('guide_sections').insert({ guide_id: guideSnapshot.id, ...payload }).select('id').single()
          if (labelsResult.error) throw labelsResult.error
          setMetaLabelSectionId(labelsResult.data?.id || null)
        }
      }

      invalidateCatalogCache()
      if (onGuideChanged) onGuideChanged({ ...guideSnapshot })
      // Marcamos como guardado exactamente lo que llegó al servidor. Si el usuario
      // siguió escribiendo durante el request, ese texto continúa figurando como pendiente.
      setOriginalGuide(guideSnapshot)
      setOriginalMetaLabels(metaLabelsSnapshot)
      const savedById = new Map(sectionSnapshots.map(section => [section.id, section]))
      setSections(current => current.map(section => {
        const saved = savedById.get(section.id)
        if (!saved) return section
        return {
          ...section,
          original_title: saved.title,
          original_content: saved.content,
          original_sort_order: saved.sort_order,
        }
      }))
      setMessage('✓ Guardado · puede continuar editando sin perder su ubicación')
    } catch (saveError) {
      setMessage(saveError.message || 'No se pudieron guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  async function addSection() {
    if (!editing || !guide) return
    const maxOrder = sections.reduce((max, section) => Math.max(max, Number(section.sort_order || 0)), 0)
    const type = `v12_main_notes_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`

    const result = await supabase.from('guide_sections').insert({
      guide_id: guide.id,
      section_type: type,
      title: 'Nuevo apartado',
      content: '',
      sort_order: maxOrder + 10,
    }).select('*').single()

    if (result.error) {
      setMessage(result.error.message)
      return
    }

    const created = {
      ...result.data,
      original_title: result.data.title,
      original_content: result.data.content || '',
      original_sort_order: result.data.sort_order,
      linkedAssets: [],
      images: [],
    }
    setSections(current => [...current, created].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)))
    setMessage('Apartado agregado · edite el título y el texto')
    requestAnimationFrame(() => document.getElementById(`section-${created.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  async function deleteSection(section) {
    if (!editing) return
    if (!confirm(`¿Eliminar la sección “${section.title}”?`)) return
    const result = await supabase.from('guide_sections').delete().eq('id', section.id)
    if (result.error) {
      setMessage(result.error.message)
      return
    }
    setSections(current => current.filter(item => item.id !== section.id))
    setMessage('Apartado eliminado · sin recargar')
  }

  async function moveSection(section, direction) {
    if (!editing) return
    const ordered = [...sections].sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    const index = ordered.findIndex(item => item.id === section.id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return

    const target = ordered[targetIndex]
    const firstOrder = Number(section.sort_order)
    const secondOrder = Number(target.sort_order)

    const [first, second] = await Promise.all([
      supabase.from('guide_sections').update({ sort_order: secondOrder }).eq('id', section.id),
      supabase.from('guide_sections').update({ sort_order: firstOrder }).eq('id', target.id),
    ])

    if (first.error || second.error) {
      setMessage(first.error?.message || second.error?.message || 'No se pudo reordenar')
      return
    }

    setSections(current => current
      .map(item => {
        if (item.id === section.id) return { ...item, sort_order: secondOrder, original_sort_order: secondOrder }
        if (item.id === target.id) return { ...item, sort_order: firstOrder, original_sort_order: firstOrder }
        return item
      })
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)))
    setMessage('Orden actualizado · sin recargar')
  }

  async function uploadManualImages(section, fileList) {
    if (!editing) return
    const files = Array.from(fileList || [])
    if (!files.length) return

    setMessage(`Subiendo ${files.length} imagen${files.length === 1 ? '' : 'es'}…`)
    const baseOrder = (section.images || []).length

    const results = await Promise.allSettled(files.map(async (file, index) => {
      const storagePath = `sections/${section.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`
      const upload = await supabase.storage.from('guide-images').upload(storagePath, file, { cacheControl: '31536000', upsert: false })
      if (upload.error) throw upload.error

      const insert = await supabase.from('guide_images').insert({
        guide_section_id: section.id,
        storage_path: storagePath,
        caption: '',
        alt_text: section.title,
        sort_order: (baseOrder + index + 1) * 10,
      }).select('*').single()

      if (insert.error) {
        await supabase.storage.from('guide-images').remove([storagePath])
        throw insert.error
      }

      const { data } = supabase.storage.from('guide-images').getPublicUrl(storagePath)
      return { ...insert.data, publicUrl: data.publicUrl }
    }))

    const added = results.filter(result => result.status === 'fulfilled').map(result => result.value)
    const failed = results.length - added.length

    if (added.length) {
      setSections(current => current.map(item => item.id === section.id
        ? { ...item, images: [...(item.images || []), ...added].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)) }
        : item))
    }

    if (failed) {
      setMessage(`${added.length ? `✓ ${added.length} subida${added.length === 1 ? '' : 's'} · ` : ''}${failed} imagen${failed === 1 ? '' : 'es'} no se pudieron subir`)
    } else {
      setMessage(`✓ ${added.length} imagen${added.length === 1 ? '' : 'es'} agregada${added.length === 1 ? '' : 's'} · sin recargar`)
    }
  }

  async function deleteManualImage(image) {
    if (!editing || !confirm('¿Eliminar esta imagen agregada a la guía?')) return
    const del = await supabase.from('guide_images').delete().eq('id', image.id)
    if (del.error) {
      setMessage(del.error.message)
      return
    }
    await supabase.storage.from('guide-images').remove([image.storage_path])
    setSections(current => current.map(section => ({
      ...section,
      images: (section.images || []).filter(item => item.id !== image.id),
    })))
    setMessage('Imagen eliminada · sin recargar')
  }

  async function updateImageCaption(image, caption) {
    if ((image.caption || '') === caption) return
    const result = await supabase.from('guide_images').update({ caption }).eq('id', image.id)
    if (result.error) {
      setMessage(result.error.message)
      return
    }
    setSections(current => current.map(section => ({
      ...section,
      images: (section.images || []).map(item => item.id === image.id ? { ...item, caption } : item),
    })))
    setMessage('Descripción de imagen guardada')
  }

  function classifyLibraryFile(file) {
    const name = String(file?.name || '').toLowerCase()
    const mime = String(file?.type || '').toLowerCase()
    const dot = name.lastIndexOf('.')
    const extension = dot >= 0 ? name.slice(dot) : ''
    if (mime.startsWith('image/') || ['.jpg','.jpeg','.png','.webp','.gif','.bmp','.avif'].includes(extension)) return { asset_type: 'image', extension }
    if (mime.startsWith('video/') || ['.mp4','.webm','.mov','.avi','.mkv'].includes(extension)) return { asset_type: 'video', extension }
    if (['.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.odt','.ods'].includes(extension)) return { asset_type: 'document', extension }
    if (['.txt','.md','.rtf'].includes(extension)) return { asset_type: 'text', extension }
    if (['.can','.asc','.blf'].includes(extension)) return { asset_type: 'can-data', extension }
    return { asset_type: 'data', extension }
  }

  async function ensureGeneralLibrary() {
    if (!editing || !guide) throw new Error('Abrí la guía con el lápiz para modificar su biblioteca.')
    if (guide.library_collection_id && collection) return collection

    if (guide.library_collection_id && !collection) {
      const existing = await supabase.from('library_collections').select('*').eq('id', guide.library_collection_id).single()
      if (!existing.error && existing.data) {
        setCollection(existing.data)
        return existing.data
      }
    }

    const title = `${brand?.name || 'FUL-MAR'} · ${family?.name || 'Modelo'} · ${guide.title || 'Biblioteca'}`
    const create = await supabase.from('library_collections').insert({
      title,
      source_brand: brand?.name || '',
      description: `Biblioteca general de ${guide.title || family?.name || 'esta instalación'}.`,
    }).select('*').single()
    if (create.error) throw create.error

    const linkGuide = await supabase.from('guides').update({ library_collection_id: create.data.id }).eq('id', guide.id)
    if (linkGuide.error) {
      await supabase.from('library_collections').delete().eq('id', create.data.id)
      throw linkGuide.error
    }

    setCollection(create.data)
    setGuide(current => ({ ...current, library_collection_id: create.data.id }))
    setOriginalGuide(current => ({ ...current, library_collection_id: create.data.id }))
    invalidateCatalogCache()
    return create.data
  }

  async function refreshLibraryStats(collectionId, currentAssets) {
    if (!collectionId) return
    const rows = visibleGuideAssets(currentAssets || [])
    const stats = {
      file_count: rows.length,
      image_count: rows.filter(item => item.asset_type === 'image').length,
      video_count: rows.filter(item => item.asset_type === 'video').length,
      document_count: rows.filter(item => item.asset_type === 'document').length,
      can_data_count: rows.filter(item => item.asset_type === 'can-data').length,
      size_bytes: rows.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0),
    }
    const update = await supabase.from('library_collections').update(stats).eq('id', collectionId).select('*').single()
    if (!update.error && update.data) setCollection(update.data)
  }

  async function uploadGeneralLibraryFiles(fileList) {
    if (!editing || !guide) return
    const files = Array.from(fileList || []).filter(Boolean)
    if (!files.length) return
    setMessage(`Preparando biblioteca general · ${files.length} archivo${files.length === 1 ? '' : 's'}…`)

    try {
      const targetCollection = await ensureGeneralLibrary()
      const baseOrder = Math.max(0, ...assets.map(item => Number(item.sort_order || 0)))
      const uploaded = []

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const info = classifyLibraryFile(file)
        const storagePath = `library/${guide.id}/${crypto.randomUUID()}-${safeFileName(file.name || `archivo-${index + 1}`)}`
        const storage = await supabase.storage.from('guide-images').upload(storagePath, file, { cacheControl: '31536000', upsert: false, contentType: file.type || undefined })
        if (storage.error) throw storage.error
        const { data: urlData } = supabase.storage.from('guide-images').getPublicUrl(storagePath)

        const row = {
          collection_id: targetCollection.id,
          original_path: `editor/${file.name || storagePath}`,
          relative_path: file.name || storagePath,
          filename: file.name || `Archivo ${index + 1}`,
          public_url: urlData.publicUrl,
          asset_type: info.asset_type,
          extension: info.extension,
          sort_order: baseOrder + ((index + 1) * 10),
          size_bytes: Number(file.size || 0),
          metadata: {
            source: 'editor',
            mime_type: file.type || '',
            display_label: file.name || `Archivo ${index + 1}`,
            context_group: 'Biblioteca general',
            storage_bucket: 'guide-images',
            storage_path: storagePath,
          },
        }
        const insert = await supabase.from('library_assets').insert(row).select('*').single()
        if (insert.error) {
          await supabase.storage.from('guide-images').remove([storagePath])
          throw insert.error
        }
        uploaded.push(insert.data)
      }

      const nextAssets = [...assets, ...uploaded]
      setAssets(nextAssets)
      await refreshLibraryStats(targetCollection.id, nextAssets)
      invalidateCatalogCache()
      setMessage(`✓ ${uploaded.length} archivo${uploaded.length === 1 ? '' : 's'} agregado${uploaded.length === 1 ? '' : 's'} a la biblioteca general`)
    } catch (uploadError) {
      console.error(uploadError)
      setMessage(uploadError?.message || 'No se pudieron subir los archivos a la biblioteca general.')
    }
  }

  function startGuideEdit() {
    if (!globalEditing) return
    setGuideEditOpen(true)
  }

  function closeGuideEdit() {
    if (hasUnsavedChanges && !confirm('Hay cambios pendientes. ¿Cerrar igualmente la edición de esta guía?')) return
    setGuideEditOpen(false)
  }

  function openAssetPicker(section) {
    if (!section?.id) return
    const trigger = document.getElementById(`asset-picker-trigger-${section.id}`)
    setAssetPickerReturn({
      sectionId: section.id,
      triggerTop: trigger?.getBoundingClientRect().top ?? null,
    })
    setAssetPickerSearch('')
    setAssetPickerType('images')
    setAssetPickerSectionId(section.id)
  }

  function closeAssetPicker() {
    const returnPoint = assetPickerReturn
    setAssetPickerSectionId(null)
    setAssetPickerSearch('')
    setAssigningAssetId(null)

    // Mantiene exactamente el lugar desde donde se abrió el selector.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!returnPoint?.sectionId || returnPoint.triggerTop == null) return
      const trigger = document.getElementById(`asset-picker-trigger-${returnPoint.sectionId}`)
      if (!trigger) return
      const currentTop = trigger.getBoundingClientRect().top
      window.scrollBy({ top: currentTop - returnPoint.triggerTop, left: 0, behavior: 'auto' })
      trigger.querySelector('button')?.focus({ preventScroll: true })
    }))
  }

  async function addAssetFromPicker(asset) {
    if (!assetPickerSection || !asset?.id || assigningAssetId) return
    setAssigningAssetId(asset.id)
    await linkExistingAsset(assetPickerSection, asset.id)
    setAssigningAssetId(null)
  }

  function linkedSectionNames(assetId) {
    return sections
      .filter(section => (section.linkedAssets || []).some(asset => Number(asset.id) === Number(assetId)))
      .map(section => section.title || 'Apartado')
  }

  async function linkExistingAsset(section, assetId) {
    if (!editing || !section?.id || !assetId) return
    const current = section.linkedAssets || []
    const nextOrder = Math.max(0, ...current.map(item => Number(item.link_sort_order || 0))) + 10
    const numericId = Number(assetId)
    const result = await supabase.from('guide_section_assets').insert({
      guide_section_id: section.id,
      library_asset_id: numericId,
      sort_order: nextOrder,
    })
    if (result.error) {
      setMessage(result.error.message)
      return
    }

    const asset = assets.find(item => Number(item.id) === numericId)
    if (asset) {
      setSections(currentSections => currentSections.map(item => item.id === section.id
        ? { ...item, linkedAssets: [...(item.linkedAssets || []), { ...asset, link_sort_order: nextOrder, link_section_id: section.id }] }
        : item))
    }
    setMessage('Material vinculado · sin recargar')
  }

  async function unlinkExistingAsset(section, asset) {
    if (!editing || !section?.id || !asset?.id) return
    const result = await supabase.from('guide_section_assets').delete()
      .eq('guide_section_id', section.id)
      .eq('library_asset_id', asset.id)
    if (result.error) {
      setMessage(result.error.message)
      return
    }

    setSections(current => current.map(item => item.id === section.id
      ? { ...item, linkedAssets: (item.linkedAssets || []).filter(linked => linked.id !== asset.id) }
      : item))
    setMessage('Material quitado · sin recargar')
  }

  async function moveLinkedAsset(section, asset, direction) {
    if (!editing || !section?.id || !asset?.id) return
    const ordered = [...(section.linkedAssets || [])].sort((a, b) => Number(a.link_sort_order || 0) - Number(b.link_sort_order || 0))
    const index = ordered.findIndex(item => item.id === asset.id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return

    const target = ordered[targetIndex]
    const firstOrder = Number(asset.link_sort_order || ((index + 1) * 10))
    const secondOrder = Number(target.link_sort_order || ((targetIndex + 1) * 10))

    const [first, second] = await Promise.all([
      supabase.from('guide_section_assets').update({ sort_order: secondOrder }).eq('guide_section_id', section.id).eq('library_asset_id', asset.id),
      supabase.from('guide_section_assets').update({ sort_order: firstOrder }).eq('guide_section_id', section.id).eq('library_asset_id', target.id),
    ])
    if (first.error || second.error) {
      setMessage(first.error?.message || second.error?.message || 'No se pudo reordenar el material')
      return
    }

    setSections(current => current.map(item => item.id === section.id
      ? {
          ...item,
          linkedAssets: (item.linkedAssets || []).map(linked => {
            if (linked.id === asset.id) return { ...linked, link_sort_order: secondOrder }
            if (linked.id === target.id) return { ...linked, link_sort_order: firstOrder }
            return linked
          }).sort((a, b) => Number(a.link_sort_order || 0) - Number(b.link_sort_order || 0)),
        }
      : item))
    setMessage('Orden del material actualizado')
  }

  async function moveLinkedAssetToSection(section, asset, targetSectionId) {
    if (!editing || !section?.id || !asset?.id || !targetSectionId || Number(targetSectionId) === Number(section.id)) return
    const target = sections.find(item => Number(item.id) === Number(targetSectionId))
    if (!target) return
    if ((target.linkedAssets || []).some(item => item.id === asset.id)) {
      setMessage('Ese material ya está vinculado al apartado seleccionado.')
      return
    }
    const nextOrder = Math.max(0, ...(target.linkedAssets || []).map(item => Number(item.link_sort_order || 0))) + 10
    const result = await supabase.from('guide_section_assets')
      .update({ guide_section_id: target.id, sort_order: nextOrder })
      .eq('guide_section_id', section.id)
      .eq('library_asset_id', asset.id)
    if (result.error) {
      setMessage(result.error.message)
      return
    }

    setSections(current => current.map(item => {
      if (item.id === section.id) {
        return { ...item, linkedAssets: (item.linkedAssets || []).filter(linked => linked.id !== asset.id) }
      }
      if (item.id === target.id) {
        return { ...item, linkedAssets: [...(item.linkedAssets || []), { ...asset, link_section_id: target.id, link_sort_order: nextOrder }] }
      }
      return item
    }))
    setMessage(`Material movido a “${target.title}” · sin recargar`)
  }

  async function moveManualImage(section, image, direction) {
    if (!editing || !section?.id || !image?.id) return
    const ordered = [...(section.images || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    const index = ordered.findIndex(item => item.id === image.id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return
    const target = ordered[targetIndex]
    const firstOrder = Number(image.sort_order || ((index + 1) * 10))
    const secondOrder = Number(target.sort_order || ((targetIndex + 1) * 10))
    const [first, second] = await Promise.all([
      supabase.from('guide_images').update({ sort_order: secondOrder }).eq('id', image.id),
      supabase.from('guide_images').update({ sort_order: firstOrder }).eq('id', target.id),
    ])
    if (first.error || second.error) {
      setMessage(first.error?.message || second.error?.message || 'No se pudo reordenar la imagen')
      return
    }

    setSections(current => current.map(item => item.id === section.id
      ? {
          ...item,
          images: (item.images || []).map(currentImage => {
            if (currentImage.id === image.id) return { ...currentImage, sort_order: secondOrder }
            if (currentImage.id === target.id) return { ...currentImage, sort_order: firstOrder }
            return currentImage
          }).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
        }
      : item))
    setMessage('Orden de imágenes actualizado')
  }

  async function moveManualImageToSection(section, image, targetSectionId) {
    if (!editing || !section?.id || !image?.id || !targetSectionId || Number(targetSectionId) === Number(section.id)) return
    const target = sections.find(item => Number(item.id) === Number(targetSectionId))
    if (!target) return
    const nextOrder = Math.max(0, ...(target.images || []).map(item => Number(item.sort_order || 0))) + 10
    const result = await supabase.from('guide_images').update({ guide_section_id: target.id, sort_order: nextOrder }).eq('id', image.id)
    if (result.error) {
      setMessage(result.error.message)
      return
    }

    setSections(current => current.map(item => {
      if (item.id === section.id) {
        return { ...item, images: (item.images || []).filter(currentImage => currentImage.id !== image.id) }
      }
      if (item.id === target.id) {
        return { ...item, images: [...(item.images || []), { ...image, guide_section_id: target.id, sort_order: nextOrder }] }
      }
      return item
    }))
    setMessage(`Imagen movida a “${target.title}” · sin recargar`)
  }

  function AssetEditTools({ section, asset }) {
    if (!editing) return null
    return (
      <div className="asset-edit-tools-v12">
        <button type="button" onClick={() => moveLinkedAsset(section, asset, -1)} title="Mover antes">↑ Antes</button>
        <button type="button" onClick={() => moveLinkedAsset(section, asset, 1)} title="Mover después">↓ Después</button>
        <select defaultValue="" onChange={event => { if (event.target.value) moveLinkedAssetToSection(section, asset, event.target.value); event.target.value = '' }}>
          <option value="">Mover a otro apartado...</option>
          {sections.filter(item => item.id !== section.id).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <button type="button" className="danger" onClick={() => unlinkExistingAsset(section, asset)}>Quitar</button>
      </div>
    )
  }

  async function setCoverUrl(url) {
    if (!editing || !guide) return
    const result = await supabase.from('guides').update({ cover_url: url || null }).eq('id', guide.id)
    if (result.error) {
      setMessage(result.error.message)
      return
    }
    invalidateCatalogCache()
    setGuide(current => ({ ...current, cover_url: url || null }))
    setOriginalGuide(current => current ? ({ ...current, cover_url: url || null }) : current)
    setCoverPicker(false)
    setMessage('Portada actualizada')
  }

  async function uploadCover(file) {
    if (!editing || !guide || !file) return
    const storagePath = `covers/${guide.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`
    const upload = await supabase.storage.from('guide-images').upload(storagePath, file, { cacheControl: '31536000', upsert: false })
    if (upload.error) {
      setMessage(upload.error.message)
      return
    }
    const { data } = supabase.storage.from('guide-images').getPublicUrl(storagePath)
    await setCoverUrl(data.publicUrl)
  }

  function renderLinkedAssets(section) {
    const linked = section.linkedAssets || []
    const images = linked.filter(asset => isDisplayableImageAsset(asset))
    const videos = linked.filter(asset => asset.asset_type === 'video')
    const files = linked.filter(asset => !images.includes(asset) && !videos.includes(asset))

    return (
      <>
        {images.length > 0 && (
          <div className="document-image-grid-v7">
            {images.map(asset => (
              <div key={asset.id} className="linked-asset-edit-v8">
                <button type="button" className="document-image-v7" onClick={() => setSelectedImage({ publicUrl: asset.public_url, caption: asset.filename })}>
                  <img src={asset.public_url} alt={assetDisplayLabel(asset) || section.title} loading="lazy" decoding="async" />
                  <span>{assetDisplayLabel(asset)}</span>
                </button>
                <AssetEditTools section={section} asset={asset} />
              </div>
            ))}
          </div>
        )}

        {videos.length > 0 && (
          <div className="document-video-grid-v7">
            {videos.map(asset => (
              <article key={asset.id}>
                {isBrowserVideo(asset.extension)
                  ? <video src={asset.public_url} controls preload="metadata" />
                  : <a href={asset.public_url} target="_blank" rel="noreferrer">Abrir video</a>}
                <strong>{assetDisplayLabel(asset)}</strong>
                <AssetEditTools section={section} asset={asset} />
              </article>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <div className="document-files-v7">
            {files.map(asset => (
              <div key={asset.id} className="linked-file-edit-v8 asset-file-card-v81">
                <div className="asset-file-main-v81">
                  <span className="asset-file-icon-v81">{assetIcon(asset.asset_type)}</span>
                  <div className="asset-file-copy-v81">
                    <strong>{assetDisplayLabel(asset)}</strong>
                    <small>{detectedAssetType(asset)} · {formatBytes(asset.size_bytes)}</small>
                    <AssetIdentification asset={asset} />
                  </div>
                  <a href={asset.public_url} target="_blank" rel="noreferrer" className="asset-open-v81">Abrir ↗</a>
                </div>
                <AssetEditTools section={section} asset={asset} />
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  function renderSection(section, index) {
    const kind = 'notes'
    const lane = 'main'
    const textParagraphs = paragraphs(section.content)
    const badge = String(index + 1).padStart(2, '0')

    return (
      <section key={section.id} id={`section-${section.id}`} className={`document-section-v7 kind-${kind} lane-${lane} ${editing ? 'editing' : ''}`}>
        <div className="document-section-head-v7">
          <div className="document-section-number-v7">{badge}</div>
          <div className="document-section-title-v7">
            {editing
              ? <input value={section.title || ''} onChange={event => changeSection(section.id, 'title', event.target.value)} />
              : <h2>{section.title || 'Apartado'}</h2>}
          </div>

          {editing && (
            <div className="section-actions-v7">
              <button type="button" onClick={() => moveSection(section, -1)} title="Subir apartado">↑ Subir</button>
              <button type="button" onClick={() => moveSection(section, 1)} title="Bajar apartado">↓ Bajar</button>
              <button type="button" className="danger" onClick={() => deleteSection(section)}>Eliminar</button>
            </div>
          )}
        </div>

        <div className="document-section-body-v7">
          {editing ? (
            <textarea
              className="document-editor-textarea-v7"
              value={section.content || ''}
              onChange={event => changeSection(section.id, 'content', event.target.value)}
              placeholder="Contenido de esta sección..."
            />
          ) : (
            <div className="document-copy-v7">
              {textParagraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph.replace(/^[-•*]\s*/, '')}</p>)}
            </div>
          )}

          {renderLinkedAssets(section)}

          {(section.images || []).length > 0 && (
            <div className="document-image-grid-v7 manual">
              {section.images.map(image => (
                <div key={image.id} className="manual-document-image-v7">
                  <button type="button" className="document-image-v7" onClick={() => setSelectedImage(image)}>
                    <img src={image.publicUrl} alt={image.alt_text || image.caption || section.title} loading="lazy" decoding="async" />
                    {!editing && <span>{image.caption || 'Referencia visual'}</span>}
                  </button>
                  {editing && (
                    <div className="manual-image-controls-v7">
                      <input
                        defaultValue={image.caption || ''}
                        placeholder="Descripción de la imagen"
                        onBlur={event => updateImageCaption(image, event.target.value)}
                      />
                      <div className="manual-image-order-v12">
                        <button type="button" onClick={() => moveManualImage(section, image, -1)} title="Mover antes">↑ Antes</button>
                        <button type="button" onClick={() => moveManualImage(section, image, 1)} title="Mover después">↓ Después</button>
                        <select defaultValue="" onChange={event => { if (event.target.value) moveManualImageToSection(section, image, event.target.value); event.target.value = '' }}>
                          <option value="">Mover a otro apartado...</option>
                          {sections.filter(item => item.id !== section.id).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                        </select>
                        <button type="button" className="danger" onClick={() => deleteManualImage(image)}>Eliminar</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {editing && (
            <div className="link-existing-asset-v8 link-existing-asset-v123" id={`asset-picker-trigger-${section.id}`}>
              <div>
                <strong>Agregar material ya importado</strong>
                <small>Previsualice las imágenes y seleccione el material correspondiente.</small>
              </div>
              <button type="button" className="asset-picker-open-v123" onClick={() => openAssetPicker(section)}>
                <AppIcon name="photo" size={18} /> Ver fotos y archivos
              </button>
            </div>
          )}

          {editing && (
            <label className="inline-upload-v7">
              <AppIcon name="photo" size={18} />
              <span><strong>Agregar imágenes</strong><small>Se insertan dentro de esta sección.</small></span>
              <input type="file" accept="image/*" multiple onChange={event => { uploadManualImages(section, event.target.files); event.target.value = '' }} />
            </label>
          )}
        </div>
      </section>
    )
  }

  if (!shouldLoad) return (
    <section ref={rootRef} id={`guide-${guideSummary?.id}`} className="guide-deferred-v124" aria-label={guideSummary?.title || 'Instalación'}>
      {guideSummary?.cover_url && <img src={guideSummary.cover_url} alt="" loading="lazy" decoding="async" />}
      <div><span>INSTALACIÓN</span><h2>{guideSummary?.title || 'Instalación técnica'}</h2><p>{guideSummary?.summary || 'Abra esta guía para consultar su contenido.'}</p></div>
    </section>
  )
  if (loading) return <section ref={rootRef} id={`guide-${guideSummary?.id}`} className="guide-loading-v124" aria-busy="true"><div className="guide-loading-bar-v124" /><span>Cargando instalación…</span></section>
  if (error) return <section ref={rootRef} id={`guide-${guideSummary?.id}`} className="page-card">{error}</section>

  return (
    <section ref={rootRef} id={`guide-${guide?.id || guideSummary?.id}`} className={`inline-guide-shell-v9 ${isReference ? 'reference' : isPartial ? 'partial' : 'instruction'} ${globalEditing ? 'editor-available-v126' : ''}`}>
      {globalEditing && (
        <button
          type="button"
          className={`guide-pencil-edit-v126 ${editing ? 'active' : ''}`}
          onClick={editing ? closeGuideEdit : startGuideEdit}
          aria-label={editing ? 'Cerrar edición de esta guía' : 'Editar esta guía'}
          title={editing ? 'Cerrar edición' : 'Editar esta guía'}
        >
          <AppIcon name={editing ? 'close' : 'edit'} size={18} />
        </button>
      )}

      {editing && (
        <div className="document-edit-banner-v7">
          <div><strong>Edición habilitada</strong><span>Los cambios se realizan directamente sobre este documento.</span></div>
          <span>Modo edición</span>
        </div>
      )}

      <div className="work-instruction-head-v7">
        <div className="work-instruction-logo-v7"><img src={fulmarLogo} alt="FUL-MAR" decoding="async" /></div>
        <div className="work-instruction-title-v7"><strong>{isReference ? 'Referencia técnica' : isPartial ? 'Instalación parcial' : 'Instructivo de instalación'}</strong><span>{guide?.title}</span></div>
        <div className="work-instruction-brand-v7"><strong>{brand?.name}</strong><span>{family?.name}</span></div>
        <div className="work-instruction-strip-v7">{isReference ? 'DOCUMENTACIÓN TÉCNICA' : isPartial ? 'INSTALACIÓN DOCUMENTADA' : 'INSTRUCTIVO DE TRABAJO'}</div>
      </div>

      <header className="document-cover-v7">
        <div className="document-cover-copy-v7">
          <div className="guide-breadcrumb-line">{brand?.name} <span>›</span> {family?.name}</div>
          <div className="guide-badges">
            <span className={`guide-type ${guide?.guide_type?.toLowerCase()}`}>{friendlyType(guide?.guide_type)}</span>
            {editing ? (
              <select className="inline-status-v4" value={guide?.status || 'BORRADOR'} onChange={event => changeGuide('status', event.target.value)}>
                <option value="BORRADOR">BORRADOR</option>
                <option value="VALIDADA">VALIDADA</option>
              </select>
            ) : (
              <span className={guide?.status === 'VALIDADA' ? 'guide-status valid' : 'guide-status draft'}>{guide?.status === 'VALIDADA' ? 'VALIDADA' : 'BORRADOR'}</span>
            )}
            {editing ? (
              <select className="inline-status-v4" value={contentKind} onChange={event => changeGuide('content_kind', event.target.value)}>
                <option value="INSTRUCTIVO">INSTRUCTIVO</option>
                <option value="PARCIAL">PARCIAL</option>
                <option value="REFERENCIA">REFERENCIA</option>
              </select>
            ) : (
              <span className={`content-kind-badge-v8 ${contentKind.toLowerCase()}`}>{contentKind === 'INSTRUCTIVO' ? 'INSTRUCTIVO' : contentKind === 'PARCIAL' ? 'PARCIAL' : 'REFERENCIA'}</span>
            )}
          </div>

          {editing
            ? <input className="document-title-input-v7" value={guide?.title || ''} onChange={event => changeGuide('title', event.target.value)} />
            : <h1>{guide?.title}</h1>}

          {editing
            ? <textarea className="document-summary-input-v7" value={guide?.summary || ''} placeholder="Resumen opcional" onChange={event => changeGuide('summary', event.target.value)} />
            : guide?.summary && <p>{guide.summary}</p>}

        </div>

        <div className="document-cover-image-v7">
          {cover ? <img src={cover} alt={`Vehículo ${guide?.title || family?.name || 'FUL-MAR'}`} loading="eager" fetchPriority="high" decoding="async" /> : <VehiclePlaceholder label="Imagen no disponible" />}
          {editing && (
            <button type="button" className="change-cover-v7" onClick={() => setCoverPicker(true)}>
              <AppIcon name="photo" size={17} /> Cambiar portada
            </button>
          )}
        </div>
      </header>

      <section className={`document-meta-v7 document-meta-v127 ${editing ? 'editing' : ''}`}>
        <div>{metaLabel('equipment')}{editing ? <input value={guide?.equipment || ''} onChange={event => changeGuide('equipment', event.target.value)} placeholder="Ej.: FMD-1000" /> : <strong>{guide?.equipment || 'No especificado'}</strong>}</div>
        <div>{metaLabel('variant')}{editing ? <input value={guide?.variant || ''} onChange={event => changeGuide('variant', event.target.value)} placeholder="Nombre o variante" /> : <strong>{guide?.variant || guide?.title || 'General'}</strong>}</div>
        <div>{metaLabel('guideType')}{editing ? <select value={guide?.guide_type || 'MODELO'} onChange={event => changeGuide('guide_type', event.target.value)}><option value="BASE">GENERAL</option><option value="VARIANTE">VARIANTE</option><option value="MODELO">INSTALACIÓN</option></select> : <strong>{friendlyType(guide?.guide_type)}</strong>}</div>
        <div>{metaLabel('year')}{editing ? <input value={guide?.year_text || ''} onChange={event => changeGuide('year_text', event.target.value)} placeholder="Ej.: 2022 en adelante" /> : <strong>{guide?.year_text || 'No especificado'}</strong>}</div>
        <div>{metaLabel('sections')}{editing ? <input value={metaLabels.sectionsValue || ''} onChange={event => changeMetaLabel('sectionsValue', event.target.value)} placeholder="Texto libre" /> : <strong>{metaLabels.sectionsValue || '—'}</strong>}</div>
        <div>{metaLabel('material')}{editing ? <input value={metaLabels.materialValue || ''} onChange={event => changeMetaLabel('materialValue', event.target.value)} placeholder="Texto libre" /> : <strong>{metaLabels.materialValue || '—'}</strong>}</div>
      </section>

      {editing && (
        <div className="edit-quick-bar-v121">
          <div className="edit-quick-status-v121">
            <strong>Editor rápido</strong>
            <span className={hasUnsavedChanges ? 'dirty' : 'saved'}>
              {saving ? '● Guardando…' : hasUnsavedChanges ? '● Cambios pendientes · guarde cuando termine' : '✓ Todo guardado'}
            </span>
          </div>
          <div className="edit-quick-actions-v121">
            <button type="button" onClick={addSection}>+ Apartado</button>
            <button type="button" className="primary-button" onClick={saveAll} disabled={saving || !hasUnsavedChanges}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}

      <div className="document-layout-v7 inline-document-layout-v9">
        <article className="document-main-v7">
          {isReference && (
            <div className="reference-warning-v8">
              <strong>Referencia técnica</strong>
              <p>Material disponible para consulta técnica y análisis del vehículo. Incluye registros, configuraciones, señales y documentación asociada.</p>
            </div>
          )}

          {isPartial && (
            <div className="partial-warning-v8">
              <strong>Instalación parcial</strong>
              <p>Se dispone de información documentada para parte de la instalación. Los apartados visibles corresponden únicamente al material registrado para este caso.</p>
            </div>
          )}

          {mainSections.length > 0 ? mainSections.map(renderSection) : !isReference ? (
            <div className="document-empty-v7">
              <h2>Instructivo no disponible</h2>
              <p>No se dispone actualmente de un procedimiento de instalación documentado para este caso.</p>
            </div>
          ) : null}

          {editing && (
            <section className="add-section-panel-v7">
              <div><strong>Agregar apartado</strong><span>Cree tantos apartados como necesite. El título y el texto son completamente libres.</span></div>
              <div>
                <button type="button" onClick={addSection}>+ Nuevo apartado</button>
              </div>
            </section>
          )}

          {(materialAssets.length > 0 || editing) && (
            <details className="source-material-v7 source-material-v83">
              <summary>{editing ? 'Biblioteca general de la subcarpeta' : 'Material técnico asociado'} <span>{materialAssets.length} archivo{materialAssets.length === 1 ? '' : 's'}</span></summary>
              <div className="source-material-body-v7">
                {editing && (
                  <div className="general-library-editor-v127">
                    <div>
                      <strong>Biblioteca general de esta subcarpeta</strong>
                      <span>Cargue fotos, PDF, Word, Excel, videos o archivos técnicos. Después podrá seleccionarlos desde cualquier fase con “Ver fotos y archivos”.</span>
                    </div>
                    <label className="general-library-upload-v127">
                      <AppIcon name="upload" size={18} /> Subir archivos
                      <input type="file" multiple onChange={event => { uploadGeneralLibraryFiles(event.target.files); event.target.value = '' }} />
                    </label>
                    {collection && <small>Biblioteca: {collection.title}</small>}
                  </div>
                )}
                {materialAssets.length === 0 && editing && <div className="library-empty-v127">Todavía no hay archivos en esta biblioteca general.</div>}
                {materialGroups.map(([groupName, groupAssets]) => (
                  <section key={groupName} className="material-context-group-v83">
                    <div className="material-context-head-v83">
                      <h3>{groupName}</h3>
                      <span>{groupAssets.length}</span>
                    </div>

                    {groupAssets.some(asset => isDisplayableImageAsset(asset)) && (
                      <div className="material-image-grid-v4">
                        {groupAssets.filter(asset => isDisplayableImageAsset(asset)).map(asset => (
                          <div key={asset.id} className="material-image-wrap-v10">
                            <button type="button" className="material-image-card-v4 material-image-card-v83" onClick={() => setSelectedImage({ publicUrl: asset.public_url, caption: assetDisplayLabel(asset) })}>
                              <img src={asset.public_url} alt={assetDisplayLabel(asset)} loading="lazy" decoding="async" />
                              <span>{assetDisplayLabel(asset)}</span>
                            </button>
                            {editing && (
                              <div className="asset-assignment-editor-v123">
                                {linkedSectionNames(asset.id).length > 0 && (
                                  <span className="asset-assigned-badge-v123">Asignada a: {linkedSectionNames(asset.id).join(' · ')}</span>
                                )}
                                <select className="assign-asset-v10" defaultValue="" onChange={event => { const sectionId = Number(event.target.value); const target = sections.find(item => item.id === sectionId); if (target) linkExistingAsset(target, asset.id); event.target.value = '' }}>
                                  <option value="">Asignar también a...</option>
                                  {sections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {groupAssets.some(asset => !isDisplayableImageAsset(asset)) && (
                      <div className="material-file-list-v4">
                        {groupAssets.filter(asset => !isDisplayableImageAsset(asset)).map(asset => (
                          <div key={asset.id} className="material-file-row-v4 material-file-row-info-v81">
                            <span className="material-file-icon-v4">{assetIcon(asset.asset_type)}</span>
                            <span className="asset-file-copy-v81">
                              <strong>{assetDisplayLabel(asset)}</strong>
                              <small>{detectedAssetType(asset)} · {formatBytes(asset.size_bytes)}</small>
                              <AssetIdentification asset={asset} />
                            </span>
                            {editing && (
                              <div className="asset-assignment-editor-v123">
                                {linkedSectionNames(asset.id).length > 0 && (
                                  <span className="asset-assigned-badge-v123">Asignado a: {linkedSectionNames(asset.id).join(' · ')}</span>
                                )}
                                <select className="assign-asset-v10" defaultValue="" onChange={event => { const sectionId = Number(event.target.value); const target = sections.find(item => item.id === sectionId); if (target) linkExistingAsset(target, asset.id); event.target.value = '' }}>
                                  <option value="">Asignar también a...</option>
                                  {sections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                                </select>
                              </div>
                            )}
                            <a href={asset.public_url} target="_blank" rel="noreferrer" className="asset-open-v81">Abrir ↗</a>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </details>
          )}
        </article>

        <aside className="document-sidebar-v7 inline-document-sidebar-v9">
          <div className="document-sidebar-box-v7">
            <strong>Contenido</strong>
            <nav>
              {mainSections.map((section, index) => <a key={section.id} href={`#section-${section.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{section.title || 'Apartado'}</a>)}
            </nav>
          </div>
        </aside>
      </div>

      {editing && (
        <div className={`inline-save-bar-v4 document-save-v7 save-bar-v121 ${hasUnsavedChanges ? 'dirty' : 'saved'}`}>
          <span>{message || (hasUnsavedChanges ? 'Cambios pendientes · guarde cuando termine o use Ctrl + S.' : '✓ Todo guardado. Puede continuar editando.')}</span>
          <button type="button" className="primary-button" onClick={saveAll} disabled={saving || !hasUnsavedChanges}>
            {saving ? 'Guardando…' : hasUnsavedChanges ? 'Guardar cambios' : 'Guardado'}
          </button>
        </div>
      )}

      {assetPickerSection && (
        <div className="asset-picker-backdrop-v123" onMouseDown={event => { if (event.target === event.currentTarget) closeAssetPicker() }}>
          <div className="asset-picker-v123" role="dialog" aria-modal="true" aria-label="Seleccionar material técnico">
            <div className="asset-picker-head-v123">
              <div>
                <span className="asset-picker-kicker-v123">AGREGAR AL APARTADO</span>
                <strong>{assetPickerSection.title || 'Apartado'}</strong>
                <small>Las imágenes se previsualizan antes de vincularlas. Es posible agregar varios elementos sin cerrar el selector.</small>
              </div>
              <button type="button" className="asset-picker-close-v123" onClick={closeAssetPicker} aria-label="Cerrar selector">×</button>
            </div>

            <div className="asset-picker-toolbar-v123">
              <div className="asset-picker-tabs-v123">
                <button type="button" className={assetPickerType === 'images' ? 'active' : ''} onClick={() => setAssetPickerType('images')}>Fotos</button>
                <button type="button" className={assetPickerType === 'all' ? 'active' : ''} onClick={() => setAssetPickerType('all')}>Todo el material</button>
              </div>
              <label className="asset-picker-search-v123">
                <AppIcon name="search" size={17} />
                <input value={assetPickerSearch} onChange={event => setAssetPickerSearch(event.target.value)} placeholder="Buscar por nombre, ubicación, conector..." autoFocus />
              </label>
            </div>

            <div className="asset-picker-result-head-v123">
              <span>{assetPickerCandidates.length} elemento{assetPickerCandidates.length === 1 ? '' : 's'} disponible{assetPickerCandidates.length === 1 ? '' : 's'}</span>
              <small>También se muestra el material de la misma marca/familia. Lo ya asignado queda marcado.</small>
            </div>

            <div className="asset-picker-grid-v123">
              {assetPickerCandidates.map(asset => {
                const isImage = isDisplayableImageAsset(asset)
                const alreadyHere = (assetPickerSection.linkedAssets || []).some(item => Number(item.id) === Number(asset.id))
                return (
                  <article key={asset.id} className="asset-picker-card-v123">
                    {isImage ? (
                      <button type="button" className="asset-picker-thumb-v123" onClick={() => setSelectedImage({ publicUrl: asset.public_url, caption: assetDisplayLabel(asset) })} title="Ver imagen grande">
                        <img src={asset.public_url} alt={assetDisplayLabel(asset)} loading="lazy" decoding="async" />
                        <span>Ver grande</span>
                      </button>
                    ) : (
                      <div className="asset-picker-file-v123">
                        <span>{assetIcon(asset.asset_type)}</span>
                        <small>{detectedAssetType(asset)}</small>
                      </div>
                    )}
                    <div className="asset-picker-card-copy-v123">
                      <strong>{assetDisplayLabel(asset)}</strong>
                      <small title={asset.filename}>{asset.filename || detectedAssetType(asset)}</small>
                      <span>{assetContextGroup(asset)}</span>
                    </div>
                    <button
                      type="button"
                      className={`asset-picker-add-v123 ${alreadyHere ? 'already' : ''}`}
                      disabled={alreadyHere || assigningAssetId === asset.id}
                      onClick={() => addAssetFromPicker(asset)}
                    >
                      {alreadyHere ? '✓ Ya está en este apartado' : assigningAssetId === asset.id ? 'Agregando…' : '+ Agregar'}
                    </button>
                  </article>
                )
              })}
            </div>

            {assetPickerCandidates.length === 0 && (
              <div className="asset-picker-empty-v123">
                <strong>No hay material que coincida.</strong>
                <span>Pruebe con “Todo el material” o borre la búsqueda. El selector muestra únicamente material que usted ya cargó en esta guía.</span>
              </div>
            )}

            <div className="asset-picker-footer-v123" aria-live="polite">
              <span>{message || 'Seleccione uno o varios elementos y luego regrese al instructivo.'}</span>
              <button type="button" onClick={closeAssetPicker}>Listo, volver al instructivo</button>
            </div>
          </div>
        </div>
      )}

      {coverPicker && (
        <div className="cover-picker-backdrop-v7" onClick={() => setCoverPicker(false)}>
          <div className="cover-picker-v7" onClick={event => event.stopPropagation()}>
            <div className="cover-picker-head-v7">
              <div><strong>Portada de la instalación</strong><span>Seleccione una imagen representativa del vehículo o cargue una nueva.</span></div>
              <button type="button" onClick={() => setCoverPicker(false)}><AppIcon name="close" size={20} /></button>
            </div>

            <div className="cover-picker-actions-v7">
              <label>
                <AppIcon name="upload" size={18} /> Subir portada
                <input type="file" accept="image/*" onChange={event => { uploadCover(event.target.files?.[0]); event.target.value = '' }} />
              </label>
            </div>

            <div className="cover-picker-grid-v7">
              {imageAssets.map(asset => (
                <button key={asset.id} type="button" onClick={() => setCoverUrl(asset.public_url)}>
                  <img src={asset.public_url} alt={asset.filename || 'Portada'} loading="lazy" decoding="async" />
                  <span>{assetDisplayLabel(asset)}</span>
                </button>
              ))}
            </div>

            {imageAssets.length === 0 && <div className="cover-picker-empty-v7">No hay imágenes importadas para esta instalación.</div>}
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Vista ampliada de imagen" onClick={() => setSelectedImage(null)}>
          <button type="button" className="image-lightbox-close" onClick={() => setSelectedImage(null)} aria-label="Cerrar imagen ampliada">×</button>
          <div className="image-lightbox-content" onClick={event => event.stopPropagation()}>
            <img src={selectedImage.publicUrl} alt={selectedImage.caption || 'Imagen técnica'} decoding="async" />
            {selectedImage.caption && <p>{selectedImage.caption}</p>}
          </div>
        </div>
      )}
    </section>
  )
}

export default InlineGuide
