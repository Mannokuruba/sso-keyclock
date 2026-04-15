import { Routes, Route } from 'react-router-dom'
import { useKeycloak } from '@react-keycloak/web'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingSpinner from './components/LoadingSpinner'
import SessionWarning from './components/SessionWarning'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import Policies from './pages/Policies'
import Claims from './pages/Claims'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'

export default function App() {
  const { initialized } = useKeycloak()

  // Wait for Keycloak to finish its silent SSO check before rendering
  if (!initialized) return <LoadingSpinner message="Authenticating securely..." />

  return (
    <div className="app-shell">
      <Navbar />
      <SessionWarning />
      <main className="main-content">
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />

          {/* Protected — any authenticated customer */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/policies"  element={<ProtectedRoute><Policies /></ProtectedRoute>} />
          <Route path="/claims"    element={<ProtectedRoute><Claims /></ProtectedRoute>} />
          <Route path="/profile"   element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}
