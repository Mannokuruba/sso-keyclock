import { useKeycloak } from '@react-keycloak/web'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'

export default function Navbar() {
  const { keycloak } = useKeycloak()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const user = keycloak.tokenParsed
  const isAuthenticated = keycloak.authenticated

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/policies',  label: 'My Policies' },
    { to: '/claims',    label: 'Claims' },
    { to: '/profile',   label: 'Profile' },
  ]

  const isActive = (path) => location.pathname === path

  const displayName = user?.name ?? user?.preferred_username ?? 'U'
  const initials    = displayName[0].toUpperCase()

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <Link to="/" className="navbar-brand">
          <span className="brand-shield">🛡️</span>
          <span className="brand-name">InsureConnect</span>
        </Link>

        {/* Desktop nav links — only when authenticated */}
        {isAuthenticated && (
          <ul className="nav-links">
            {navLinks.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className={`nav-link ${isActive(to) ? 'active' : ''}`}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Auth controls */}
        <div className="nav-auth">
          {isAuthenticated ? (
            <div className="user-menu">
              <button
                className="user-avatar-btn"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="User menu"
              >
                <span className="avatar-initials">{initials}</span>
              </button>

              {menuOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <p className="dropdown-name">{displayName}</p>
                    <p className="dropdown-email">{user?.email}</p>
                  </div>
                  <hr className="dropdown-divider" />
                  <button
                    className="dropdown-item"
                    onClick={() => { setMenuOpen(false); navigate('/profile') }}
                  >
                    Account Settings
                  </button>
                  <button
                    className="dropdown-item danger"
                    onClick={() => keycloak.logout({ redirectUri: window.location.origin })}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="btn-login"
              onClick={() => keycloak.login()}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
