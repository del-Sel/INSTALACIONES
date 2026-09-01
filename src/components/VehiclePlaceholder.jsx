import AppIcon from './AppIcon.jsx'

function VehiclePlaceholder({ label = 'Imagen no disponible', compact = false }) {
  return (
    <div className={`vehicle-placeholder-v6 ${compact ? 'compact' : ''}`} aria-label={label}>
      <span className="vehicle-placeholder-icon-v6"><AppIcon name="truck" size={compact ? 28 : 42} /></span>
      {!compact && <span>{label}</span>}
    </div>
  )
}

export default VehiclePlaceholder
