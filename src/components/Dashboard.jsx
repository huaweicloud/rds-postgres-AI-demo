import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Message from './Message'
import ChangeEmail from './ChangeEmail'
import ResetPasswordInline from './ResetPasswordInline'
import { getErrorMessage } from '../lib/errors'

export default function Dashboard() {
  const { user, signOut, reauthenticate, reauthCompleted } = useAuth()
  const { t, language } = useLanguage()
  const [message, setMessage] = useState({ type: '', text: '' })
  const [confirming, setConfirming] = useState(false)
  const [reauthLoading, setReauthLoading] = useState(false)
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)

  // 通过重新认证邮件链接返回页面后，提示重新认证成功
  useEffect(() => {
    if (reauthCompleted) {
      setMessage({ type: 'success', text: t.message.reauthSuccess })
    }
  }, [reauthCompleted, t])

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, language) })
    }
  }

  const handleReauthenticate = async () => {
    setMessage({ type: '', text: '' })
    setReauthLoading(true)
    const { error } = await reauthenticate()
    setReauthLoading(false)

    if (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, language) })
    } else {
      setMessage({ type: 'success', text: t.message.reauthSent })
    }
  }

  const handleConfirmSignOut = () => {
    if (confirming) {
      handleSignOut()
    } else {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
    }
  }

  const locale = language === 'zh' ? 'zh-CN' : 'en-US'
  const createdAt = new Date(user.created_at)
  const formattedDate = createdAt.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const formattedTime = createdAt.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="avatar">
          {user.email?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="dashboard-greeting">{t.dashboard.welcome}</h1>
          <p className="dashboard-email">{user.email}</p>
          {user.new_email && (
            <p className="dashboard-email dashboard-email--pending">
              {t.changeEmail.title}: {user.new_email}
            </p>
          )}
        </div>
      </div>

      <Message type={message.type} text={message.text} />

      <div className="dashboard-details">
        <div className="detail-row">
          <span className="detail-label">{t.dashboard.userId}</span>
          <span className="detail-value detail-id">{user.id}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">{t.dashboard.registered}</span>
          <span className="detail-value">{formattedDate} {formattedTime}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">{t.dashboard.lastSignIn}</span>
          <span className="detail-value">{new Date(user.last_sign_in_at).toLocaleString(locale)}</span>
        </div>
      </div>

      {showChangeEmail ? (
        <ChangeEmail onCancel={() => setShowChangeEmail(false)} />
      ) : showResetPassword ? (
        <ResetPasswordInline onCancel={() => setShowResetPassword(false)} />
      ) : (
        <>
          <button
            className="btn-change-email"
            onClick={() => setShowChangeEmail(true)}
          >
            {t.dashboard.changeEmail}
          </button>
          <button
            className="btn-reset-password"
            onClick={() => setShowResetPassword(true)}
          >
            {t.dashboard.resetPassword}
          </button>
          <button
            className="btn-reauthenticate"
            onClick={handleReauthenticate}
            disabled={reauthLoading}
          >
            {reauthLoading ? t.auth.processing : t.dashboard.reauthenticate}
          </button>
        </>
      )}

      <button
        className={`btn-signout ${confirming ? 'btn-signout--confirm' : ''}`}
        onClick={handleConfirmSignOut}
      >
        {confirming ? t.dashboard.confirmSignOut : t.dashboard.signOut}
      </button>
    </div>
  )
}
