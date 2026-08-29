import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Dashboard from './Dashboard.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {/* The landing page is gone, but Share copies location.href — links
            already minted as /app?countries=…&dates=… must keep resolving.
            Same element rather than a redirect, so no query params are lost. */}
        <Route path="/app" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
