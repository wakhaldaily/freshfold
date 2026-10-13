import React, { useState } from 'react';
import {
  AlertCircle,
  Delete,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Shield,
  Sparkles,
} from 'lucide-react';


export default function AppLoginScreen({
  storeName = 'Clean Clear Dry Cleaning',
  tagline = 'Counter & Store Management System',
  showDemoHints = false,
  allowSignup = false,
  setupRequired = false,
  onPinLogin,
  onAdminLogin,
  onSetup,
  onToast,
}) {
  // First visit to an unconfigured store goes straight to setup; otherwise admin sign in.
  const [authMode, setAuthMode] = useState(setupRequired && allowSignup ? 'signup' : 'admin'); // 'admin' | 'pin' | 'signup'
  const [submitting, setSubmitting] = useState(false);

  // Staff PIN State
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Password visibility toggles
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Admin Login State
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  // First-time Admin & Store Setup State
  const [signupStoreName, setSignupStoreName] = useState(storeName || 'Clean Clear Dry Cleaning');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupQuestion, setSignupQuestion] = useState('What city is this store in?');
  const [signupAnswer, setSignupAnswer] = useState('');
  const [signupError, setSignupError] = useState('');

  // --- PIN PAD HANDLERS ---
  const handlePinDigit = (digit) => {
    if (submitting) return;
    setPinError('');
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      // Auto-submit on 4 digits
      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
    }
  };

  const handlePinDelete = () => {
    setPinError('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPinError('');
    setPin('');
  };

  const submitPin = async (pinToSubmit = pin) => {
    if (setupRequired) {
      setPinError('No staff registered yet. Please complete Store Setup first.');
      setPin('');
      return;
    }
    setSubmitting(true);
    try {
      const user = await onPinLogin(pinToSubmit);
      onToast?.(`Welcome back, ${user?.name || 'team member'}!`);
    } catch (err) {
      setPinError(err.message || 'Incorrect PIN. Please try again.');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  // --- ADMIN LOGIN HANDLER ---
  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    if (setupRequired) {
      setAdminError('No administrator accounts registered yet. Please click Store Setup to configure this store.');
      return;
    }
    setAdminError('');
    setSubmitting(true);
    try {
      const user = await onAdminLogin(adminEmail.trim(), adminPassword);
      onToast?.(`Admin session authorized: Welcome, ${user?.name || 'Administrator'}!`);
    } catch (err) {
      setAdminError(err.message || 'Invalid admin credentials. Please check your email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- SIGNUP HANDLER (FIRST ADMIN SETUP & STORE CREATION) ---
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setSignupError('');

    if (!signupStoreName.trim()) {
      setSignupError('Please enter your store or business name.');
      return;
    }
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword) {
      setSignupError('Please fill all required administrator fields.');
      return;
    }
    if (signupPassword.length < 6) {
      setSignupError('Password must be at least 6 characters.');
      return;
    }
    if (!signupAnswer.trim()) {
      setSignupError('Please answer the security question.');
      return;
    }

    const cleanStoreName = signupStoreName.trim();
    const newAdmin = {
      name: signupName.trim(),
      email: signupEmail.trim().toLowerCase(),
      password: signupPassword,
      securityQuestion: signupQuestion,
      securityAnswer: signupAnswer.trim().toLowerCase(),
    };

    setSubmitting(true);
    try {
      await onSetup(newAdmin, cleanStoreName);
      onToast?.(`Store "${cleanStoreName}" initialized! Welcome, ${newAdmin.name}!`);
    } catch (err) {
      setSignupError(err.message || 'Could not create administrator account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Card Header & Brand Branding */}
        <div
          style={{
            background: '#0f172a',
            padding: '44px 24px 20px',
            textAlign: 'center',
            color: '#fff',
            position: 'relative',
          }}
        >
          {/* Environment Status Badge */}
          <div style={{ position: 'absolute', top: '14px', right: '14px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                padding: '3px 8px',
                borderRadius: '999px',
                background: showDemoHints ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                color: showDemoHints ? '#fef08a' : '#86efac',
                border: showDemoHints ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
              }}
            >
              {showDemoHints ? '🧪 Testing Mode' : '🔒 Production Terminal'}
            </span>
          </div>

          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #2563eb, #0284c7)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 12px',
              boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
            }}
          >
            <Sparkles size={24} color="#fff" />
          </div>

          <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px' }}>
            {storeName}
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
            {tagline}
          </p>

          {/* Mode Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: setupRequired ? '1.2fr 1fr 1fr' : '1fr 1fr',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '3px',
              marginTop: '18px',
            }}
          >
            {setupRequired && (
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: authMode === 'signup' ? '#ffffff' : 'transparent',
                  color: authMode === 'signup' ? '#0f172a' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: authMode === 'signup' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Sparkles size={14} color={authMode === 'signup' ? '#2563eb' : '#94a3b8'} /> Store Setup
              </button>
            )}
            <button
              type="button"
              onClick={() => { setAuthMode('pin'); setPinError(''); }}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: authMode === 'pin' ? '#ffffff' : 'transparent',
                color: authMode === 'pin' ? '#0f172a' : '#94a3b8',
                fontSize: '12px',
                fontWeight: authMode === 'pin' ? 700 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <KeyRound size={14} /> Staff PIN
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('admin'); setAdminError(''); }}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: authMode === 'admin' ? '#ffffff' : 'transparent',
                color: authMode === 'admin' ? '#0f172a' : '#94a3b8',
                fontSize: '12px',
                fontWeight: authMode === 'admin' ? 700 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <Shield size={14} /> Admin Login
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div style={{ padding: '24px 24px 28px' }}>

          {/* ========================================================= */}
          {/* MODE 1: STAFF PIN ACCESS                                  */}
          {/* ========================================================= */}
          {authMode === 'pin' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                  Enter your 4-digit Staff PIN
                </span>

                {/* PIN Display Bubbles */}
                <span className="sr-only" aria-live="polite">{`${pin.length} of 4 digits entered`}</span>
                <div
                  aria-hidden="true"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '12px',
                    margin: '14px 0 8px',
                  }}
                >
                  {[0, 1, 2, 3].map((idx) => {
                    const filled = pin.length > idx;
                    return (
                      <div
                        key={idx}
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          border: filled ? '2px solid #2563eb' : '2px solid #cbd5e1',
                          background: filled ? '#2563eb' : 'transparent',
                          transition: 'all 0.15s ease',
                          transform: filled ? 'scale(1.15)' : 'scale(1)',
                        }}
                      />
                    );
                  })}
                </div>

                {pinError && (
                  <div role="alert" style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <AlertCircle size={13} /> {pinError}
                  </div>
                )}
              </div>

              {/* Numeric Keypad Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  maxWidth: '280px',
                  margin: '0 auto',
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePinDigit(String(num))}
                    style={{
                      height: '56px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      color: '#0f172a',
                      fontSize: '20px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                    onMouseUp={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  >
                    {num}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handlePinClear}
                  style={{
                    height: '56px',
                    borderRadius: '12px',
                    border: '1px solid #fee2e2',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Clear PIN"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={() => handlePinDigit('0')}
                  style={{
                    height: '56px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '20px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                  }}
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={handlePinDelete}
                  style={{
                    height: '56px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#64748b',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Backspace"
                >
                  <Delete size={20} />
                </button>
              </div>

              {/* Demo Accounts Quick-Fill (TESTING ENVIRONMENT ONLY) */}
              {showDemoHints && (
              <div
                style={{
                  marginTop: '20px',
                  padding: '12px 14px',
                  background: 'rgba(37, 99, 235, 0.06)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  borderRadius: '10px',
                  fontSize: '11px',
                  color: '#1e40af',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>🔢 Demo PINs (testing only):</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { id: '1', name: 'Manager', pin: '1234' },
                    { id: '2', name: 'Cashier 1', pin: '0000' },
                    { id: '3', name: 'Cashier 2', pin: '2222' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setPin(s.pin); submitPin(s.pin); }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #bfdbfe',
                        background: '#fff',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#1e3a8a',
                        cursor: 'pointer',
                      }}
                    >
                      {s.name}: {s.pin}
                    </button>
                  ))}
                </div>
              </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* MODE 2: ADMINISTRATOR EMAIL & PASSWORD                    */}
          {/* ========================================================= */}
          {authMode === 'admin' && (
            <form onSubmit={handleAdminSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label htmlFor="login-admin-email" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Admin Email
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '10px 12px' }}>
                  <Mail size={16} color="#64748b" />
                  <input
                    id="login-admin-email"
                    autoComplete="username"
                    type="email"
                    placeholder="admin@yourstore.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="login-admin-password" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Admin Password
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '10px 12px', background: '#fff' }}>
                  <Lock size={16} color="#64748b" />
                  <input
                    id="login-admin-password"
                    autoComplete="current-password"
                    type={showAdminPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword((prev) => !prev)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      color: '#64748b',
                    }}
                    title={showAdminPassword ? 'Hide password' : 'Show password'}
                    aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {adminError && (
                <div role="alert" style={{ padding: '10px 12px', borderRadius: '8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: '12px', marginBottom: '14px', lineHeight: 1.4 }}>
                  <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  {adminError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#0f172a',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)',
                }}
              >
                Sign In as Administrator
              </button>

              {allowSignup && (
                <div style={{ marginTop: '14px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setAuthMode('signup')}
                    style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {setupRequired ? 'Set up this store (first administrator)' : '+ Register a new store administrator'}
                  </button>
                </div>
              )}

              {showDemoHints && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px 14px',
                    background: 'rgba(37, 99, 235, 0.06)',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                    borderRadius: '10px',
                    fontSize: '11px',
                    color: '#1e40af',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>🔑 Demo administrator (testing only):</div>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminEmail('admin@freshfold.test');
                      setAdminPassword('admin123');
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid #bfdbfe',
                      background: '#fff',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#1e3a8a',
                      cursor: 'pointer',
                    }}
                  >
                    Fill demo admin (admin@freshfold.test)
                  </button>
                </div>
              )}
            </form>
          )}

          {/* ========================================================= */}
          {/* MODE 3: FIRST-TIME / NEW ADMIN SIGNUP & STORE SETUP      */}
          {/* ========================================================= */}
          {authMode === 'signup' && allowSignup && (
            <form onSubmit={handleSignupSubmit}>
              <div style={{ marginBottom: '14px', background: '#eff6ff', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #bfdbfe' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1e3a8a', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  🏪 Store / Branch Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Clean Clear Dry Cleaning - Indiranagar"
                  value={signupStoreName}
                  onChange={(e) => setSignupStoreName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #2563eb', borderRadius: '8px', fontSize: '13px', fontWeight: 700, background: '#ffffff', color: '#0f172a' }}
                />
                <span style={{ display: 'block', fontSize: '11px', color: '#3b82f6', marginTop: '4px', fontWeight: 500 }}>
                  Printed on all invoices, WhatsApp receipts, and financial reports.
                </span>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Store Administrator Full Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Work Email
                </label>
                <input
                  type="email"
                  placeholder="owner@yourstore.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Password (min 6 characters)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '8px 12px', background: '#fff' }}>
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword((v) => !v)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      color: '#64748b',
                    }}
                    title={showSignupPassword ? 'Hide password' : 'Show password'}
                    aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                  >
                    {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Security Recovery Question
                </label>
                <select
                  value={signupQuestion}
                  onChange={(e) => setSignupQuestion(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '12px' }}
                >
                  <option value="What city is this store in?">What city is this store in?</option>
                  <option value="What is your primary phone last 4 digits?">What is your primary phone last 4 digits?</option>
                  <option value="What was your first pet name?">What was your first pet name?</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Security Answer
                </label>
                <input
                  type="text"
                  placeholder="Your answer for account recovery"
                  value={signupAnswer}
                  onChange={(e) => setSignupAnswer(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>

              {signupError && (
                <div role="alert" style={{ padding: '8px 12px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c', fontSize: '12px', marginBottom: '12px' }}>
                  {signupError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#0f172a',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Create Store & Administrator Account
              </button>

              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setAuthMode('admin')}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer' }}
                >
                  ← Back to Admin Sign-In
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
