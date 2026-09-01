import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { getCatalogSnapshot, loadCatalogSnapshot } from '../lib/catalogCache.js'

function Guide() {
  const { brandSlug, familySlug, guideSlug } = useParams()
  const [target, setTarget] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    async function resolveGuide() {
      try {
        const snapshot = getCatalogSnapshot() || await loadCatalogSnapshot()
        if (!active) return
        const brand = snapshot.brands.find(item => item.slug === brandSlug)
        if (!brand) { setFailed(true); return }
        const family = snapshot.families.find(item => item.brand_id === brand.id && item.slug === familySlug)
        if (!family) { setFailed(true); return }
        const guide = snapshot.guides.find(item => item.family_id === family.id && item.slug === guideSlug)
        if (!active) return
        if (guide) setTarget(`/${brandSlug}/${familySlug}#guide-${guide.id}`)
        else setFailed(true)
      } catch (_) {
        if (active) setFailed(true)
      }
    }

    resolveGuide()
    return () => { active = false }
  }, [brandSlug, familySlug, guideSlug])

  if (target) return <Navigate to={target} replace />
  if (failed) return <Navigate to={`/${brandSlug}/${familySlug}`} replace />
  return <div className="page-card">Abriendo instalación...</div>
}

export default Guide
