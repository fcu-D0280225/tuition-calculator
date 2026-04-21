import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import SharePage from './pages/SharePage.jsx'
import './index.css'

const shareMatch = window.location.pathname.match(/^\/view\/([^/?#]+)/)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {shareMatch ? <SharePage token={decodeURIComponent(shareMatch[1])} /> : <App />}
  </StrictMode>,
)
