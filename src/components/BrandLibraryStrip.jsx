import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../supabase.js'
import VehiclePlaceholder from './VehiclePlaceholder.jsx'

function BrandLibraryStrip({ brandName }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!brandName) return
    cargar()
  }, [brandName])

  async function cargar() {
    const { data, error } = await supabase
      .from('library_collections')
      .select('id, title, cover_url, file_count, image_count, video_count, document_count, can_data_count')
      .eq('source_brand', brandName)
      .order('title')
      .limit(8)

    if (error) {
      console.error(error)
      return
    }

    setItems(data || [])
  }

  if (!items.length) return null

  return (
    <section className="brand-library-strip">
      <div className="section-heading">
        <div>
          <h2>Material técnico</h2>
          <p>Material de referencia asociado a {brandName}.</p>
        </div>
        <Link to="/biblioteca" className="brand-library-all">Ver instalaciones →</Link>
      </div>

      <div className="brand-library-scroll">
        {items.map(item => (
          <Link key={item.id} to={`/biblioteca/${item.id}`} className="brand-library-mini-card">
            <div className="brand-library-mini-cover">
              {item.cover_url ? <img src={item.cover_url} alt={item.title} loading="lazy" decoding="async" /> : <VehiclePlaceholder compact />}
            </div>
            <div>
              <strong>{item.title}</strong>
              <span>{item.image_count} imágenes · {item.can_data_count} CAN</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default BrandLibraryStrip
