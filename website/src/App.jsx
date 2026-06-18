import { Routes, Route, Navigate } from "react-router-dom";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import RequestAccess from "./pages/RequestAccess";
import PatientSummary from "./pages/PatientSummary";
import AdherenceTrends from "./pages/AdherenceTrends";
import DrugInteractions from "./pages/DrugInteractions";
import TreatmentNotes from "./pages/TreatmentNotes";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./App.css";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/request-access" element={<ProtectedRoute><RequestAccess /></ProtectedRoute>} />
      <Route path="/patient-summary" element={<ProtectedRoute><PatientSummary /></ProtectedRoute>} />
      <Route path="/adherence-trends" element={<ProtectedRoute><AdherenceTrends /></ProtectedRoute>} />
      <Route path="/drug-interactions" element={<ProtectedRoute><DrugInteractions /></ProtectedRoute>} />
      <Route path="/treatment-notes" element={<ProtectedRoute><TreatmentNotes /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;