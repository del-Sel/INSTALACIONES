function norm(value = '') {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

const canonicalImageUrls = import.meta.glob('../assets/canonical/**/*.jpg', { eager: true, query: '?url', import: 'default' })

function imageUrl(group, file) {
  return canonicalImageUrls[`../assets/canonical/${group}/${file}`] || ''
}

function image(group, file, caption, id) {
  return {
    id: `canonical-${id}`,
    publicUrl: imageUrl(group, file),
    caption,
    alt_text: caption,
    sort_order: id,
    canonical: true,
  }
}

function section(id, kind, title, content, images = [], lane = 'main') {
  return {
    id: `canonical-section-${id}`,
    section_type: `v12_${lane}_${kind}_${String(id).padStart(3, '0')}`,
    title,
    content,
    sort_order: id * 10,
    linkedAssets: [],
    images,
    canonical: true,
    original_title: title,
    original_content: content,
    original_sort_order: id * 10,
  }
}

const dailyMaterials = '1 soporte tipo estéreo\n1 kit de instalación FMD-1000 para IVECO Daily\n1 FMD-1000\n1 antena GPRS\n1 antena GPS\n1 precinto'

function dailyBaseSections() {
  return [
    section(1, 'intro', 'Instalación general FMD-1000 - IVECO Daily', 'Procedimiento base documentado para el montaje físico del FMD-1000 en IVECO Daily. Cuando una versión del vehículo tenga una conexión CAN específica, esa diferencia se detalla dentro de su propia instalación; el procedimiento físico se muestra completo y no se deriva a otra guía.'),
    section(2, 'materials', 'Elementos necesarios para la instalación', dailyMaterials, [
      image('daily', 'soporte-estereo.jpg', 'Soporte tipo estéreo', 1),
      image('daily', 'kit-instalacion.jpg', 'Kit de instalación', 2),
      image('daily', 'fmd1000.jpg', 'FMD-1000', 3),
      image('daily', 'antena-gprs.jpg', 'Antena GPRS', 4),
      image('daily', 'antena-gps.jpg', 'Antena GPS', 5),
      image('daily', 'precinto.jpg', 'Precinto', 6),
    ]),
    section(3, 'step', '1. Ubicación del FMD-1000', 'Identificar el sector inferior central del tablero destinado al FMD-1000. El equipo se coloca en el alojamiento indicado en la referencia.', [image('daily', 'euro5-ubicacion.jpg', 'Ubicación del equipo en el tablero', 10)]),
    section(4, 'step', '2. Retiro del compartimento', 'Retirar cuidadosamente el compartimento del tablero tirando de sus extremos. Al extraerlo queda accesible la ficha blanca asociada al conjunto.', [image('daily', 'euro5-compartimento.jpg', 'Retiro del compartimento y acceso a la ficha', 20)]),
    section(5, 'step', '3. Ubicación de las antenas', 'Fijar las antenas GPRS y GPS dentro del tablero en la zona indicada, manteniéndolas firmes y sin interferir con el cierre de los paneles.', [
      image('daily', 'gprs.jpg', 'Antena GPRS', 30), image('daily', 'gps.jpg', 'Antena GPS', 31), image('daily', 'ubicacion-antenas.jpg', 'Ubicación de las antenas', 32),
    ]),
    section(6, 'step', '4. Colocación del soporte', 'Colocar el soporte tipo estéreo en el alojamiento del tablero una vez ubicadas las antenas.', [image('daily', 'soporte.jpg', 'Soporte colocado', 40)]),
    section(7, 'step', '5. Conexión de las antenas', 'Conectar las antenas GPS y GPRS al FMD-1000. Para acceder a la conexión GPRS, retirar la tapa superior deslizándola hacia atrás; conectar la antena en el punto indicado. Conectar la antena GPS en su conector correspondiente.', [
      image('daily', 'conexion-gprs.jpg', 'Conexión GPRS', 50), image('daily', 'conexion-gps.jpg', 'Conexión GPS', 51),
    ]),
    section(8, 'step', '6. Cierre y precinto del equipo', 'Colocar nuevamente la tapa superior y la tapa de seguridad trasera del FMD-1000. Asegurar con el tornillo y colocar el precinto de seguridad.', [image('daily', 'tapa-precinto.jpg', 'Cierre y precinto', 60)]),
    section(9, 'step', '7. Conexión final y montaje', 'Conectar la ficha blanca extraída del tablero con la ficha macho del cable de instalación. Conectar el otro extremo al FMD-1000 e introducir el equipo en el soporte.', [image('daily', 'euro5-instalado.jpg', 'FMD-1000 instalado', 70)]),
    section(12, 'verification', 'Comprobación final', 'Con el montaje finalizado, verificar que el FMD-1000 detecte velocidad y que se encuentre reportando correctamente al sistema de seguimiento.', [
      image('daily', 'euro5-tablero-verificacion.jpg', 'Verificación en tablero', 80), image('daily', 'euro5-fmd-verificacion.jpg', 'Verificación del FMD-1000', 81),
    ]),
  ]
}

function dailyEuro3Sections() {
  const base = dailyBaseSections().filter(item => !item.section_type.includes('_verification_'))
  return [
    ...base.map(item => item.id === 'canonical-section-1' ? { ...item, title: 'Instalación FMD-1000 - IVECO Daily Euro 3', content: 'Procedimiento completo para IVECO Daily Euro 3. Incluye todos los pasos físicos de instalación y, además, la conexión CAN específica de esta versión.' } : item),
    section(10, 'step', '8. Extensión de CAN H y CAN L', 'Desde el cable de instalación, agregar una extensión hasta el fin de CAN del vehículo: utilizar el cable blanco para CAN L y el cable verde para CAN H.', [image('daily', 'euro3-empalme-instalacion.jpg', 'Extensión CAN desde el cable de instalación', 90)]),
    section(11, 'step', '9. Empalme en el fin de CAN', 'Llevar la extensión hasta el fin de CAN ubicado detrás de la guantera, del lado del acompañante. Realizar allí el empalme de CAN L y CAN H según la referencia fotográfica.', [
      image('daily', 'euro3-empalme-fin-can.jpg', 'Empalme CAN', 100), image('daily', 'euro3-fin-can.jpg', 'Fin de CAN detrás de la guantera', 101), image('daily', 'euro3-instalado.jpg', 'Resultado de la instalación Euro 3', 102),
    ]),
    section(12, 'verification', 'Comprobación final', 'Con el montaje finalizado, verificar que el FMD-1000 detecte velocidad y que se encuentre reportando correctamente al sistema de seguimiento.', [
      image('daily', 'euro5-tablero-verificacion.jpg', 'Verificación en tablero', 110), image('daily', 'euro5-fmd-verificacion.jpg', 'Verificación del FMD-1000', 111),
    ]),
  ]
}

function swaySections() {
  return [
    section(1, 'intro', 'Instalación DG-600 por FMS - IVECO S-WAY', 'Procedimiento armado a partir del material de instalación y de las pruebas documentadas para IVECO S-WAY. La conexión utilizada es la ficha FMS verde ubicada detrás del tacógrafo.', [image('sway', 'iveco-sway.jpg', 'IVECO S-WAY de referencia', 1)]),
    section(2, 'materials', 'Elementos y cable de conexión', 'DG-600\nCable DG600 FMS para conexión a la ficha FMS del vehículo. Utilizar el ramal documentado para esta instalación.', [image('sway', 'cable-dg600-fms.jpg', 'Cable DG600 FMS', 10)]),
    section(3, 'step', '1. Acceso a la ficha FMS', 'Acceder al sector del tacógrafo y localizar detrás de él la ficha FMS verde del vehículo. Extraerla lo necesario para realizar la conexión sin forzar el ramal original.', [image('sway', 'ubicacion-fms.jpg', 'Ubicación de la ficha FMS detrás del tacógrafo', 20)]),
    section(4, 'step', '2. Conexión del ramal FMS', 'Conectar el cable DG600 FMS a la ficha FMS verde del S-WAY. Verificar que los conectores queden completamente asentados y que el ramal no quede tensionado.'),
    section(5, 'step', '3. Conexión y ubicación del DG-600', 'Conectar el DG-600 al ramal FMS y ubicar el módulo dentro de la cabina de forma firme, evitando que interfiera con tapas, cableados o mecanismos del sector.', [image('sway', 'conexion-final-dg600.jpg', 'Conexión final del DG-600', 30)]),
    section(6, 'verification', '4. Comprobación de comunicación', 'Con el DG-600 conectado al FMS, verificar la recepción de datos CAN. En la unidad documentada se obtuvieron los datos disponibles por FMS, con excepción de la presión de aceite.'),
    section(10, 'technical', 'Datos técnicos de la unidad probada', 'CAN: 500\nConexión: ficha FMS verde detrás del tacógrafo\nLectura: datos CAN disponibles por FMS\nPresión de aceite: no disponible en la prueba', [], 'support'),
    section(11, 'notes', 'Alcance de la validación', 'La visita documentada no incluyó pruebas en movimiento. La instalación queda documentada para conexión y lectura estática por FMS; la validación dinámica queda pendiente si se requiere comprobar variables bajo marcha.', [], 'support'),
  ]
}

function hasSameAsEuro5(sections = []) {
  return sections.some(item => /(?:igual|mismo|lo mismo)[\s\S]{0,60}(?:euro\s*5|daily\s*5)/i.test(`${item.title || ''} ${item.content || ''}`))
}

function hasProcedure(sections = []) {
  return sections.some(item => /v12_main_(?:step|procedure|access|location|connector|wiring|power|final)_/i.test(item.section_type || '') || /^(?:step|procedure|access|location|connector|wiring|power|final)$/i.test(item.section_type || ''))
}

export function canonicalSummaryAdditions(brand, family, guides = [], hiddenCanonicalKeys = new Set()) {
  if (norm(brand?.name) !== 'iveco') return guides
  const familyName = norm(family?.name)
  const next = [...guides]
  const guideText = guide => norm(`${guide.title || ''} ${guide.variant || ''} ${guide.slug || ''}`)

  if (familyName === 'daily') {
    if (!hiddenCanonicalKeys.has('daily-general') && !next.some(guide => /instalacion general|daily general|general fmd/.test(guideText(guide)))) {
      next.unshift({
        id: 'canonical-daily-general', canonicalKey: 'daily-general', synthetic: true,
        family_id: family.id, guide_type: 'BASE', variant: 'Instalación general', slug: 'instalacion-general-fmd-1000',
        equipment: 'FMD-1000', status: 'BORRADOR', content_kind: 'INSTRUCTIVO', title: 'IVECO Daily - Instalación general', summary: '',
      })
    }
    if (!hiddenCanonicalKeys.has('daily-euro3') && !next.some(guide => /euro\s*3/.test(guideText(guide)))) {
      next.push({
        id: 'canonical-daily-euro3', canonicalKey: 'daily-euro3', synthetic: true,
        family_id: family.id, guide_type: 'VARIANTE', variant: 'Euro 3', slug: 'euro-3-fmd-1000',
        equipment: 'FMD-1000', status: 'BORRADOR', content_kind: 'INSTRUCTIVO', title: 'IVECO Daily Euro 3', summary: '',
      })
    }
  }

  if (familyName === 's-way' && !hiddenCanonicalKeys.has('sway') && !next.some(guide => guide.content_kind !== 'REFERENCIA')) {
    next.unshift({
      id: 'canonical-sway', canonicalKey: 'sway', synthetic: true,
      family_id: family.id, guide_type: 'MODELO', variant: 'S-WAY', slug: 'iveco-s-way', equipment: 'DG-600',
      status: 'BORRADOR', content_kind: 'INSTRUCTIVO', title: 'IVECO S-WAY', summary: '',
    })
  }
  return next
}

export function canonicalSectionsForSynthetic(key) {
  if (key === 'daily-general') return dailyBaseSections()
  if (key === 'daily-euro3') return dailyEuro3Sections()
  if (key === 'sway') return swaySections()
  return []
}

export function applyCanonicalFallback({ brand, family, guide, sections = [] }) {
  if (norm(brand?.name) !== 'iveco') return sections
  const familyName = norm(family?.name)
  const identity = norm(`${guide?.title || ''} ${guide?.variant || ''} ${guide?.slug || ''}`)

  if (familyName === 'daily') {
    if (/euro\s*3/.test(identity)) return dailyEuro3Sections()
    const isGeneral = /instalacion general|daily general|general fmd/.test(identity)
    if (isGeneral && !hasProcedure(sections)) return dailyBaseSections()
    if (hasSameAsEuro5(sections)) {
      const specific = sections.filter(item => !/(?:igual|mismo|lo mismo)[\s\S]{0,60}(?:euro\s*5|daily\s*5)/i.test(`${item.title || ''} ${item.content || ''}`))
      const specificUseful = specific.filter(item => /can|pin|conector|ficha|senal|señal/i.test(`${item.title || ''} ${item.content || ''}`))
      return [...dailyBaseSections(), ...specificUseful.map((item, index) => ({ ...item, id: `canonical-specific-${item.id || index}`, sort_order: 130 + index * 10 }))]
    }
  }

  if (familyName === 's-way' && !hasProcedure(sections)) {
    const support = sections.filter(item => /support|technical|configuration|source|notes|material/i.test(item.section_type || ''))
    return [...swaySections(), ...support.map((item, index) => ({ ...item, id: `canonical-sway-support-${item.id || index}`, sort_order: 140 + index * 10 }))]
  }

  return sections
}
