import API_BASE from "../config";
import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import "./AdminDashboard.css";
import { io } from "socket.io-client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const socket = io(API_BASE, {
  autoConnect: false,
});

function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  const storedUser = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const [showReport, setShowReport] = useState(false);

  /* ================= FETCH USERS ================= */
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  /* ================= AUTH CHECK ================= */
  useEffect(() => {
    if (!storedUser || storedUser.role !== "admin") {
      setUnauthorized(true);
    }
  }, []);

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    if (!unauthorized) {
      fetchUsers();
    }
  }, [unauthorized]);

  /* ================= SOCKET.IO ================= */
  useEffect(() => {
    if (unauthorized || !token) return;

    socket.auth = { token };
    socket.connect();

    socket.emit("join-admin");

    socket.on("storage-updated", () => {
      fetchUsers();
    });

    return () => {
      socket.off("storage-updated");
      socket.disconnect();
    };
  }, [unauthorized]);

  /* ================= STATS ================= */
  const totalUsers = users.length;
  const totalAdmins = users.filter(u => u.role === "admin").length;

  const formatStorage = (bytes) => {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return mb < 1000
      ? `${mb.toFixed(2)} MB`
      : `${(mb / 1024).toFixed(2)} GB`;
  };
  const formatGB = (bytes) => {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2);
  };

  const totalStorageUsed = users.reduce(
    (sum, u) => sum + (u.storageUsed || 0),
    0
  );

  const totalFiles = users.reduce(
    (sum, u) => sum + (u.fileCount || 0),
    0
  );

  const totalFree = users.filter(u => u.plan === "free").length;
  const totalPro = users.filter(u => u.plan === "pro").length;

  const averageStoragePerUser =
    totalUsers > 0 ? totalStorageUsed / totalUsers : 0;

  // Define system total space (example 500GB)
  const SYSTEM_TOTAL_SPACE = 500 * 1024 * 1024 * 1024;

  const systemUtilizationPercent =
    (totalStorageUsed / SYSTEM_TOTAL_SPACE) * 100;

  // PDF Generation  
  const generatePDF = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleString();

    // Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 30, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("Cloud Storage System Report", 20, 20);

    doc.setTextColor(0, 0, 0);

    doc.setFontSize(10);
    doc.text(`Generated: ${today}`, 20, 40);

    // Divider
    doc.setDrawColor(200);
    doc.line(20, 45, 190, 45);

    // Section Title
    doc.setFontSize(14);
    doc.text("System Overview", 20, 60);

    doc.setFontSize(12);
    doc.text(`Total Users: ${totalUsers}`, 25, 75);
    doc.text(`Admin Accounts: ${totalAdmins}`, 25, 85);
    doc.text(`Total Files: ${totalFiles}`, 25, 95);

    doc.text(
      `Storage Used: ${formatGB(totalStorageUsed)} GB`,
      25,
      105
    );
    doc.text(
      `System Capacity: ${formatGB(SYSTEM_TOTAL_SPACE)} GB`,
      25,
      115
    );
    doc.text(
      `Utilization: ${systemUtilizationPercent.toFixed(1)}%`,
      25,
      125
    );

    doc.setFontSize(14);
    doc.text("User Distribution", 20, 145);

    doc.setFontSize(12);
    doc.text(`Free Users: ${totalFree}`, 25, 160);
    doc.text(`Pro Users: ${totalPro}`, 25, 170);

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(
      "Confidential - Internal System Report",
      20,
      285
    );

    doc.save("Cloud_System_Report.pdf");
  };

  /* ================= REDIRECT ================= */
  if (unauthorized) {
    return <Navigate to="/Dashboard" />;
  }

  /* ================= UI ================= */
  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className="report-btn"
            onClick={() => setShowReport(true)}
          >
            Generate Report
          </button>

          <button
            className="back-btn"
            onClick={() => navigate("/Dashboard")}
          >
            Back to User Dashboard
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Users</h3>
          <p>{totalUsers}</p>
        </div>

        <div className="stat-card">
          <h3>System Space Utilized</h3>
          <p>{formatStorage(totalStorageUsed)}</p>
        </div>

        <div className="stat-card">
          <h3>Total Files</h3>
          <p>{totalFiles}</p>
        </div>

        <div className="stat-card admin">
          <h3>Admin Accounts</h3>
          <p>{totalAdmins}</p>
        </div>
      </div>

      <div className="charts-grid">
      {/* Average Storage Circular */}
      <div className="chart-card">
        <h3>Average Storage Per User</h3>
        <CircularProgressbar
          value={(averageStoragePerUser / (10 * 1024 * 1024 * 1024)) * 100}
          text={formatStorage(averageStoragePerUser)}
          styles={buildStyles({
            pathColor: "#4f46e5",
            textColor: "#111",
          })}
        />
      </div>

      {/* System Utilization Circular */}
      <div className="chart-card">
        <h3>System Space Utilization</h3>
        <CircularProgressbar
          value={systemUtilizationPercent}
          text={`${systemUtilizationPercent.toFixed(1)}%`}
          styles={buildStyles({
            pathColor: "#22c55e",
            textColor: "#111",
          })}
        />
        <p
          style={{
            marginTop: "12px",
            fontSize: "14px",
            color: "#666",
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          {formatGB(totalStorageUsed)} GB /{" "}
          {formatGB(SYSTEM_TOTAL_SPACE)} GB
        </p>
      </div>

      {/* Pie Chart */}
      <div className="chart-card">
        <h3>User Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={[
                { name: "Free", value: totalFree },
                { name: "Pro", value: totalPro },
                { name: "Admin", value: totalAdmins },
              ]}
              dataKey="value"
              outerRadius={80}
            >
              <Cell fill="#60a5fa" />
              <Cell fill="#34d399" />
              <Cell fill="#facc15" />
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

    </div>

      <h2 className="section-title">User Management</h2>

      {loading ? (
        <p className="loading-text">Loading users...</p>
      ) : (
        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Plan</th>
              <th>Storage Used</th>
              <th>Files</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user._id}>
                <td>{user.fullName}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`badge ${user.role}`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  <span className={`badge plan-${user.plan}`}>
                    {user.plan}
                  </span>
                </td>
                <td>{formatStorage(user.storageUsed)}</td>
                <td>{user.fileCount || 0}</td>
                <td>
                  {user.plan === "pro" && (
                    <button
                      className="downgrade-btn"
                      onClick={async () => {
                        if (!window.confirm(`Downgrade ${user.email} to Free?`)) return;

                        const res = await fetch(
                          `${API_BASE}/api/admin/users/${user._id}/downgrade`,
                          {
                            method: "POST",
                            headers: {
                              Authorization: `Bearer ${token}`,
                            },
                          }
                        );

                        const data = await res.json();

                        if (!res.ok) {
                          alert(data.message || "Downgrade failed");
                          return;
                        }

                        alert("User downgraded to Free");
                        fetchUsers(); // 🔥 refresh table
                      }}
                    >
                      Downgrade
                    </button>
                  )}

                    {/* 🔼 Promote to Admin */}
                    {user.role === "user" && (
                      <button
                        className="promote-btn"
                        onClick={async () => {
                          const confirm1 = window.confirm(
                            `Promote ${user.email} to Admin?`
                          );
                          if (!confirm1) return;

                          const confirm2 = window.confirm(
                            "This user will receive FULL admin privileges. Continue?"
                          );
                          if (!confirm2) return;

                          const res = await fetch(
                            `${API_BASE}/api/admin/users/${user._id}/promote`,
                            {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` },
                            }
                          );

                          if (!res.ok) {
                            alert("Promotion failed");
                            return;
                          }

                          alert("User promoted to Admin");
                          fetchUsers();
                        }}
                      >
                        Promote
                      </button>
                    )}

                    {/* 🔽 Demote Admin */}
                    {user.role === "admin" && user._id !== storedUser._id && (
                      <button
                        className="demote-btn"
                        onClick={async () => {
                          const confirm1 = window.confirm(
                            `Demote ${user.email} to normal user?`
                          );
                          if (!confirm1) return;

                          const confirm2 = window.confirm(
                            "Admin privileges will be removed. Continue?"
                          );
                          if (!confirm2) return;

                          const res = await fetch(
                            `${API_BASE}/api/admin/users/${user._id}/demote`,
                            {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` },
                            }
                          );

                          if (!res.ok) {
                            alert("Demotion failed");
                            return;
                          }

                          alert("Admin demoted successfully");
                          fetchUsers();
                        }}
                      >
                        Demote
                      </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showReport && (
        <div className="report-overlay">
          <div className="report-modal">
            
            <div className="report-header">
              <h2>Cloud System Performance Report</h2>
              <span className="report-date">
                {new Date().toLocaleString()}
              </span>
            </div>

            <div className="report-section">
              <h3>📊 Executive Summary</h3>
              <p>
                The platform currently manages <strong>{totalUsers}</strong> users
                with <strong>{totalFiles}</strong> stored files.
                System utilization stands at{" "}
                <strong>{systemUtilizationPercent.toFixed(1)}%</strong>.
              </p>
            </div>

            <div className="report-grid">
              <div className="report-card">
                <span>Total Users</span>
                <strong>{totalUsers}</strong>
              </div>

              <div className="report-card">
                <span>Admins</span>
                <strong>{totalAdmins}</strong>
              </div>

              <div className="report-card">
                <span>Total Storage Used</span>
                <strong>{formatGB(totalStorageUsed)} GB</strong>
              </div>

              <div className="report-card">
                <span>System Capacity</span>
                <strong>{formatGB(SYSTEM_TOTAL_SPACE)} GB</strong>
              </div>

              <div className="report-card">
                <span>Free Users</span>
                <strong>{totalFree}</strong>
              </div>

              <div className="report-card">
                <span>Pro Users</span>
                <strong>{totalPro}</strong>
              </div>
            </div>

            <div className="report-actions">
              <button className="download-btn" onClick={generatePDF}>
                Download
              </button>
              <button
                className="close-btn"
                onClick={() => setShowReport(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default AdminDashboard;
