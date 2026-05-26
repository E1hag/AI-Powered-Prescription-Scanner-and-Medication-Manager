import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import "bootstrap-icons/font/bootstrap-icons.css";

function Layout({ children }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <div className="layout-wrapper">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h4>MEDCO</h4>
          <span>Clinician Portal</span>
        </div>

        <ul className="sidebar-nav">
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? "active" : ""}>
              <i className="bi bi-grid"></i> Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/request-access" className={({ isActive }) => isActive ? "active" : ""}>
              <i className="bi bi-box-arrow-in-right"></i> Request Access
            </NavLink>
          </li>
          <li>
            <NavLink to="/patient-summary" className={({ isActive }) => isActive ? "active" : ""}>
              <i className="bi bi-person-plus"></i> Patient Summary
            </NavLink>
          </li>
          <li>
            <NavLink to="/adherence-trends" className={({ isActive }) => isActive ? "active" : ""}>
              <i className="bi bi-bar-chart-line"></i> Adherence Trends
            </NavLink>
          </li>
          <li>
            <NavLink to="/drug-interactions" className={({ isActive }) => isActive ? "active" : ""}>
              <i className="bi bi-exclamation-triangle"></i> Drug Interactions
            </NavLink>
          </li>
          <li>
            <NavLink to="/treatment-notes" className={({ isActive }) => isActive ? "active" : ""}>
              <i className="bi bi-file-text"></i> Treatment Notes
            </NavLink>
          </li>
        </ul>

        <div className="sidebar-logout">
          <button onClick={handleLogout}>
            <i className="bi bi-box-arrow-right"></i> Logout
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="main-content">
        {/* Top Bar */}
        <div className="topbar">
          <h6 className="topbar-welcome">
            Welcome back, Dr. {user.full_name.split(" ")[0] || "Clinician"}
          </h6>
        <div className="topbar-user" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <i className="bi bi-person-circle me-2"></i>
            <span>{user.email || "Clinician"}</span>
            <i className="bi bi-chevron-down ms-1"></i>
            {dropdownOpen && (
              <div className="topbar-dropdown">
                <button onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2"></i>Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Page Content */}
        <div className="page-body">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Layout;