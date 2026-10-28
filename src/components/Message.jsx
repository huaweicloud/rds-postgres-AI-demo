export default function Message({ type, text }) {
  if (!text) return null

  const icons = {
    success: '\u2713',
    error: '\u2717',
    info: '\u2139',
  }

  return (
    <div className={`alert alert-${type}`}>
      <span className="alert-icon">{icons[type] || ''}</span>
      <span>{text}</span>
    </div>
  )
}
