import { supabase } from '../supabase.js'

const CACHE_KEY = 'fulmar.catalog.v1300'
const CACHE_TTL = 5 * 60 * 1000
let memory = null
let pending = null

function valid(entry) {
  return Boolean(entry?.savedAt && entry?.data && Date.now() - entry.savedAt < CACHE_TTL)
}

function readSession() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null')
    if (valid(parsed)) return parsed
  } catch (_) {}
  return null
}

export function getCatalogSnapshot() {
  if (valid(memory)) return memory.data
  const session = readSession()
  if (session) {
    memory = session
    return session.data
  }
  return null
}

export async function loadCatalogSnapshot({ force = false } = {}) {
  if (!force) {
    const cached = getCatalogSnapshot()
    if (cached) return cached
    if (pending) return pending
  }

  pending = (async () => {
    const [brandResult, familyResult, guideResult, collectionResult] = await Promise.all([
      supabase.from('brands').select('id,name,slug').order('name'),
      supabase.from('families').select('id,brand_id,name,slug'),
      supabase.from('guides').select('id,family_id,vehicle_id,title,slug,status,summary,library_collection_id,guide_type,equipment,content_kind,variant,year_text,base_guide_id,cover_url,updated_at'),
      supabase.from('library_collections').select('id,title,source_brand,cover_url,image_count,video_count,document_count,can_data_count,file_count,size_bytes'),
    ])

    const error = brandResult.error || familyResult.error || guideResult.error || collectionResult.error
    if (error) throw error

    const allGuides = guideResult.data || []
    const data = {
      brands: brandResult.data || [],
      families: familyResult.data || [],
      guides: allGuides.filter(item => !(item.title === '__OCULTA__' && String(item.variant || '').startsWith('canonical:'))),
      hiddenGuides: allGuides.filter(item => item.title === '__OCULTA__' && String(item.variant || '').startsWith('canonical:')),
      collections: collectionResult.data || [],
    }

    memory = { savedAt: Date.now(), data }
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(memory)) } catch (_) {}
    return data
  })()

  try {
    return await pending
  } finally {
    pending = null
  }
}

export function invalidateCatalogCache() {
  memory = null
  pending = null
  try { sessionStorage.removeItem(CACHE_KEY) } catch (_) {}
}
