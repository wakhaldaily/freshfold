import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import CustomSelect from './CustomSelect.jsx';

/**
 * Admin sign-in, (local-only) sign-up and password recovery.
 * All credential checks happen in the injected handlers: on the server when the
 * Worker API is connected, or against browser storage in local demo mode.
 */
export default function AdminAuthModal({
  isOpen,
  onClose,
  allowSignup = false,
  showDemoHint = false,
  onAuthenticate,
  onRecoverQuestion,
  onResetPassword,
  onLoginSuccess,
  onCreateAdmin,
  onToast,
}) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef(null);

  // Show / Hide password toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupQuestion, setSignupQuestion] = useState('What city is this store in?');
  const [signupAnswer, setSignupAnswer] = useState('');

  // Forgot password form state
  const [forgotStep, setForgotStep] = useState(1); // 1: identify, 2: answer & new pass
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotQuestion, setForgotQuestion] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');

  // Escape closes the dialog; focus moves into it when opened.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const first = panelRef.current?.querySelector('input, button:not([aria-label="Close"])');
    first?.focus();
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, mode, onClose]);

  if (!isOpen) return null;

  const resetAll = () => {
    setMode('login');
    setLoginEmail('');
    setLoginPassword('');
    setSignupName('');
    setSignupEmail('');
    setSignupPassword('');
    setSignupAnswer('');
    setForgotStep(1);
    setForgotEmail('');
    setForgotQuestion('');
    setForgotAnswer('');
    setForgotNewPassword('');
  };

  const withSubmitting = async (fn) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fn();
    } finally {
      setSubmitting(false);
    }
  };

  // --- 1. HANDLE SIGN IN ---
  const handleLogin = (e) => {
    e.preventDefault();
    withSubmitting(async () => {
      try {
        const admin = await onAuthenticate(loginEmail.trim(), loginPassword);
        onLoginSuccess(admin);
        onToast(`Welcome back, ${admin?.name || 'Administrator'}! Admin mode unlocked.`);
        resetAll();
        onClose();
      } catch (err) {
        onToast(err.message || 'Invalid admin credentials. Please check your email or password.');
      }
    });
  };

  // --- 2. HANDLE SIGN UP (LOCAL DEMO MODE ONLY) ---
  const handleSignup = (e) => {
    e.preventDefault();
    const emailClean = signupEmail.trim().toLowerCase();
    if (!signupName.trim() || !emailClean || !signupPassword) {
      onToast('Please fill all required fields.');
      return;
    }
    if (signupPassword.length < 6) {
      onToast('Password must be at least 6 characters.');
      return;
    }
    if (!signupAnswer.trim()) {
      onToast('Please provide a security answer for password recovery.');
      return;
    }

    const newAdmin = {
      id: `admin-${Date.now()}`,
      name: signupName.trim(),
      email: emailClean,
      password: signupPassword,
      securityQuestion: signupQuestion,
      securityAnswer: signupAnswer.trim().toLowerCase(),
    };

    withSubmitting(async () => {
      try {
        await onCreateAdmin(newAdmin);
        const { password, securityAnswer, ...identity } = newAdmin;
        onLoginSuccess({ ...identity, role: 'admin', type: 'admin' });
        onToast(`Admin account created! Logged in as ${newAdmin.name}.`);
        resetAll();
        onClose();
      } catch (err) {
        onToast(err.message || 'Failed to create admin.');
      }
    });
  };

  // --- 3. HANDLE FORGOT PASSWORD ---
  const handleForgotIdentify = (e) => {
    e.preventDefault();
    withSubmitting(async () => {
      try {
        const question = await onRecoverQuestion(forgotEmail.trim());
        setForgotQuestion(question || 'What city is this store in?');
        setForgotStep(2);
      } catch (err) {
        onToast(err.message || 'Could not start password recovery.');
      }
    });
  };

  const handleForgotReset = (e) => {
    e.preventDefault();
    if (forgotNewPassword.length < 6) {
      onToast('New password must be at least 6 characters.');
      return;
    }
    withSubmitting(async () => {
      try {
        const admin = await onResetPassword(forgotEmail.trim(), forgotAnswer, forgotNewPassword);
        onLoginSuccess(admin);
        onToast('Password reset successfully! You are now logged in.');
        resetAll();
        onClose();
      } catch (err) {
        onToast(err.message || 'Failed to reset password.');
      }
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-auth-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px' }}
      >
        <div className="modal-header">
          <div>
            <span className="caption-label">Administration Portal</span>
            <h3 id="admin-auth-title">
              {mode === 'login' && 'Admin Login'}
              {mode === 'signup' && 'Create Admin Account'}
              {mode === 'forgot' && 'Reset Admin Password'}
            </h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-content" style={{ padding: '20px 24px calc(24px + env(safe-area-inset-bottom, 0px))', flex: '1 1 0%', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y' }}>
          {/* 1. SIGN IN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'grid', gap: '14px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#64748b' }}>
                Enter your admin credentials to manage store taxes and package catalog.
              </p>

              <label className="field-group">
                <span className="field-label">Email or Username</span>
                <input
                  type="text"
                  placeholder="admin@freshfold.test"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoFocus
                />
              </label>

              <label className="field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="field-label">Password</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setForgotStep(1);
                      setForgotEmail(loginEmail);
                    }}
                    style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    style={{ width: '100%', paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title={showLoginPassword ? 'Hide password' : 'Show password'}
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="button primary"
                style={{ marginTop: '6px', width: '100%' }}
              >
                Sign In as Admin
              </button>

              {allowSignup && (
                <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
                  Need a new admin account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Create new admin
                  </button>
                </div>
              )}

              {showDemoHint && (
                <div style={{ background: '#fefce8', border: '1px solid #fef08a', padding: '10px 12px', borderRadius: '8px', fontSize: '11px', color: '#854d0e', textAlign: 'center', marginTop: '6px' }}>
                  🧪 Testing Demo Admin: <code>admin@freshfold.test</code> · Password: <code>admin123</code>
                </div>
              )}
            </form>
          )}

          {/* 2. SIGN UP (CREATE ADMIN) FORM */}
          {mode === 'signup' && allowSignup && (
            <form onSubmit={handleSignup} style={{ display: 'grid', gap: '12px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#64748b' }}>
                Register an additional admin with full access to store settings.
              </p>

              <label className="field-group">
                <span className="field-label">Full Name</span>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  required
                />
              </label>

              <label className="field-group">
                <span className="field-label">Admin Email</span>
                <input
                  type="email"
                  placeholder="e.g. ramesh@freshfold.test"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                />
              </label>

              <label className="field-group">
                <span className="field-label">Password (min 6 characters)</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    style={{ width: '100%', paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title={showSignupPassword ? 'Hide password' : 'Show password'}
                    aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                  >
                    {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <div className="field-group">
                <span className="field-label">Security Question (for Password Recovery)</span>
                <CustomSelect
                  value={signupQuestion}
                  onChange={(val) => setSignupQuestion(val)}
                  options={[
                    'What city is this store in?',
                    'What was your first pet name?',
                    'What is your favorite laundry brand?',
                  ]}
                  width="100%"
                />
              </div>

              <label className="field-group">
                <span className="field-label">Security Answer</span>
                <input
                  type="text"
                  placeholder="Your answer"
                  value={signupAnswer}
                  onChange={(e) => setSignupAnswer(e.target.value)}
                  required
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="button primary"
                style={{ marginTop: '6px', width: '100%' }}
              >
                Create Admin Account
              </button>

              <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: '#64748b' }}>
                Already an admin?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer' }}
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* 3. FORGOT PASSWORD FORM */}
          {mode === 'forgot' && (
            <div>
              {forgotStep === 1 ? (
                <form onSubmit={handleForgotIdentify} style={{ display: 'grid', gap: '14px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#64748b' }}>
                    Enter your registered admin email address to start password recovery.
                  </p>

                  <label className="field-group">
                    <span className="field-label">Registered Admin Email</span>
                    <input
                      type="email"
                      placeholder="e.g. admin@freshfold.test"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </label>

                  <button type="submit" disabled={submitting} className="button primary" style={{ width: '100%' }}>
                    Continue to Security Question
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleForgotReset} style={{ display: 'grid', gap: '14px' }}>
                  <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                    <span style={{ fontSize: '11px', color: '#1d4ed8', display: 'block', fontWeight: 700 }}>
                      SECURITY VERIFICATION FOR {forgotEmail.trim().toLowerCase()}
                    </span>
                    <span style={{ fontSize: '12px', color: '#1e40af', marginTop: '4px', display: 'block' }}>
                      Question: <strong>{forgotQuestion || 'What city is this store in?'}</strong>
                    </span>
                  </div>

                  <label className="field-group">
                    <span className="field-label">Your Security Answer</span>
                    <input
                      type="text"
                      placeholder="Enter the answer you set during sign up"
                      value={forgotAnswer}
                      onChange={(e) => setForgotAnswer(e.target.value)}
                      required
                      autoFocus
                    />
                  </label>

                  <label className="field-group">
                    <span className="field-label">Set New Password</span>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showForgotNewPassword ? 'text' : 'password'}
                        placeholder="At least 6 characters"
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        required
                        style={{ width: '100%', paddingRight: '36px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPassword((v) => !v)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title={showForgotNewPassword ? 'Hide password' : 'Show password'}
                        aria-label={showForgotNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showForgotNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>

                  <button type="submit" disabled={submitting} className="button primary" style={{ width: '100%' }}>
                    Reset Password & Log In
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      Change Email
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
