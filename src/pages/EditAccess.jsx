import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useEdit } from '../context/EditContext.jsx'
import AppIcon from '../components/AppIcon.jsx'
import fulmarLogo from '../assets/fulmar-logo.jpg'

function EditAccess() {
  const { editing, activarEdicion } = useEdit()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedReturn = searchParams.get('return') || '/'
  const returnTo = requestedReturn.startsWith('/') && !requestedReturn.startsWith('/editar') ? requestedReturn : '/'
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (editing) return <Navigate to={returnTo} replace />

  async function enviar(event) {
    event.preventDefault()
    setError('')

    if (!/^\d{5}$/.test(pin)) {
      setError('El código debe tener 5 números.')
      return
    }

    setLoading(true)
    const { error: loginError } = await activarEdicion(pin)

    if (loginError) {
      setError(loginError.message === 'Invalid login credentials' ? 'Código incorrecto.' : loginError.message)
      setPin('')
      setLoading(false)
      return
    }

    navigate(returnTo, { replace: true })
  }

  return (
    <div className="edit-access-page">
      <div className="edit-access-card edit-access-card-v6">
        <img src={fulmarLogo} alt="FUL-MAR" className="edit-access-logo-v6" decoding="async" />
        <div className="edit-lock edit-lock-v6"><AppIcon name="edit" size={21} /></div>
        <div className="page-eyebrow">EDICIÓN</div>
        <h1>Activar modo edición</h1>
        <p>Ingresá el código de administración para habilitar la edición directa.</p>

        <form onSubmit={enviar} className="pin-form">
          <label htmlFor="edit-pin">Código de edición</label>
          <input
            id="edit-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength="5"
            value={pin}
            onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="•••••"
            autoFocus
          />
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="primary-button" disabled={loading || pin.length !== 5}>
            {loading ? 'Comprobando...' : 'Entrar en modo edición'}
          </button>
        </form>

        <div className="pin-help">La base puede consultarse normalmente sin activar este modo.</div>
      </div>
    </div>
  )
}

export default EditAccess
