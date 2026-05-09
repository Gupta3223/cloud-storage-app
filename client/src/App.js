import API_BASE from "./config";
import React, { useState } from "react";
import "./App.css";
import Logo from "./assets/airbox-logo.png";
import { Routes, Route, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";

function App() {

  // ===== MODAL STATES =====
  const [showSignin, setShowSignin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  // ===== LOGIN STATES =====
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // ===== REGISTER STATES =====
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerError, setRegisterError] = useState("");

  const navigate = useNavigate();

  const closeModals = () => {
    setShowSignin(false);
    setShowRegister(false);
  };

  // =============================
  // LOGIN FUNCTION
  // =============================
  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      alert("Please enter email & password!");
      return;
    }
    
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: loginEmail,
        password: loginPassword,
      }),
    });

    const data = await res.json();
    console.log("LOGIN RESPONSE:", data);

    if (!data.success) {
      alert(data.message);
    } else {
      // ✅ SAVE TOKEN
      localStorage.setItem("token", data.token);

      // (optional but useful)
      localStorage.setItem("user", JSON.stringify(data.user));
      alert("Login Successful!");
      closeModals();

      if (data.user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/Dashboard");
      }
    }
  };

  // REGISTER FUNCTION
  const handleRegister = async () => {

    if (!fullName || !age || !regEmail || !regPassword || !confirmPassword) {
      alert("Please fill all fields!");
      return;
    }

    if (regPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        age,
        email: regEmail,
        password: regPassword,
        confirmPassword,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      setRegisterError(data.message); // Account already registered
      return;
    }
    alert("Registration Successful!");
    setRegisterError("");
    closeModals();
  }

  return (
    <Routes>
      {/* HOME PAGE */}
      <Route
        path="/"
        element={
          <>
            {/* ===== BACKGROUND ===== */}
            <div className={`home-container ${showSignin || showRegister ? "blur-bg" : ""}`}>
              
              {/* NAVBAR */}
              <nav className="navbar">
                <div className="logo-container">
                  <img src={Logo} alt="AirBox Logo" className="logo-img" />
                </div>

                <div className="nav-buttons">
                  <button className="btn-outline" onClick={() => setShowSignin(true)}>
                    Sign In
                  </button>
                  <button className="btn-filled" onClick={() => setShowRegister(true)}>
                    Register
                  </button>
                </div>
              </nav>

              {/* HERO */}
              <div className="hero-section">
                <h1>Store & Manage Your Files Easily</h1>
                <p>Your personal cloud — secure, fast & accessible anywhere.</p>
                <button className="btn-filled big-btn" onClick={() => setShowRegister(true)}>
                  Get Started
                </button>
              </div>

              {/* FEATURES SECTION */}
              <div className="features-section">
                <div className="feature-card slide-up">
                  <h3>📁 Smart File Storage</h3>
                  <p>Upload, organize & manage files with folders easily.</p>
                </div>

                <div className="feature-card slide-up delay-1">
                  <h3>🔒 Secure Access</h3>
                  <p>Protected authentication with role-based access.</p>
                </div>

                <div className="feature-card slide-up delay-2">
                  <h3>⚡ Fast & Responsive</h3>
                  <p>Optimized UI for quick file handling.</p>
                </div>
              </div>
              {/* PREVIEW SECTION */}
              <div className="preview-section">
                <div className="preview-text">
                  <h2>Your Cloud, Simplified</h2>
                  <p>
                    A clean dashboard experience designed for speed,
                    clarity and control.
                  </p>
                </div>

                <div className="preview-card floating">
                  <div className="fake-toolbar"></div>
                  <div className="fake-content">
                    <div className="fake-file"></div>
                    <div className="fake-file"></div>
                    <div className="fake-file"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== SIGN IN MODAL (OUTSIDE BLUR) ===== */}
            {showSignin && (
              <div className="modal-overlay" onClick={closeModals}>
                <div className="auth-modal" onClick={(e) => e.stopPropagation()}>

                  {/* LEFT PANEL */}
                  <div className="auth-left login-left">
                    <h2>Welcome Back</h2>
                    <p className="dummy-text">
                      Sign in to access your files securely.
                    </p>
                  </div>

                  {/* RIGHT FORM */}
                  <div className="auth-right">
                    <h2 className="blue-title">Sign In</h2>

                    <input
                      type="email"
                      placeholder="Email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />

                    <input
                      type="password"
                      placeholder="Password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />

                    <button className="btn-filled full-btn" onClick={handleLogin}>
                      Sign In
                    </button>

                    <p className="switch-text">
                      Don’t have an account?{" "}
                      <span onClick={() => {
                        setShowSignin(false);
                        setShowRegister(true);
                      }}>
                        Register
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ===== REGISTER MODAL ===== */}
            {showRegister && (
              <div className="modal-overlay" onClick={closeModals}>
                <div className="auth-modal" onClick={(e) => e.stopPropagation()}>

                  {/* LEFT PANEL */}
                  <div className="auth-left register-left">
                    <h2>Create Account</h2>
                    <p className="dummy-text">
                      Join AirBox and access your cloud anywhere, anytime.
                    </p>
                  </div>

                  {/* RIGHT FORM */}
                  <div className="auth-right">
                    <h2 className="blue-title">Register</h2>

                    <input
                      type="text"
                      placeholder="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />

                    <input
                      type="number"
                      placeholder="Age"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                    />

                    <input
                      type="email"
                      placeholder="Email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                    />

                    <input
                      type="password"
                      placeholder="Password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />

                    <input
                      type="password"
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />

                    {registerError && (
                      <p style={{ color: "red", marginTop: "10px" }}>
                        {registerError}
                      </p>
                    )}

                    <button className="btn-filled full-btn" onClick={handleRegister}>
                      Register
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        }
      />

      {/* DASHBOARD PAGE */}
      <Route path="/Dashboard" element={<Dashboard />} />      
      <Route path="/admin" element={<AdminDashboard />} />

    </Routes>
  );
}
export default App;