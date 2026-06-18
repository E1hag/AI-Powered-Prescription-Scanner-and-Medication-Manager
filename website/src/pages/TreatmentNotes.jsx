import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";

const NOTE_TYPES = [
  "General Observation",
  "Dosage Change",
  "Timing Adjustment",
  "Medication Addition",
  "Medication Removal",
  "Follow-up Note",
  "Side Effect Report",
  "Other",
];

function TreatmentNotes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get("id");

  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(patientIdFromUrl || "");
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [formData, setFormData] = useState({ note_type: "General Observation", note_text: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  });

  // Fetch patients on mount
  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/clinician/my-patients`, { headers: getHeaders() })
      .then((res) => setPatients(res.data.patients || []))
      .catch((err) => console.error("my-patients error:", err.message))
      .finally(() => setPatientsLoading(false));
  }, []);

  // Fetch notes when patient selected
  useEffect(() => {
    if (!selectedPatient) { setNotes([]); return; }
    fetchNotes();
  }, [selectedPatient]);

  const fetchNotes = async () => {
    setNotesLoading(true);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/clinician/notes/${selectedPatient}`,
        { headers: getHeaders() }
      );
      setNotes(res.data.notes || []);
    } catch (err) {
      console.error("Notes fetch error:", err.message);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.note_text.trim()) {
      setError("Note content is required");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/clinician/notes`,
        { patient_id: selectedPatient, ...formData },
        { headers: getHeaders() }
      );
      setSuccess("Treatment note saved successfully.");
      setTimeout(() => setSuccess(""), 2000);
      setFormData({ note_type: "General Observation", note_text: "" });
      fetchNotes();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save note");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const getNoteTypeColor = (type) => {
    const colors = {
      "Dosage Change": "#c9636a",
      "Timing Adjustment": "#f59e0b",
      "Medication Addition": "#4caf82",
      "Medication Removal": "#e53935",
      "Follow-up Note": "#1976d2",
      "Side Effect Report": "#9c27b0",
      "General Observation": "#194745",
      "Other": "#888",
    };
    return colors[type] || "#666";
  };

  return (
    <Layout>
      <div className="page-header d-flex justify-content-between align-items-center">
        <div>
          <h4>Treatment Adjustment Notes</h4>
          <p>Add and view clinical notes for patient treatment</p>
        </div>
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={() => navigate(`/patient-summary${selectedPatient ? `?id=${selectedPatient}` : ""}`)}
        >
          ← Patient Summary
        </button>
      </div>

      {/* Patient Selector */}
      <div className="medco-card mb-4">
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
              <option key={p.id} value={p.id}>
                {p.patient_code} — {p.full_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!selectedPatient && (
        <div className="text-center py-5 text-muted small">
          Select a patient above to view and add treatment notes.
        </div>
      )}

      {selectedPatient && (
        <div className="row g-4">
          {/* LEFT — Add Note Form */}
          <div className="col-md-5">
            <div className="medco-card h-100">
              <h6 className="medco-card-title d-flex align-items-center gap-2">
                <i className="bi bi-pencil-square text-muted"></i> Add New Note
              </h6>

              {error && <div className="alert alert-danger py-2 small">{error}</div>}
              {success && <div className="alert alert-success py-2 small">{success}</div>}

              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-3">
                  <label className="form-label">Note Type</label>
                  <select
                    className="form-select"
                    value={formData.note_type}
                    onChange={(e) => setFormData({ ...formData, note_type: e.target.value })}
                  >
                    {NOTE_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="form-label">Note Content</label>
                  <textarea
                    className="form-control"
                    rows={6}
                    placeholder="Include relevant details like dosage changes, timing adjustments, or observations."
                    value={formData.note_text}
                    onChange={(e) => setFormData({ ...formData, note_text: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={submitting}
                >
                  {submitting ? (
                    <><span className="spinner-border spinner-border-sm me-2" />Saving...</>
                  ) : "Save Note"}
                </button>
              </form>

              {/* Audit Trail Info */}
              <div className="how-it-works mt-4">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-shield-check text-muted"></i>
                  <span className="fw-semibold small">Audit Trail</span>
                </div>
                <p className="small text-muted mb-0">
                  All notes are saved with your clinician ID, patient ID, and timestamp for traceability. Notes cannot be edited or deleted to maintain a complete audit trail.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT — Notes History */}
          <div className="col-md-7">
            <div className="medco-card h-100">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="medco-card-title d-flex align-items-center gap-2 mb-0">
                  <i className="bi bi-clock-history text-muted"></i> Notes History
                </h6>
                {notes.length > 0 && (
                  <span className="badge-count">{notes.length} notes</span>
                )}
              </div>

              {notesLoading ? (
                <div className="text-center py-4 text-muted small">Loading notes...</div>
              ) : notes.length === 0 ? (
                <div className="text-center py-4 text-muted small">
                  No notes yet. Add the first note for this patient.
                </div>
              ) : (
                <div className="notes-list">
                  {notes.map((note) => (
                    <div key={note.id} className="note-item">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="note-type-badge"
                            style={{ backgroundColor: `${getNoteTypeColor(note.note_type)}20`, color: getNoteTypeColor(note.note_type) }}
                          >
                            {note.note_type}
                          </span>
                        </div>
                        <span className="text-muted small">{formatDate(note.created_at)}</span>
                      </div>
                      <p className="small text-muted mb-1">
                        <i className="bi bi-person me-1"></i>{note.clinician_name}
                      </p>
                      <p className="small mb-0">{note.note_text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default TreatmentNotes;