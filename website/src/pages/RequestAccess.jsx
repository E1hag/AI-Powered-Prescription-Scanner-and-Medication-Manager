import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";

function RequestAccess() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ patient_code: "", reason: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/clinician/request-history`,
        { headers }
      );
      setHistory(res.data.history);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/");
      }
      console.error("History fetch error:", err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!formData.patient_code) {
      setError("Patient ID is required");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/clinician/request-access`,
        formData,
        { headers }
      );
      setSuccess(res.data.message);
      setFormData({ patient_code: "", reason: "" });
      fetchHistory();
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/");
      }
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      pending:  <span className="badge-status warning">Pending</span>,
      approved: <span className="badge-status active">Approved</span>,
      denied:   <span className="badge-status critical">Denied</span>,
      revoked:  <span className="badge-status critical">Revoked</span>,
    };
    return map[status] || <span className="badge-status warning">{status}</span>;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      year: "numeric", month: "short", day: "numeric"
    });
  };

  return (
    <Layout>
      <div className="page-header">
        <h4>Request Patient Access</h4>
        <p>Enter a patient ID to request access to their medication records</p>
      </div>

      <div className="row g-4">
        {/* ── LEFT — New Request Form ── */}
        <div className="col-md-5">
          <div className="medco-card h-100">
            <div className="medco-card-title d-flex align-items-center gap-2">
              <i className="bi bi-lock text-muted"></i> New Access Request
            </div>

            {error && (
              <div className="alert alert-danger py-2 small" role="alert">{error}</div>
            )}
            {success && (
              <div className="alert alert-success py-2 small" role="alert">{success}</div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label className="form-label">Patient ID</label>
                <input
                  type="text"
                  name="patient_code"
                  className="form-control"
                  placeholder="Enter Patient ID (e.g., P001)"
                  value={formData.patient_code}
                  onChange={handleChange}
                />
                <div className="form-text text-muted small">
                  Enter the unique patient identifier
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label">Reason for Access</label>
                <textarea
                  name="reason"
                  className="form-control"
                  rows={4}
                  placeholder="Describe why you need access to this patient's records"
                  value={formData.reason}
                  onChange={handleChange}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={loading}
              >
                {loading ? (
                  <><span className="spinner-border spinner-border-sm me-2" />Sending...</>
                ) : "Send Access Request"}
              </button>
            </form>

            {/* How it works */}
            <div className="how-it-works mt-4">
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="bi bi-info-circle text-muted"></i>
                <span className="fw-semibold small">How it works</span>
              </div>
              <ol className="small text-muted ps-3 mb-0">
                <li>Enter the patient ID and reason for access</li>
                <li>The patient will receive a notification</li>
                <li>Once approved, you can view their records</li>
                <li>Access is temporary and audited</li>
              </ol>
            </div>
          </div>
        </div>

        {/* ── RIGHT — Request History ── */}
        <div className="col-md-7">
          <div className="medco-card h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="medco-card-title d-flex align-items-center gap-2 mb-0">
                <i className="bi bi-clock-history text-muted"></i> Access Request History
              </div>
              {history.length > 0 && (
                <span className="badge-count">{history.length} requests</span>
              )}
            </div>

            {historyLoading ? (
              <div className="text-center py-4 text-muted small">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-4 text-muted small">
                No requests yet. Send your first access request.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-borderless medco-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Date</th>
                      <th>Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.patient_code}</strong>
                          <div className="small text-muted">{item.patient_name}</div>
                        </td>
                        <td className="small text-muted">
                          {formatDate(item.requested_at)}
                        </td>
                        <td className="small text-muted">
                          {item.reason || "—"}
                        </td>
                        <td>{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default RequestAccess;