import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

function SignIn() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/login`,
        formData
      );
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/dashboard");
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

          <h4 className="fw-bold mb-1">Welcome back</h4>
          <p className="text-muted small mb-4">Sign in to your clinician account</p>

          {error && (
            <div className="alert alert-danger py-2 small" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
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

            <div className="mb-4">
              <label className="form-label small fw-semibold">Password</label>
              <input
                type="password"
                name="password"
                className="form-control auth-input"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-100 auth-btn" disabled={loading}>
              {loading ? (
                <><span className="spinner-border spinner-border-sm me-2" role="status" />Signing in...</>
              ) : "Sign In"}
            </button>
          </form>

          <p className="text-center small mt-4 mb-0">
            Don't have an account?{" "}
            <Link to="/signup" className="auth-link">Create one</Link>
          </p>
        </div>
      </div>

      {/* RIGHT — Image Side */}
      <div className="auth-split-right">
        <div className="auth-image-overlay">
          <div className="auth-image-text">
            <h3>Smart Medication Management</h3>
            <p>Monitor your patients, track adherence, and ensure safer treatment outcomes — all in one place.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignIn;