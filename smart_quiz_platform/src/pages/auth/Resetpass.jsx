import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./resetpass.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");
    setError("");
    
    try {
      await resetPassword(email);
      setMessage("If this email is registered, you will receive a password reset link.");
    } catch (err) {
      console.error("Password reset error:", err);
      // We don't want to reveal if an email exists in our system for security
      // So we show the same message regardless of success or failure
      setMessage("If this email is registered, you will receive a password reset link.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="logo-container">
        {/* Logo placeholder - replace with your own logo */}
        <svg width="120" height="40" viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 0C8.954 0 0 8.954 0 20s8.954 20 20 20 20-8.954 20-20S31.046 0 20 0zm0 30c-5.523 0-10-4.477-10-10s4.477-10 10-10 10 4.477 10 10-4.477 10-10 10z" fill="#4F46E5"/>
          <path d="M50 10h8c6.627 0 12 5.373 12 12s-5.373 12-12 12h-8V10z" fill="#4F46E5"/>
          <path d="M80 10h25c2.761 0 5 2.239 5 5v20c0 2.761-2.239 5-5 5H80V10z" fill="#4F46E5" fillOpacity="0.6"/>
        </svg>
      </div>
      <div className="forgot-password-container">
        <div className="header">
          <h2>Reset Your Password</h2>
          <p className="subheading">Enter your email address to receive a password reset link</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input 
              id="email"
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="Enter your email"
              required 
            />
          </div>
          
          <button 
            type="submit" 
            className={`submit-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="spinner"></span>
            ) : (
              "Send Reset Link"
            )}
          </button>
        </form>
        
        {message && <div className="message">{message}</div>}
        {error && <div className="error-message">{error}</div>}
        
        <div className="footer">
          <Link to="/login" className="back-link">
            <span className="back-arrow">←</span> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;