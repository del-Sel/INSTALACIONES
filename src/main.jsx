import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { EditProvider } from './context/EditContext.jsx'
import './index.css'
import './library.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <EditProvider>
        <App />
      </EditProvider>
    </BrowserRouter>
  </StrictMode>,
)
