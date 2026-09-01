import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from '../supabase.js'
import {
  assetIcon,
  assetDisplayLabel,
  detectedAssetDescription,
  detectedAssetPreview,
  detectedAssetType,
  formatBytes,
  isBrowserImage,
  isBrowserVideo,
} from '../lib/library.js'
import { visibleGuideAssets } from '../lib/guide.js'

const GROUPS = [
  ['image', 'Imágenes'],
  ['video', 'Videos'],
  ['document', 'Documentación'],
  ['can-data', 'CAN / datos'],
  ['text', 'Notas'],
  ['data', 'Otros archivos técnicos'],
  ['shortcut', 'Accesos directos históricos'],
  ['backup', 'Backups'],
]

function LibraryCollection() {
  const { collectionId } = useParams()
  const [collection, setCollection] = useState(null)
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)

  useEffect(() => {
    cargarColeccion()
  }, [collectionId])

  useEffect(() => {
    function onEscape(event) {
      if (event.key === 'Escape') setSelectedImage(null)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [])

  async function cargarColeccion() {
    setLoading(true)
    setError('')

    const [collectionResult, assetResult] = await Promise.all([
      supabase.from('library_collections').select('*').eq('id', collectionId).single(),
      supabase.from('library_assets').select('*').eq('collection_id', collectionId).order('sort_order'),
    ])

    if (collectionResult.error) {
      console.error(collectionResult.error)
      setError('No se encontró esta colección.')
      setLoading(false)
      return
    }
    if (assetResult.error) {
      console.error(assetResult.error)
      setError('No se pudieron cargar los archivos.')
      setLoading(false)
      return
    }

    setCollection(collectionResult.data)
    setAssets(visibleGuideAssets(assetResult.data || []))
    setLoading(false)
  }

  const grouped = useMemo(() => {
    const map = {}
    for (const asset of assets) {
      if (!map[asset.asset_type]) map[asset.asset_type] = []
      map[asset.asset_type].push(asset)
    }
    return map
  }, [assets])

  if (loading) return <div className="page-card">Cargando material...</div>
  if (error) return <div className="page-card">{error}</div>

  return (
    <>
      <Link to="/" className="back-link">← Inicio</Link>

      <header className="library-detail-header">
        <div>
          <div className="page-eyebrow">{collection.source_brand}</div>
          <h1>{collection.title}</h1>
          <p>{collection.description}</p>
        </div>

        <div className="library-detail-meta">
          <div><strong>{collection.file_count}</strong><span>Archivos</span></div>
          <div><strong>{collection.image_count}</strong><span>Imágenes</span></div>
          <div><strong>{collection.video_count}</strong><span>Videos</span></div>
          <div><strong>{formatBytes(collection.size_bytes)}</strong><span>Tamaño</span></div>
        </div>
      </header>

      {GROUPS.map(([type, title]) => {
        const group = grouped[type] || []
        if (!group.length) return null

        return (
          <section key={type} className="library-detail-section">
            <div className="section-heading">
              <div>
                <h2>{title}</h2>
                <p>{group.length} archivo{group.length === 1 ? '' : 's'}</p>
              </div>
            </div>

            {type === 'image' ? (
              <div className="asset-gallery">
                {group.map(asset => {
                  const preview = isBrowserImage(asset.extension)
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      className="asset-image-card"
                      onClick={() => preview && setSelectedImage(asset)}
                    >
                      {preview ? (
                        <img src={asset.public_url} alt={assetDisplayLabel(asset)} loading="lazy" decoding="async" />
                      ) : (
                        <div className="asset-file-fallback">{asset.extension?.replace('.', '').toUpperCase() || 'IMG'}</div>
                      )}
                      <span>{assetDisplayLabel(asset)}</span>
                    </button>
                  )
                })}
              </div>
            ) : type === 'video' ? (
              <div className="asset-video-grid">
                {group.map(asset => (
                  <article key={asset.id} className="asset-video-card">
                    {isBrowserVideo(asset.extension) ? (
                      <video controls preload="metadata" src={asset.public_url} />
                    ) : (
                      <div className="asset-video-fallback">▶ {asset.extension?.replace('.', '').toUpperCase()}</div>
                    )}
                    <div>
                      <strong>{assetDisplayLabel(asset)}</strong>
                      <span>{formatBytes(asset.size_bytes)}</span>
                      <a href={asset.public_url} target="_blank" rel="noreferrer">Abrir archivo ↗</a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="asset-file-list">
                {group.map(asset => {
                  const detectedType = detectedAssetType(asset)
                  const detectedDescription = detectedAssetDescription(asset)
                  const preview = detectedAssetPreview(asset)

                  return (
                    <div key={asset.id} className="asset-file-row asset-file-row-detected-v81">
                      <div className="asset-file-icon">{assetIcon(asset.asset_type)}</div>
                      <div className="asset-file-info">
                        <strong>{assetDisplayLabel(asset)}</strong>
                        <span>{detectedType} · {formatBytes(asset.size_bytes)}</span>
                        {detectedDescription && <p className="asset-detected-description-v81">{detectedDescription}</p>}
                        {preview && (
                          <details className="asset-preview-v81">
                            <summary>Ver contenido detectado</summary>
                            <pre>{preview}</pre>
                          </details>
                        )}
                      </div>
                      <a href={asset.public_url} target="_blank" rel="noreferrer" className="asset-file-open asset-open-v81">Abrir ↗</a>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}

      {selectedImage && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Vista ampliada de imagen" onClick={() => setSelectedImage(null)}>
          <button type="button" className="image-lightbox-close" onClick={() => setSelectedImage(null)} aria-label="Cerrar imagen ampliada">×</button>
          <div className="image-lightbox-content" onClick={event => event.stopPropagation()}>
            <img src={selectedImage.public_url} alt={assetDisplayLabel(selectedImage)} decoding="async" />
            <p>{assetDisplayLabel(selectedImage)}</p>
          </div>
        </div>
      )}
    </>
  )
}

export default LibraryCollection
