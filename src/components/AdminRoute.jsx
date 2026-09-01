import { Navigate, Outlet } from 'react-router'
import { useEdit } from '../context/EditContext.jsx'

function AdminRoute() {
  const { editing, loading } = useEdit()
  if (loading) return <div className="page-card">Comprobando acceso...</div>
  if (!editing) return <Navigate to="/editar" replace />
  return <Outlet />
}

export default AdminRoute
