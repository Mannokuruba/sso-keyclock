import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="loading-screen">
      <div className="spinner-wrap">
        <p style={{ fontSize: '4rem' }}>404</p>
        <p className="spinner-msg">Page not found.</p>
        <Link to="/" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
          Back to Home
        </Link>
      </div>
    </div>
  )
}
