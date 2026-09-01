import { lazy, Suspense } from 'react'
import { Navigate, Routes, Route } from 'react-router'
import Layout from './components/Layout.jsx'
import AdminRoute from './components/AdminRoute.jsx'

const Home = lazy(() => import('./pages/Home.jsx'))
const Search = lazy(() => import('./pages/Search.jsx'))
const Brand = lazy(() => import('./pages/Brand.jsx'))
const Family = lazy(() => import('./pages/Family.jsx'))
const Guide = lazy(() => import('./pages/Guide.jsx'))
const EditAccess = lazy(() => import('./pages/EditAccess.jsx'))
const AdminGuides = lazy(() => import('./pages/AdminGuides.jsx'))
const AdminGuideEdit = lazy(() => import('./pages/AdminGuideEdit.jsx'))
const AdminMaterials = lazy(() => import('./pages/AdminMaterials.jsx'))
const AdminPending = lazy(() => import('./pages/AdminPending.jsx'))
const LibraryCollection = lazy(() => import('./pages/LibraryCollection.jsx'))

function RouteFallback() {
  return <div className="page-card route-loading-v13" role="status">Cargando sección…</div>
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/buscar" element={<Search />} />
          <Route path="/biblioteca" element={<Navigate to="/" replace />} />
          <Route path="/biblioteca/:collectionId" element={<LibraryCollection />} />
          <Route path="/editar" element={<EditAccess />} />
          <Route path="/:brandSlug" element={<Brand />} />
          <Route path="/:brandSlug/:familySlug" element={<Family />} />
          <Route path="/:brandSlug/:familySlug/guia/:guideSlug" element={<Guide />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin/guias" element={<AdminGuides />} />
            <Route path="/admin/guias/:guideId" element={<AdminGuideEdit />} />
            <Route path="/admin/material" element={<AdminMaterials />} />
            <Route path="/admin/pendientes" element={<AdminPending />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
