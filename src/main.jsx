import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import DonationTree from './DonationTree'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DonationTree />
  </StrictMode>,
)
