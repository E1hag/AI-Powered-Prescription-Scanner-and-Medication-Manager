import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

function SignUp() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

  if (!formData.full_name || !formData.email || !formData.password) {
    setError("Full name, email and password are required");
    setLoading(false);
    return;
  }
  if (formData.password.length < 6) {
    setError("Password must be at least 6 characters");
    setLoading(false);
    return;
  }
  if (formData.password !== formData.confirmPassword) {
    setError("Passwords do not match");
    setLoading(false);
    return;
  }

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });
      setSuccess("Clinician account created successfully. Redirecting to sign in.");
      setTimeout(() => navigate("/"), 7000);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-wrapper">
      {/* LEFT — Form Side */}
      <div className="auth-split-left">
        <div className="auth-form-container">
          <div className="auth-brand mb-4">
            <h2 className="auth-logo">MEDCO</h2>
            <p className="auth-subtitle">Clinician Portal</p>
          </div>

          <h4 className="fw-bold mb-1">Create your account</h4>
          <p className="text-muted small mb-4">Register as a clinician to get started</p>

          {error && (
            <div className="alert alert-danger py-2 small" role="alert">{error}</div>
          )}
          {success && (
            <div className="alert alert-success py-2 small" role="alert">{success}</div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Full Name</label>
              <input
                type="text"
                name="full_name"
                className="form-control auth-input"
                placeholder="Enter your full name"
                value={formData.full_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold">Email address</label>
              <input
                type="email"
                name="email"
                className="form-control auth-input"
                placeholder="doctor@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold">
                Phone <span className="text-muted fw-normal">(optional)</span>
              </label>
              <input
                type="tel"
                name="phone"
                className="form-control auth-input"
                placeholder="+971 50 000 0000"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold">Password</label>
              <input
                type="password"
                name="password"
                className="form-control auth-input"
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-semibold">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                className="form-control auth-input"
                placeholder="Repeat your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-100 auth-btn" disabled={loading}>
              {loading ? (
                <><span className="spinner-border spinner-border-sm me-2" role="status" />Creating account...</>
              ) : "Create Account"}
            </button>
          </form>

          <p className="text-center small mt-4 mb-0">
            Already have an account?{" "}
            <Link to="/" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>

      {/* RIGHT — Image Side */}
      <div className="auth-split-right">
        <div className="auth-image-overlay">
          <div className="auth-image-text">
            <h3>Join MEDCO Today</h3>
            <p>Help your patients stay on track with their medication and make informed clinical decisions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUp;