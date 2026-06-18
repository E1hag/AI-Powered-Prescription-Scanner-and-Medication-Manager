import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";

function DrugInteractions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get("id");

  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(patientIdFromUrl || "");
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  });

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/clinician/my-patients`, { headers: getHeaders() })
      .then((res) => setPatients(res.data.patients || []))
      .catch((err) => console.error("my-patients error:", err.message))
      .finally(() => setPatientsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPatient) {
      setData(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    axios
      .get(`${import.meta.env.VITE_API_URL}/api/clinician/interactions/${selectedPatient}`, {
        headers: getHeaders(),
      })
      .then((res) => {
        if (active) setData(res.data);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/");
        }
        if (active) setError(err.response?.data?.error || "Failed to load drug interactions");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [selectedPatient]);

  const severityColor = (severity) => {
    const s = severity?.toLowerCase();
    if (s === "high") return "#e53935";
    if (s === "moderate") return "#f59e0b";
    return "#43a047";
  };

  const severityBg = (severity) => {
    const s = severity?.toLowerCase();
    if (s === "high") return "#fde8e8";
    if (s === "moderate") return "#fef3cd";
    return "#e8f5e9";
  };

  const filteredInteractions = data
    ? data.interactions.filter((item) =>
        severityFilter === "all" ? true : item.severity?.toLowerCase() === severityFilter
      )
    : [];

  return (
    <Layout>
      <div className="page-header d-flex justify-content-between align-items-center">
        <div>
          <h4>Drug Interaction Alerts</h4>
          <p>Review detected interactions between patient's active medications</p>
        </div>
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={() => navigate(`/patient-summary${selectedPatient ? `?id=${selectedPatient}` : ""}`)}
        >
          ← Patient Summary
        </button>
      </div>

      {/* Patient Selector + Severity Filter */}
      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <div className="medco-card mb-0">
            <label className="form-label">Select Patient</label>
            {patientsLoading ? (
              <p className="text-muted small">Loading...</p>
            ) : (
              <select
                className="form-select"
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
              >
                <option value="">— Choose a patient —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.patient_code} — {p.full_name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="col-md-6">
          <div className="medco-card mb-0">
            <label className="form-label">Filter by Severity</label>
            <select
              className="form-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">All Severities</option>
              <option value="high">High Risk</option>
              <option value="moderate">Moderate</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger small">{error}</div>}
      {loading && <div className="text-center py-5 text-muted small">Checking for drug interactions...</div>}

      {!selectedPatient && !loading && (
        <div className="text-center py-5 text-muted small">
          Select a patient above to check for drug interactions.
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary Cards */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <div className="stat-card text-center">
                <div className="stat-icon pink mx-auto"><i className="bi bi-capsule"></i></div>
                <div className="stat-value">{data.currentMedications.length}</div>
                <div className="stat-label">Active Medications</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stat-card text-center">
                <div className="stat-icon red mx-auto"><i className="bi bi-exclamation-triangle"></i></div>
                <div className="stat-value">{data.summary.high}</div>
                <div className="stat-label">High Severity</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stat-card text-center">
                <div className="stat-icon yellow mx-auto"><i className="bi bi-exclamation-circle"></i></div>
                <div className="stat-value">{data.summary.moderate}</div>
                <div className="stat-label">Moderate Severity</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stat-card text-center">
                <div className="stat-icon green mx-auto"><i className="bi bi-info-circle"></i></div>
                <div className="stat-value">{data.summary.low}</div>
                <div className="stat-label">Low Severity</div>
              </div>
            </div>
          </div>

            <div className="row g-4">
            {/* LEFT — Medications + Interactions */}
            <div className="col-md-8">
                {data.currentMedications.length > 0 && (
                <div className="medco-card mb-4">
                    <h6 className="medco-card-title">Currently Checking Against</h6>
                    <div className="d-flex flex-wrap gap-2">
                    {data.currentMedications.map((med, i) => (
                        <span key={i} className="badge-allergy" style={{ color: "#c9636a" }}>{med}</span>
                    ))}
                    </div>
                </div>
                )}

                <div className="medco-card">
                <h6 className="medco-card-title">Detected Interactions</h6>

                {filteredInteractions.length === 0 ? (
                    <div className="text-center py-4">
                    <i className="bi bi-shield-check text-success" style={{ fontSize: "2rem" }}></i>
                    <p className="text-muted small mt-2 mb-0">
                        {data.interactions.length === 0
                        ? "No drug interactions detected for this patient's current medications."
                        : "No interactions match the selected severity filter."}
                    </p>
                    </div>
                ) : (
                    filteredInteractions.map((item) => (
                    <div
                        key={item.id}
                        style={{
                        background: severityBg(item.severity),
                        borderLeft: `4px solid ${severityColor(item.severity)}`,
                        borderRadius: "10px",
                        padding: "1rem",
                        marginBottom: "0.85rem",
                        }}
                    >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                        <strong>{item.drug_a} + {item.drug_b}</strong>
                        <span
                            style={{
                            backgroundColor: severityColor(item.severity),
                            color: "white",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "0.2rem 0.6rem",
                            borderRadius: "20px",
                            }}
                        >
                            {item.severity}
                        </span>
                        </div>
                        <p className="small mb-2">{item.description}</p>
                        {item.recommendation && (
                        <p className="small text-muted mb-1">
                            <strong>Recommendation:</strong> {item.recommendation}
                        </p>
                        )}
                        {item.source && (
                        <p className="small text-muted mb-0">
                            <i className="bi bi-bookmark me-1"></i>Source: {item.source}
                        </p>
                        )}
                    </div>
                    ))
                )}
                </div>
            </div>

            {/* RIGHT — Info Card Sidebar */}
            <div className="col-md-4">
                <div className="medco-card">
               <div
                    style={{
                        height: "4px",
                        width: "100%",
                        background: "linear-gradient(90deg, #e53935, #f59e0b, #43a047)",
                        borderRadius: "4px",
                        marginBottom: "0.75rem",
                    }}
                    ></div>
                    <h6 className="medco-card-title d-flex align-items-center gap-2">
                    <i className="bi bi-info-circle text-muted"></i> About Drug Interactions
                    </h6>
                    <p className="small text-muted mb-7" style={{ textAlign: "left" }}>
                    Drug interactions are checked automatically against authoritative databases including DrugBank when prescriptions are processed.
                    </p>

                    <div className="d-flex flex-column gap-2 mb-2">
                    <div className="d-flex align-items-center gap-2">
                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#e53935", display: "inline-block" }}></span>
                    <span className="small"><strong>High</strong> — Potentially life-threatening</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#f59e0b", display: "inline-block" }}></span>
                    <span className="small"><strong>Moderate</strong> — May require monitoring</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#43a047", display: "inline-block" }}></span>
                    <span className="small"><strong>Low</strong> — Minor clinical significance</span>
                    </div>
                </div>
                </div>
            </div>
            </div>
        </>
      )}
    </Layout>
  );
}

export default DrugInteractions;