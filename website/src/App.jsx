import { Routes, Route, Navigate } from "react-router-dom";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

// Protected Route 
// Redirects to sign in if no token found in localStorage
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Protected routes — will be added as I build each feature */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <div className="p-4">
              <h3>Dashboard — coming next</h3>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;