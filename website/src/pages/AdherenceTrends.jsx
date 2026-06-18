import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";
import Layout from "../components/Layout";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function AdherenceTrends() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get("id");

  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(patientIdFromUrl || "");
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [error, setError] = useState("");

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
    if (!selectedPatient) { setData(null); return; }
    setLoading(true);
    setError("");
    setData(null);

    axios
      .get(
        `${import.meta.env.VITE_API_URL}/api/clinician/adherence/${selectedPatient}?days=${days}`,
        { headers: getHeaders() }
      )
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/");
        }
        setError(err.response?.data?.error || "Failed to load adherence trends");
      })
      .finally(() => setLoading(false));
  }, [selectedPatient, days]);

  const adherenceColor = (pct) => {
    if (pct >= 80) return "#4caf82";
    if (pct >= 60) return "#f0c86a";
    return "#e57373";
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  };

  const lineChartData = data ? {
    labels: data.dailyData.map((d) => formatDate(d.date)),
    datasets: [
      {
        label: "Adherence %",
        data: data.dailyData.map((d) => {
          const total = d.taken + d.missed;
          return total > 0 ? Math.round((d.taken / total) * 100) : 0;
        }),
        borderColor: "#c9636a",
        backgroundColor: "rgba(201, 99, 106, 0.1)",
        borderWidth: 2.5,
        pointBackgroundColor: "#c9636a",
        pointRadius: 4,
        tension: 0.3,
        fill: true,
      },
    ],
  } : null;

  const donutData = data ? {
    labels: ["Taken", "Missed"],
    datasets: [{
      data: [data.stats.totalTaken, data.stats.totalMissed],
      backgroundColor: ["#4caf82", "#e57373"],
      borderWidth: 0,
    }],
  } : null;

  const medBarData = data ? {
    labels: data.medAdherence.map((m) => m.drug_name),
    datasets: [
      {
        label: "Adherence %",
        data: data.medAdherence.map((m) => m.adherence_pct),
        backgroundColor: data.medAdherence.map((m) => adherenceColor(m.adherence_pct)),
        borderRadius: 4,
        barThickness: 20,
      },
    ],
  } : null;

  const lineOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8 },
      },
    },
    scales: {
      y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } },
    },
  };

  const donutOptions = {
    responsive: true,
    cutout: "70%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.raw}`,
        },
      },
    },
  };

  const medBarOptions = {
    indexAxis: "y",
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` Adherence % : ${ctx.raw}`,
        },
      },
    },
    scales: {
      x: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}` } },
    },
  };

  return (
    <Layout>
      <div className="page-header d-flex justify-content-between align-items-center">
        <div>
          <h4>Adherence Trends</h4>
          <p>Track patient medication adherence over time</p>
        </div>
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={() => navigate(`/patient-summary${selectedPatient ? `?id=${selectedPatient}` : ""}`)}
        >
          ← Patient Summary
        </button>
      </div>

      {/* Controls */}
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
            <label className="form-label">Time Period</label>
            <select
              className="form-select"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger small">{error}</div>}
      {loading && <div className="text-center py-5 text-muted small">Loading adherence data...</div>}
      {!selectedPatient && !loading && (
        <div className="text-center py-5 text-muted small">
          Select a patient above to view their adherence trends.
        </div>
      )}

      {!loading && data && (
        <>
          {/* Stat Cards */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-2">
              <div className="stat-card text-center">
                <div className="stat-icon pink mx-auto"><i className="bi bi-bar-chart-line"></i></div>
                <div className="stat-value" style={{ color: adherenceColor(data.stats.overallPct) }}>
                  {data.stats.overallPct}%
                </div>
                <div className="stat-label">Overall Adherence</div>
              </div>
            </div>
            <div className="col-6 col-md-2">
              <div className="stat-card text-center">
                <div className="stat-icon green mx-auto"><i className="bi bi-check-circle"></i></div>
                <div className="stat-value">{data.stats.totalTaken}</div>
                <div className="stat-label">Doses Taken</div>
              </div>
            </div>
            <div className="col-6 col-md-2">
              <div className="stat-card text-center">
                <div className="stat-icon red mx-auto"><i className="bi bi-x-circle"></i></div>
                <div className="stat-value">{data.stats.totalMissed}</div>
                <div className="stat-label">Doses Missed</div>
              </div>
            </div>
            <div className="col-6 col-md-2">
              <div className="stat-card text-center">
                <div className="stat-icon green mx-auto"><i className="bi bi-star"></i></div>
                <div className="stat-value" style={{ fontSize: "1rem" }}>{data.stats.bestDay}</div>
                <div className="stat-label">Best Day</div>
              </div>
            </div>
            <div className="col-6 col-md-2">
              <div className="stat-card text-center">
                <div className="stat-icon yellow mx-auto"><i className="bi bi-exclamation-circle"></i></div>
                <div className="stat-value" style={{ fontSize: "1rem" }}>{data.stats.needsWorkDay}</div>
                <div className="stat-label">Needs Work</div>
              </div>
            </div>
            <div className="col-6 col-md-2">
              <div className="stat-card text-center">
                <div className="stat-icon yellow mx-auto"><i className="bi bi-lightning"></i></div>
                <div className="stat-value">{data.stats.currentStreak}</div>
                <div className="stat-label">Current Streak</div>
              </div>
            </div>
          </div>

          {/* Line Chart */}
          <div className="medco-card mb-4">
            <h6 className="medco-card-title">Adherence % Over Time</h6>
            <Line data={lineChartData} options={lineOptions} height={80} />
          </div>

          {/* Donut + Medication Bar Chart */}
          <div className="row g-4 mb-4">
            <div className="col-md-5">
              <div className="medco-card h-100">
                <h6 className="medco-card-title">Dose Distribution</h6>
                    <div style={{ maxWidth: "260px", margin: "55px auto 0" }}>
                    <Doughnut data={donutData} options={donutOptions} />
                </div>
              </div>
            </div>
            <div className="col-md-7">
              <div className="medco-card h-100">
                <h6 className="medco-card-title">Medication Breakdown</h6>
                <Bar data={medBarData} options={medBarOptions} />
              </div>
            </div>
          </div>

          {/* Medication Specific Details */}
          <div className="medco-card">
            <h6 className="medco-card-title">Medication-Specific Details</h6>
            <div className="row g-3">
              {data.medAdherence.map((med) => (
                <div className="col-6 col-md-3" key={med.id}>
                  <div style={{
                    background: "#fff9f9",
                    border: "1px solid #f0e6e6",
                    borderRadius: "10px",
                    padding: "0.8rem",
                  }}>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-semibold small">{med.drug_name}</span>
                      <span
                        style={{
                          backgroundColor: adherenceColor(med.adherence_pct),
                          color: "white",
                          fontSize: "0.72rem",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "20px",
                          fontWeight: 600,
                        }}
                      >
                        {med.adherence_pct}%
                      </span>
                    </div>
                    <div className="d-flex gap-2">
                      <span className="small text-muted">Taken: {med.taken}</span>
                      <span className="small text-muted">Missed: {med.missed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

export default AdherenceTrends;