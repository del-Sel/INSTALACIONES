import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { getCatalogSnapshot, loadCatalogSnapshot } from '../lib/catalogCache.js'

function AdminGuideEdit() {
  const { guideId } = useParams()
  const [target, setTarget] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { resolveTarget() }, [guideId])

  async function resolveTarget() {
    try {
      const snapshot = getCatalogSnapshot() || await loadCatalogSnapshot()
      const guide = snapshot.guides.find(item => String(item.id) === String(guideId))
      if (!guide) throw new Error('No se encontró la instalación.')
      const family = snapshot.families.find(item => String(item.id) === String(guide.family_id))
      if (!family) throw new Error('No se encontró la familia.')
      const brand = snapshot.brands.find(item => String(item.id) === String(family.brand_id))
      if (!brand) throw new Error('No se encontró la marca.')
      setTarget(`/${brand.slug}/${family.slug}#guide-${guide.id}`)
    } catch (resolveError) {
      setError(resolveError?.message || 'No se pudo abrir la instalación.')
    }
  }

  if (error) return <div className="page-card">{error}</div>
  if (!target) return <div className="page-card">Abriendo editor...</div>
  return <Navigate to={target} replace />
}

export default AdminGuideEdit
