import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../supabase.js'
import { slugify } from '../lib/text.js'
import { invalidateCatalogCache, loadCatalogSnapshot } from '../lib/catalogCache.js'

function AdminGuides() {
  const navigate = useNavigate()
  const [brands, setBrands] = useState([])
  const [families, setFamilies] = useState([])
  const [guides, setGuides] = useState([])
  const [collections, setCollections] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('TODOS')
  const [kind, setKind] = useState('TODOS')
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ brand_id: '', family_id: '', title: '', equipment: '', guide_type: 'MODELO', content_kind: 'INSTRUCTIVO' })

  useEffect(() => { loadAll() }, [])

  async function loadAll(force = false) {
    try {
      const snapshot = await loadCatalogSnapshot({ force })
      setBrands([...snapshot.brands].sort((a, b) => a.name.localeCompare(b.name)))
      setFamilies([...snapshot.families].sort((a, b) => a.name.localeCompare(b.name)))
      setGuides([...snapshot.guides].sort((a, b) => a.title.localeCompare(b.title)))
      setCollections([...snapshot.collections].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''))))
    } catch (loadError) {
      setMessage(loadError?.message || 'No se pudo cargar la administración.')
    }
  }

  const brandById = useMemo(() => new Map(brands.map(item => [item.id, item])), [brands])
  const familyById = useMemo(() => new Map(families.map(item => [item.id, item])), [families])

  const hydrated = useMemo(() => guides.map(guide => {
    const family = familyById.get(guide.family_id)
    const brand = family ? brandById.get(family.brand_id) : null
    return { ...guide, family, brand }
  }).filter(item => item.family && item.brand), [guides, familyById, brandById])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return hydrated.filter(item => {
      if (status !== 'TODOS' && item.status !== status) return false
      if (kind !== 'TODOS' && item.content_kind !== kind) return false
      if (!q) return true
      return `${item.brand.name} ${item.family.name} ${item.title} ${item.equipment || ''}`.toLowerCase().includes(q)
    })
  }, [hydrated, search, status, kind])

  const linkedCollectionIds = useMemo(() => new Set(guides.map(item => item.library_collection_id).filter(Boolean)), [guides])
  const unlinked = collections.filter(item => !linkedCollectionIds.has(item.id)).length
  const instructivos = guides.filter(item => item.content_kind === 'INSTRUCTIVO').length
  const parciales = guides.filter(item => item.content_kind === 'PARCIAL').length
  const referencias = guides.filter(item => item.content_kind === 'REFERENCIA').length

  const createFamilies = families.filter(item => String(item.brand_id) === String(form.brand_id))

  async function createGuide(event) {
    event.preventDefault()
    setMessage('')

    const family = familyById.get(Number(form.family_id)) || families.find(item => String(item.id) === String(form.family_id))
    const brand = family ? brandById.get(family.brand_id) : null

    if (!brand || !family || !form.title.trim()) {
      setMessage('Seleccione una marca y una familia, e ingrese el título.')
      return
    }

    setCreating(true)
    const result = await supabase.from('guides').insert({
      family_id: family.id,
      vehicle_id: null,
      base_guide_id: null,
      guide_type: form.guide_type,
      variant: null,
      slug: slugify(form.title),
      equipment: form.equipment || '',
      status: 'BORRADOR',
      content_kind: form.content_kind,
      title: form.title.trim(),
      summary: '',
    }).select('*').single()

    setCreating(false)

    if (result.error) {
      setMessage(result.error.message)
      return
    }

    invalidateCatalogCache()
    navigate(`/${brand.slug}/${family.slug}#guide-${result.data.id}`)
  }

  async function deleteGuide(item) {
    if (!confirm(`¿Eliminar “${item.title}”? Se eliminarán el documento y sus apartados. El material técnico asociado no se elimina.`)) return
    const result = await supabase.from('guides').delete().eq('id', item.id)
    if (result.error) setMessage(result.error.message)
    else { invalidateCatalogCache(); await loadAll(true) }
  }

  return (
    <>
      <header className="admin-hero-v7">
        <div>
          <div className="page-eyebrow">ADMINISTRACIÓN</div>
          <h1>Administración de instalaciones</h1>
          <p>Gestione instructivos, instalaciones parciales, referencias técnicas y material vinculado desde un único panel.</p>
        </div>
        <div className="admin-stats-v7">
          <div><strong>{instructivos}</strong><span>Instructivos</span></div>
          <div><strong>{parciales}</strong><span>Parciales</span></div>
          <div><strong>{referencias}</strong><span>Referencias</span></div>
          <div><strong>{unlinked}</strong><span>Material sin vincular</span></div>
        </div>
      </header>

      <div className="admin-quick-v7">
        <Link to="/admin/material"><strong>Material sin vincular</strong><span>Revisar colecciones técnicas que todavía no están asociadas a una instalación.</span><b>→</b></Link>
        <Link to="/admin/pendientes"><strong>Pendientes de revisión</strong><span>Revise instructivos e instalaciones parciales pendientes de validación.</span><b>→</b></Link>
      </div>

      <section className="admin-toolbar-v7">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar marca, familia o instalación..." />
        <select value={kind} onChange={event => setKind(event.target.value)}>
          <option value="TODOS">Todos los tipos</option>
          <option value="INSTRUCTIVO">Instructivos</option>
          <option value="PARCIAL">Parciales</option>
          <option value="REFERENCIA">Referencias técnicas</option>
        </select>
        <select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="TODOS">Todos los estados</option>
          <option value="BORRADOR">Pendientes de revisión</option>
          <option value="VALIDADA">Validadas</option>
        </select>
      </section>

      <div className="admin-layout-v7">
        <section className="admin-list-panel-v7">
          <div className="admin-section-title-v7"><div><strong>Instalaciones</strong><span>{filtered.length} resultados</span></div></div>
          <div className="admin-guide-list-v7">
            {filtered.map(item => (
              <article key={item.id}>
                <div>
                  <span>{item.brand.name} · {item.family.name}</span>
                  <strong>{item.title}</strong>
                  <small>{item.content_kind || 'INSTRUCTIVO'} · {item.equipment || 'Equipo no especificado'} · {item.status}</small>
                </div>
                <div>
                  <Link to={`/${item.brand.slug}/${item.family.slug}#guide-${item.id}`}>Abrir / editar</Link>
                  <button type="button" onClick={() => deleteGuide(item)}>Eliminar</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-create-panel-v7">
          <div className="admin-section-title-v7">
            <div><strong>Nueva instalación</strong><span>Se crea sin contenido predefinido para completar únicamente la información documentada.</span></div>
          </div>

          <form onSubmit={createGuide}>
            <label>Marca</label>
            <select value={form.brand_id} onChange={event => setForm(current => ({ ...current, brand_id: event.target.value, family_id: '' }))}>
              <option value="">Seleccionar marca</option>
              {brands.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>

            <label>Familia</label>
            <select value={form.family_id} disabled={!form.brand_id} onChange={event => setForm(current => ({ ...current, family_id: event.target.value }))}>
              <option value="">Seleccionar familia</option>
              {createFamilies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>

            <label>Título</label>
            <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Ej.: Mercedes Actros 2653 Euro 6" />

            <label>Equipo</label>
            <input value={form.equipment} onChange={event => setForm(current => ({ ...current, equipment: event.target.value }))} placeholder="Ej.: DG-600" />

            <label>Contenido</label>
            <select value={form.content_kind} onChange={event => setForm(current => ({ ...current, content_kind: event.target.value }))}>
              <option value="INSTRUCTIVO">Instructivo de instalación</option>
              <option value="PARCIAL">Instalación parcial</option>
              <option value="REFERENCIA">Referencia técnica</option>
            </select>

            <label>Tipo de relación</label>
            <select value={form.guide_type} onChange={event => setForm(current => ({ ...current, guide_type: event.target.value }))}>
              <option value="MODELO">Instalación / modelo</option>
              <option value="VARIANTE">Variante</option>
              <option value="BASE">General</option>
            </select>

            {message && <div className="form-error">{message}</div>}
            <button className="primary-button" type="submit" disabled={creating}>{creating ? 'Creando...' : 'Crear y abrir'}</button>
          </form>
        </section>
      </div>
    </>
  )
}

export default AdminGuides
