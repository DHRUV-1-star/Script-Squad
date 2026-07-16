import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (!form.confirm) e.confirm = 'Please confirm your password';
    else if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
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
      await axios.post(`/api/auth/reset-password/${token}`, { password: form.password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
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
              {success ? 'Password Reset!' : 'Set New Password'}
            </h2>
            <p className="auth-subtitle">
              {success
                ? 'Your password has been updated successfully'
                : 'Choose a strong password for your account'}
            </p>
          </div>

          {success ? (
            <div className="auth-form">
              <div className="auth-success-banner">
                ✅ Password reset successfully! Redirecting to login…
              </div>
            </div>
          ) : (
            <>
              {serverError && (
                <div className="auth-error-banner">⚠️ {serverError}</div>
              )}

              <form onSubmit={handleSubmit} className="auth-form" noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-password">New Password</label>
                  <input
                    id="reset-password"
                    type="password"
                    name="password"
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    placeholder="At least 6 characters"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    autoFocus
                  />
                  {errors.password && <span className="form-error">{errors.password}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reset-confirm">Confirm Password</label>
                  <input
                    id="reset-confirm"
                    type="password"
                    name="confirm"
                    className={`form-input ${errors.confirm ? 'error' : ''}`}
                    placeholder="Re-enter your new password"
                    value={form.confirm}
                    onChange={handleChange}
                    autoComplete="new-password"
                  />
                  {errors.confirm && <span className="form-error">{errors.confirm}</span>}
                </div>

                <button
                  id="reset-submit"
                  type="submit"
                  className="btn btn-primary w-full btn-lg"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="spinner spinner-sm" />
                      Resetting...
                    </>
                  ) : (
                    <>🔒 Reset Password</>
                  )}
                </button>
              </form>
            </>
          )}

          <div className="auth-footer">
            <p>
              Remember your password?{' '}
              <a href="/login" className="auth-link">Back to Sign In</a>
            </p>
          </div>
        </div>

        <p className="auth-bottom-text">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
