export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="loading-screen">
      <div className="spinner-wrap">
        <div className="spinner" />
        <p className="spinner-msg">{message}</p>
      </div>
    </div>
  )
}
