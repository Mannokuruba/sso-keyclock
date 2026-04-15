import { useState } from 'react'

const mockPolicies = [
  {
    id: 'INS-2024-004821',
    type: 'Auto Insurance',
    icon: '🚗',
    status: 'Active',
    premium: '$142.00/mo',
    coverage: '$500,000',
    deductible: '$1,000',
    renewsOn: 'Jan 15, 2027',
    vehicle: '2021 Toyota Camry',
  },
  {
    id: 'INS-2022-001234',
    type: 'Home Insurance',
    icon: '🏠',
    status: 'Active',
    premium: '$198.50/mo',
    coverage: '$650,000',
    deductible: '$2,500',
    renewsOn: 'Mar 22, 2027',
    vehicle: null,
  },
  {
    id: 'INS-2023-008876',
    type: 'Life Insurance',
    icon: '💚',
    status: 'Active',
    premium: '$87.00/mo',
    coverage: '$1,000,000',
    deductible: null,
    renewsOn: 'Dec 01, 2043',
    vehicle: null,
  },
]

export default function Policies() {
  const [selected, setSelected] = useState(null)

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>My Policies</h1>
        <p className="page-sub">All your active insurance coverage in one place.</p>
      </div>

      <div className="policy-list">
        {mockPolicies.map((p) => (
          <div key={p.id} className="policy-card">
            <div className="policy-card-header">
              <span className="policy-icon">{p.icon}</span>
              <div className="policy-meta">
                <h3 className="policy-type">{p.type}</h3>
                <p className="policy-id">Policy #{p.id}</p>
              </div>
              <span className={`badge ${p.status === 'Active' ? 'badge-green' : 'badge-gray'}`}>
                {p.status}
              </span>
            </div>

            <div className="policy-details-grid">
              <div className="policy-detail">
                <span className="detail-label">Monthly Premium</span>
                <span className="detail-val">{p.premium}</span>
              </div>
              <div className="policy-detail">
                <span className="detail-label">Coverage Amount</span>
                <span className="detail-val">{p.coverage}</span>
              </div>
              {p.deductible && (
                <div className="policy-detail">
                  <span className="detail-label">Deductible</span>
                  <span className="detail-val">{p.deductible}</span>
                </div>
              )}
              <div className="policy-detail">
                <span className="detail-label">Renews On</span>
                <span className="detail-val">{p.renewsOn}</span>
              </div>
              {p.vehicle && (
                <div className="policy-detail">
                  <span className="detail-label">Vehicle</span>
                  <span className="detail-val">{p.vehicle}</span>
                </div>
              )}
            </div>

            <div className="policy-actions">
              <button className="btn-outline" onClick={() => setSelected(selected === p.id ? null : p.id)}>
                {selected === p.id ? 'Hide Details' : 'View Certificate'}
              </button>
              <button className="btn-outline">Download PDF</button>
            </div>

            {selected === p.id && (
              <div className="policy-certificate">
                <p className="cert-title">Certificate of Insurance</p>
                <p>This certifies that the above-named policyholder carries insurance coverage
                   as described. Coverage is subject to the terms and conditions of the policy.</p>
                <p><strong>Issued:</strong> Jan 15, 2026 &nbsp;|&nbsp; <strong>Effective Through:</strong> {p.renewsOn}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
