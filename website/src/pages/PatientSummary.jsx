import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";

function PatientSummary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get("id");

  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(patientIdFromUrl || "");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [error, setError] = useState("");

  // Always get fresh token + no-cache headers
  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  });

  // Fetch approved patients on mount
  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/clinician/my-patients`, {
        headers: getHeaders(),
      })
      .then((res) => setPatients(res.data.patients || []))
      .catch((err) => console.error("my-patients error:", err.message))
      .finally(() => setPatientsLoading(false));
  }, []);

  // Fetch summary when selectedPatient changes
  useEffect(() => {
    if (!selectedPatient) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError("");
    setSummary(null);

    axios
      .get(
        `${import.meta.env.VITE_API_URL}/api/clinician/patient-summary/${selectedPatient}`,
        { headers: getHeaders() }
      )
      .then((res) => setSummary(res.data))
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/");
        }
        setError(err.response?.data?.error || "Failed to load patient summary");
      })
      .finally(() => setLoading(false));
  }, [selectedPatient]);

  const adherenceColor = (pct) => {
    if (pct >= 80) return "#4caf82";
    if (pct >= 60) return "#f0c86a";
    return "#e57373";
  };

  const statusBadge = (pct) => {
    if (pct >= 80) return <span className="badge-status active">Active</span>;
    if (pct >= 60) return <span className="badge-status warning">Attention</span>;
    return <span className="badge-status critical">Critical</span>;
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  return (
    <Layout>
      {/* Header */}
      <div className="page-header d-flex justify-content-between align-items-center">
        <div>
          <h4>Patient Treatment Summary</h4>
          <p>View active medications and adherence overview</p>
        </div>
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={() => navigate(`/adherence-trends${selectedPatient ? `?id=${selectedPatient}` : ""}`)}
        >
          View Trends
        </button>
      </div>

      {/* Patient Selector */}
      <div className="medco-card mb-4">
        <label className="form-label">Select Patient</label>
        {patientsLoading ? (
          <p className="text-muted small">Loading patients...</p>
        ) : (
          <select
            className="form-select border-2 rounded-pill px-3 rounded-circle"
            value={selectedPatient}
            onChange={(e) => setSelectedPatient(e.target.value)}
          >
            <option value="">— Choose a patient —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.patient_code} — {p.full_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Error */}
      {error && <div className="alert alert-danger small">{error}</div>}

      {/* Loading */}
      {loading && (
        <div className="text-center py-5 text-muted small">
          Loading patient summary...
        </div>
      )}

      {/* Empty state */}
      {!selectedPatient && !loading && (
        <div className="text-center py-5 text-muted small">
          Select a patient above to view their treatment summary.
        </div>
      )}

      {/* Summary */}
      {!loading && summary && (
        <div className="row g-4">
          {/* LEFT — Patient Info */}
          <div className="col-md-4">
            <div className="medco-card h-100">
              <h6 className="medco-card-title">Patient Information</h6>

              <div className="text-center mb-3">
                <div className="patient-avatar">
                  {summary.patient.full_name?.charAt(0).toUpperCase()}
                </div>
                <h6 className="fw-bold mt-2 mb-0">{summary.patient.full_name}</h6>
                <p className="text-muted small mb-0">ID: {summary.patient.patient_code}</p>
              </div>

              <hr className="my-2" style={{ borderColor: "#f0e6e6" }} />

              {[
                ["Gender", summary.patient.gender],
                ["Date of Birth", formatDate(summary.patient.date_of_birth)],
                ["Phone", summary.patient.phone],
                ["Email", summary.patient.email],
              ].map(([label, value]) => (
                <div className="patient-info-row" key={label}>
                  <span className="patient-info-label">{label}</span>
                  <span className="patient-info-value">{value || "—"}</span>
                </div>
              ))}

              {summary.patient.allergies?.length > 0 && (
                  <div className="mt-3">
                    <span className="patient-info-label d-block mb-2">Allergies</span>
                    <div className="d-flex flex-wrap gap-1">
                    {summary.patient.allergies.map((a, i) => (
                      <span key={i} className="badge-allergy">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {summary.patient.conditions?.length > 0 && (
               <div className="mt-3">
                <span className="patient-info-label d-block mb-2">Conditions</span>
                <div className="d-flex flex-wrap gap-1">
                    {summary.patient.conditions.map((c, i) => (
                      <span key={i} className="badge-condition">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Medications + Adherence */}
          <div className="col-md-8">
            {/* Overall Adherence */}
            <div className="medco-card mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="medco-card-title mb-0">Overall Medication Adherence</h6>
                <span className="fw-bold fs-5" style={{ color: adherenceColor(summary.overallAdherence) }}>
                  {summary.overallAdherence}%
                </span>
              </div>
              <div className="overall-adherence-bar">
                <div
                  className="overall-adherence-fill"
                  style={{
                    width: `${summary.overallAdherence}%`,
                    backgroundColor: adherenceColor(summary.overallAdherence),
                  }}
                />
              </div>
              <p className="text-muted small mt-2 mb-0">
                Based on medication intake records from the past 30 days
              </p>
            </div>

            {/* Active Medications */}
            <div className="medco-card">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="medco-card-title mb-0">Active Medications</h6>
                {summary.medications.length > 0 && (
                  <span className="badge-count">{summary.medications.length} medications</span>
                )}
              </div>

              {summary.medications.length === 0 ? (
                <div className="text-center py-3 text-muted small">
                  No active medications found for this patient.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-borderless medco-table">
                    <thead>
                      <tr>
                        <th>Medication</th>
                        <th>Dosage</th>
                        <th>Schedule</th>
                        <th style={{ textAlign: "center" }}>Adherence</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.medications.map((med) => (
                        <tr key={med.id}>
                          <td>
                            <strong>{med.drug_name}</strong>
                            {med.instructions && (
                              <div className="small text-muted">
                                <i className="bi bi-exclamation-triangle me-1 text-warning" />
                                {med.instructions}
                              </div>
                            )}
                          </td>
                          <td className="small">{med.dosage}</td>
                          <td className="small text-muted">
                            {med.frequency}
                            {med.schedule_times && <div>{med.schedule_times}</div>}
                          </td>
                      <td>
                        <div className="d-flex align-items-center gap-2 justify-content-center" style={{ margin: "0 auto",marginRight:"-1.5em" }}>
                          <div className="overall-adherence-bar" style={{ width: "100px", minWidth: "100px" }}>
                            <div
                              className="overall-adherence-fill"
                              style={{
                                width: `${med.adherence_pct}%`,
                                backgroundColor: adherenceColor(med.adherence_pct),
                              }}
                            />
                          </div>
                          <span className="adherence-pct">{med.adherence_pct}%</span>
                        </div>
                      </td>
                          <td>{statusBadge(med.adherence_pct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Drug Interactions */}
            {summary.interactions?.length > 0 && (
              <div className="medco-card mt-4">
                <h6 className="medco-card-title text-danger">
                  <i className="bi bi-exclamation-triangle me-2" />
                  Drug Interaction Warnings
                </h6>
                {summary.interactions.map((item, i) => (
                  <div key={i} className={`interaction-alert ${item.severity}`}>
                    <strong>{item.drug_a} + {item.drug_b}</strong>
                    <span className={`badge-severity ms-2 ${item.severity}`}>
                      {item.severity}
                    </span>
                    <p className="small mb-1 mt-1">{item.description}</p>
                    {item.recommendation && (
                      <p className="small text-muted mb-0">💡 {item.recommendation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Nav Buttons */}
            <div className="row g-3 mt-2">
              {[
                { icon: "bi-bar-chart-line", label: "Trends", path: "/adherence-trends" },
                { icon: "bi-exclamation-triangle", label: "Interactions", path: "/drug-interactions" },
                { icon: "bi-file-text", label: "Notes", path: "/treatment-notes" },
              ].map(({ icon, label, path }) => (
                <div className="col-4" key={label}>
                  <button
                    className="btn-nav-page w-100"
                    onClick={() => navigate(`${path}${selectedPatient ? `?id=${selectedPatient}` : ""}`)}
                  >
                    <i className={`bi ${icon} d-block mb-1`} />
                    {label}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default PatientSummary;