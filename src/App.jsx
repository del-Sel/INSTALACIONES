import { Routes, Route } from 'react-router'
import Layout from './components/Layout.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import Home from './pages/Home.jsx'
import Search from './pages/Search.jsx'
import Brand from './pages/Brand.jsx'
import Family from './pages/Family.jsx'
import Guide from './pages/Guide.jsx'
import EditAccess from './pages/EditAccess.jsx'
import AdminGuides from './pages/AdminGuides.jsx'
import AdminGuideEdit from './pages/AdminGuideEdit.jsx'
import AdminMaterials from './pages/AdminMaterials.jsx'
import AdminPending from './pages/AdminPending.jsx'
import TechnicalLibrary from './pages/TechnicalLibrary.jsx'
import LibraryCollection from './pages/LibraryCollection.jsx'

function Placeholder({ title }) { return <div className="page-card"><h1>{title}</h1><p>Sección no disponible.</p></div> }

function App(){return <Routes><Route element={<Layout/>}><Route path="/" element={<Home/>}/><Route path="/buscar" element={<Search/>}/><Route path="/biblioteca" element={<TechnicalLibrary/>}/><Route path="/biblioteca/:collectionId" element={<LibraryCollection/>}/><Route path="/editar" element={<EditAccess/>}/><Route path="/:brandSlug" element={<Brand/>}/><Route path="/:brandSlug/:familySlug" element={<Family/>}/><Route path="/:brandSlug/:familySlug/guia/:guideSlug" element={<Guide/>}/><Route element={<AdminRoute/>}><Route path="/admin/guias" element={<AdminGuides/>}/><Route path="/admin/guias/:guideId" element={<AdminGuideEdit/>}/><Route path="/admin/material" element={<AdminMaterials/>}/><Route path="/admin/pendientes" element={<AdminPending/>}/></Route></Route></Routes>}
export default App
