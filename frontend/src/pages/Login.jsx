import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './Auth.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // ── Login state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  // ── Forgot password state ──────────────────────────────────────────────────
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailError, setForgotEmailError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');

  // ── Login handlers ─────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.email) e.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    setErrors({});
    setServerError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setServerError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
  };

  // ── Forgot password handler ────────────────────────────────────────────────
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail || !/^\S+@\S+\.\S+$/.test(forgotEmail)) {
      setForgotEmailError('Enter a valid email address');
      return;
    }
    setForgotEmailError('');
    setForgotLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email: forgotEmail });
      setForgotSuccess(res.data.message || 'Reset link sent! Check your inbox.');
    } catch (err) {
      setForgotEmailError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const switchToForgot = () => {
    setForgotMode(true);
    setForgotEmail(form.email); // pre-fill with login email if entered
    setForgotEmailError('');
    setForgotSuccess('');
    setServerError('');
  };

  const switchToLogin = () => {
    setForgotMode(false);
    setForgotSuccess('');
    setForgotEmailError('');
  };

  return (
    <div className="auth-page">
      {/* Animated background */}
      <div className="auth-bg">
        <div className="auth-orb orb-1" />
        <div className="auth-orb orb-2" />
        <div className="auth-orb orb-3" />
      </div>

      <div className="auth-container">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">⚡</div>
          <div>
            <h1 className="auth-logo-name">Script Squad</h1>
            <p className="auth-logo-tagline">Work Smarter Together</p>
          </div>
        </div>

        {/* Card */}
        <div className="auth-card card-glass">
          <div className="auth-card-header">
            <h2 className="auth-title">
              {forgotMode ? 'Forgot Password' : 'Welcome back'}
            </h2>
            <p className="auth-subtitle">
              {forgotMode
                ? "Enter your email and we'll send you a reset link"
                : 'Sign in to continue to your workspace'}
            </p>
          </div>

          {/* ── LOGIN FORM ── */}
          {!forgotMode && (
            <>
              {serverError && (
                <div className="auth-error-banner">⚠️ {serverError}</div>
              )}

              <form onSubmit={handleSubmit} className="auth-form" noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="login-email">Email address</label>
                  <input
                    id="login-email"
                    type="email"
                    name="email"
                    className={`form-input ${errors.email ? 'error' : ''}`}
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                    autoComplete="email"
                    autoFocus
                  />
                  {errors.email && <span className="form-error">{errors.email}</span>}
                </div>

                <div className="form-group">
                  <div className="auth-label-row">
                    <label className="form-label" htmlFor="login-password">Password</label>
                    <button
                      type="button"
                      className="auth-forgot-link"
                      onClick={switchToForgot}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    name="password"
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                  />
                  {errors.password && <span className="form-error">{errors.password}</span>}
                </div>

                <button
                  id="login-submit"
                  type="submit"
                  className="btn btn-primary w-full btn-lg"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="spinner spinner-sm" />
                      Signing in...
                    </>
                  ) : (
                    <>🔑 Sign In</>
                  )}
                </button>
              </form>

              <div className="auth-footer">
                <p>
                  Don't have an account?{' '}
                  <Link to="/register" className="auth-link">Create account →</Link>
                </p>
              </div>
            </>
          )}

          {/* ── FORGOT PASSWORD FORM ── */}
          {forgotMode && (
            <>
              {forgotSuccess ? (
                <div className="auth-form">
                  <div className="auth-success-banner">
                    ✅ {forgotSuccess}
                  </div>
                  <p className="auth-hint-text">
                    Didn't receive it? Check your spam folder or try again.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="auth-form" noValidate>
                  <div className="form-group">
                    <label className="form-label" htmlFor="forgot-email">Email address</label>
                    <input
                      id="forgot-email"
                      type="email"
                      className={`form-input ${forgotEmailError ? 'error' : ''}`}
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        if (forgotEmailError) setForgotEmailError('');
                      }}
                      autoFocus
                    />
                    {forgotEmailError && <span className="form-error">{forgotEmailError}</span>}
                  </div>

                  <button
                    id="forgot-submit"
                    type="submit"
                    className="btn btn-primary w-full btn-lg"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <>
                        <div className="spinner spinner-sm" />
                        Sending...
                      </>
                    ) : (
                      <>📧 Send Reset Link</>
                    )}
                  </button>
                </form>
              )}

              <div className="auth-footer">
                <p>
                  Remember your password?{' '}
                  <button type="button" className="auth-link auth-link-btn" onClick={switchToLogin}>
                    Back to Sign In
                  </button>
                </p>
              </div>
            </>
          )}
        </div>

        <p className="auth-bottom-text">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
