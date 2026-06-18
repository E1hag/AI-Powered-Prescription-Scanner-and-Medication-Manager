import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalPatients: 0,
    pendingRequests: 0,
    activeAlerts: 0,
    avgAdherence: 0,
  });
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/clinician/dashboard`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setStats(res.data.stats);
        setPatients(res.data.recentPatients);
      } catch (err) {
        console.error("Dashboard fetch error:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const getAdherenceColor = (pct) => {
    if (pct >= 80) return "#4caf82";
    if (pct >= 60) return "#f0c86a";
    return "#e57373";
  };

  const getStatusBadge = (pct) => {
    if (pct >= 80) return <span className="badge-status active">Active</span>;
    if (pct >= 60) return <span className="badge-status warning">Warning</span>;
    return <span className="badge-status critical">Critical</span>;
  };

  return (
    <Layout>
      <div className="page-header">
        <h4>Dashboard Overview</h4>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="stat-card">
            <div className="stat-icon pink">
              <i className="bi bi-people"></i>
            </div>
            <div className="stat-value">{loading ? "—" : stats.totalPatients}</div>
            <div className="stat-label">Total Patients</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-card">
            <div className="stat-icon yellow">
              <i className="bi bi-clock"></i>
            </div>
            <div className="stat-value">{loading ? "—" : stats.pendingRequests}</div>
            <div className="stat-label">Pending Requests</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-card">
            <div className="stat-icon red">
              <i className="bi bi-exclamation-triangle"></i>
            </div>
            <div className="stat-value">{loading ? "—" : stats.activeAlerts}</div>
            <div className="stat-label">Active Alerts</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-card">
            <div className="stat-icon green">
              <i className="bi bi-bar-chart-line"></i>
            </div>
            <div className="stat-value">{loading ? "—" : `${stats.avgAdherence}%`}</div>
            <div className="stat-label">Avg Adherence</div>
          </div>
        </div>
      </div>

      {/* ── RECENT PATIENTS TABLE ── */}
      <div className="medco-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="medco-card-title mb-0">Recent Patients</h6>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={() => navigate("/request-access")}
          >
            + Request Access
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4 text-muted small">Loading patients...</div>
        ) : patients.length === 0 ? (
          <div className="text-center py-4 text-muted small">
            No patients yet. Request access to a patient to get started.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-borderless medco-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Last Visit</th>
                  <th style={{ textAlign: "center" }}>Adherence</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.patient_code}</strong></td>
                    <td>{p.full_name}</td>
                    <td>
                    {p.last_visit 
                      ? new Date(p.last_visit).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })
                      : "—"}
                    </td>
                <td>
                  <div className="d-flex align-items-center gap-2 justify-content-center" style={{ margin: "0 auto",marginRight:"-1.5em" }}>
                    <div className="overall-adherence-bar" style={{ width: "100px", minWidth: "100px" }}>
                      <div
                        className="overall-adherence-fill"
                        style={{
                          width: `${p.adherence_pct || 0}%`,
                          backgroundColor: getAdherenceColor(p.adherence_pct || 0),
                        }}
                      />
                    </div>
                    <span className="adherence-pct">{p.adherence_pct || 0}%</span>
                  </div>
                </td>
                    <td>{getStatusBadge(p.adherence_pct || 0)}</td>
                    <td>
                      <button
                        className="btn btn-view btn-sm"
                        onClick={() => navigate(`/patient-summary?id=${p.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Dashboard;