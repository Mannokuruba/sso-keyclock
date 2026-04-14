import { useState } from 'react'

const existingClaims = [
  {
    id: 'CLM-2024-0831',
    type: 'Auto',
    description: 'Rear-end collision on Highway 101',
    filed: 'Apr 8, 2026',
    status: 'In Review',
    estimatedPayout: '$3,400',
  },
  {
    id: 'CLM-2023-0512',
    type: 'Home',
    description: 'Water damage from burst pipe in kitchen',
    filed: 'Sep 14, 2023',
    status: 'Settled',
    estimatedPayout: '$8,750',
  },
]

const statusColor = {
  'In Review': 'status-pending',
  Settled: 'status-ok',
  Denied: 'status-denied',
  Open: 'status-active',
}

export default function Claims() {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: '', description: '', date: '', amount: '' })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    // In production: POST to your backend API with the Auth0 token
    setSubmitted(true)
    setShowForm(false)
    setForm({ type: '', description: '', date: '', amount: '' })
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Claims</h1>
          <p className="page-sub">Track existing claims or file a new one.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Claim'}
        </button>
      </div>

      {/* Success banner */}
      {submitted && (
        <div className="alert-success">
          ✅ Claim submitted successfully! Our team will review it within 2 business days.
          <button className="alert-close" onClick={() => setSubmitted(false)}>×</button>
        </div>
      )}

      {/* New claim form */}
      {showForm && (
        <div className="section-card">
          <h2 className="section-heading">File a New Claim</h2>
          <form className="claim-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="type">Insurance Type</label>
              <select
                id="type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
              >
                <option value="">Select policy type...</option>
                <option value="auto">Auto Insurance</option>
                <option value="home">Home Insurance</option>
                <option value="life">Life Insurance</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="date">Incident Date</label>
              <input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="amount">Estimated Loss Amount ($)</label>
              <input
                id="amount"
                type="number"
                min="0"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>

            <div className="form-group full">
              <label htmlFor="description">Incident Description</label>
              <textarea
                id="description"
                rows={4}
                placeholder="Describe what happened in detail..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                maxLength={1000}
              />
              <span className="char-count">{form.description.length}/1000</span>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">Submit Claim</button>
              <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Claims list */}
      <div className="section-card">
        <h2 className="section-heading">Claim History</h2>
        {existingClaims.length === 0 ? (
          <p className="empty-state">No claims on file.</p>
        ) : (
          <ul className="claims-list">
            {existingClaims.map((c) => (
              <li key={c.id} className="claim-item">
                <div className="claim-header">
                  <span className="claim-id">Claim #{c.id}</span>
                  <span className={`activity-status ${statusColor[c.status]}`}>{c.status}</span>
                </div>
                <p className="claim-desc">{c.description}</p>
                <div className="claim-meta">
                  <span>📅 Filed: {c.filed}</span>
                  <span>💰 Est. Payout: {c.estimatedPayout}</span>
                  <span>🏷️ {c.type}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
