import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext"; // Update the path as needed
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
        {/* You could add your logo here if needed */}
      </div>
      <div className="forgot-password-container">
        <div className="logo-container">
          {/* Inner logo container if needed */}
        </div>
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