import { useAuth0 } from '@auth0/auth0-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { logoutConfig } from '../auth0-config'
import { useState } from 'react'

export default function Navbar() {
  const { isAuthenticated, user, logout, loginWithRedirect } = useAuth0()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/policies', label: 'My Policies' },
    { to: '/claims', label: 'Claims' },
    { to: '/profile', label: 'Profile' },
  ]

  const isActive = (path) => location.pathname === path

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
                {user?.picture
                  ? <img src={user.picture} alt={user.name} className="avatar-img" />
                  : <span className="avatar-initials">{user?.name?.[0]?.toUpperCase() ?? 'U'}</span>
                }
              </button>

              {menuOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <p className="dropdown-name">{user?.name}</p>
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
                    onClick={() => logout(logoutConfig)}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="btn-login"
              onClick={() => loginWithRedirect()}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
