import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useEdit } from '../context/EditContext.jsx'
import AppIcon from './AppIcon.jsx'
import fulmarLogo from '../assets/fulmar-logo.jpg'
import { loadCatalogSnapshot } from '../lib/catalogCache.js'
import { APP_BUILD_DATE, APP_VERSION } from '../version.js'

function NavItem({ to, end = false, icon, children }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `sidebar-link-v6 ${isActive ? 'active' : ''}`}>
      <span className="sidebar-link-icon-v6"><AppIcon name={icon} size={19} /></span>
      <span className="sidebar-link-label-v6">{children}</span>
    </NavLink>
  )
}

function MobileItem({ to, end = false, icon, children }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `mobile-nav-link-v6 ${isActive ? 'active' : ''}`}>
      <AppIcon name={icon} size={20} />
      <span>{children}</span>
    </NavLink>
  )
}

function Layout() {
  const { editing, desactivarEdicion } = useEdit()
  const [connectionStatus, setConnectionStatus] = useState(() => (navigator.onLine ? 'checking' : 'offline'))
  const location = useLocation()
  const currentPlace = `${location.pathname}${location.search}${location.hash}`
  const editTarget = `/editar?return=${encodeURIComponent(currentPlace === '/editar' ? '/' : currentPlace)}`

  const connectionLabel = connectionStatus === 'online'
    ? 'Conexión activa'
    : connectionStatus === 'checking'
      ? 'Verificando conexión'
      : 'Sin conexión'
  const connectionClass = connectionStatus === 'online' ? 'online' : connectionStatus === 'checking' ? 'checking' : 'offline'

  useEffect(() => {
    let active = true
    if (!navigator.onLine) {
      setConnectionStatus('offline')
      return () => { active = false }
    }

    setConnectionStatus('checking')
    loadCatalogSnapshot()
      .then(() => { if (active) setConnectionStatus('online') })
      .catch(() => { if (active) setConnectionStatus('offline') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const goOnline = () => {
      setConnectionStatus('checking')
      loadCatalogSnapshot({ force: true })
        .then(() => setConnectionStatus('online'))
        .catch(() => setConnectionStatus('offline'))
    }
    const goOffline = () => setConnectionStatus('offline')
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return (
    <div className="app-shell-v6">
      <a className="skip-link-v124" href="#main-content">Saltar al contenido</a>
      <aside className="sidebar-v6" aria-label="Navegación principal">
        <NavLink to="/" className="sidebar-brand-v6" aria-label="FUL-MAR - Inicio">
          <img src={fulmarLogo} alt="FUL-MAR" decoding="async" />
          <span>Base técnica de instalaciones</span>
        </NavLink>

        <nav className="sidebar-nav-v6">
          <div className="sidebar-group-label-v6">Navegación</div>
          <NavItem to="/" end icon="home">Inicio</NavItem>
          <NavItem to="/buscar" icon="search">Buscar documentación</NavItem>
          <NavItem to="/biblioteca" icon="installations">Biblioteca técnica</NavItem>

          <div className="sidebar-separator-v6" />
          <div className="sidebar-group-label-v6">Edición</div>

          {!editing ? (
            <NavItem to={editTarget} icon="edit">Activar edición</NavItem>
          ) : (
            <div className="edit-mode-card-v6">
              <div className="edit-mode-card-head-v6">
                <span className="edit-mode-dot-v6" />
                <div><strong>Modo edición</strong><span>Edición directa habilitada</span></div>
              </div>
              <button type="button" onClick={desactivarEdicion} className="exit-edit-button-v6">
                <AppIcon name="logout" size={16} />
                Salir de edición
              </button>
            </div>
          )}

          {editing && (
            <>
              <div className="sidebar-separator-v6" />
              <div className="sidebar-group-label-v6">Administración</div>
              <NavItem to="/admin/guias" icon="guides">Gestionar contenido</NavItem>
              <NavItem to="/admin/material" icon="upload">Material sin vincular</NavItem>
              <NavItem to="/admin/pendientes" icon="pending">Pendientes de revisión</NavItem>
            </>
          )}
        </nav>

        <div className="sidebar-footer-v6">
          {editing && (
            <div className="app-version-v125" title={`Versión instalada: ${APP_VERSION} · ${APP_BUILD_DATE}`}>
              <strong>Biblioteca técnica · {APP_VERSION}</strong>
              <span>Actualizada {APP_BUILD_DATE}</span>
            </div>
          )}
          <span className={`system-status-v6 ${connectionClass}`} aria-live="polite"><i />{connectionLabel}</span>
        </div>
      </aside>

      <div className="main-area-v6">
        <header className="topbar-v6">
          <div className="topbar-copy-v6">
            <strong>Biblioteca técnica</strong>
            <span>{editing ? `Base técnica interna · ${APP_VERSION}` : 'Base técnica de instalaciones'}</span>
          </div>
          <div className="topbar-actions-v6">
            <span className={`system-status-v6 ${connectionClass}`} aria-live="polite"><i />{connectionLabel}</span>
            {editing && <span className="topbar-edit-v6">Modo edición</span>}
          </div>
        </header>

        <main id="main-content" className="content-v6" tabIndex="-1"><Outlet /></main>
      </div>

      <nav className="mobile-nav-v6" aria-label="Navegación móvil">
        <MobileItem to="/" end icon="home">Inicio</MobileItem>
        <MobileItem to="/buscar" icon="search">Buscar</MobileItem>
        <MobileItem to="/biblioteca" icon="installations">Biblioteca</MobileItem>
        <MobileItem to={editTarget} icon="edit">Edición</MobileItem>
      </nav>
    </div>
  )
}

export default Layout
