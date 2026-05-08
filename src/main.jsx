import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import SharePage from './pages/SharePage.jsx'
import ReferralPage from './pages/ReferralPage.jsx'
import './index.css'

const pathname = window.location.pathname
const shareMatch = pathname.match(/^\/view\/([^/?#]+)/)
const isReferral = pathname === '/referral'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {shareMatch
      ? <SharePage token={decodeURIComponent(shareMatch[1])} />
      : isReferral
        ? <ReferralPage />
        : <App />}
  </StrictMode>,
)
