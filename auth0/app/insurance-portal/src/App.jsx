import { Routes, Route } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingSpinner from './components/LoadingSpinner'
import SessionWarning from './components/SessionWarning'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import Policies from './pages/Policies'
import Claims from './pages/Claims'
import Profile from './pages/Profile'
import CallbackPage from './pages/CallbackPage'
import NotFound from './pages/NotFound'

export default function App() {
  const { isLoading, error } = useAuth0()

  if (isLoading) return <LoadingSpinner message="Authenticating securely..." />

  if (error) {
    return (
      <div className="error-screen">
        <div className="error-card">
          <span className="error-icon">⚠️</span>
          <h2>Authentication Error</h2>
          <p>{error.message}</p>
          <button onClick={() => window.location.replace('/')}>Return to Login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Navbar />
      <SessionWarning />
      <main className="main-content">
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/callback" element={<CallbackPage />} />

          {/* Protected — any authenticated customer */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/policies"  element={<ProtectedRoute><Policies /></ProtectedRoute>} />
          <Route path="/claims"    element={<ProtectedRoute><Claims /></ProtectedRoute>} />
          <Route path="/profile"   element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Role-gated examples — uncomment and create pages when needed:
          <Route path="/admin"     element={<ProtectedRoute requiredRole="admin"><AdminPanel /></ProtectedRoute>} />
          <Route path="/agent"     element={<ProtectedRoute requiredRole="agent"><AgentView /></ProtectedRoute>} />
          */}

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}
