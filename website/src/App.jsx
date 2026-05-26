import { Routes, Route, Navigate } from "react-router-dom";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import RequestAccess from "./pages/RequestAccess";
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
      {/* Public */}
      <Route path="/" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Protected */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/request-access" element={<ProtectedRoute><RequestAccess /></ProtectedRoute>} />

      {/* Coming next */}
      <Route path="/patient-summary" element={<ProtectedRoute><div className="p-4">Patient Summary — coming next</div></ProtectedRoute>} />
      <Route path="/adherence-trends" element={<ProtectedRoute><div className="p-4">Adherence Trends — coming next</div></ProtectedRoute>} />
      <Route path="/drug-interactions" element={<ProtectedRoute><div className="p-4">Drug Interactions — coming next</div></ProtectedRoute>} />
      <Route path="/treatment-notes" element={<ProtectedRoute><div className="p-4">Treatment Notes — coming next</div></ProtectedRoute>} />
    </Routes>
  );
}

export default App;