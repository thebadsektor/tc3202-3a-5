import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";
import Lugo from "/src/assets/jaibot-logo.png";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);

  // Name validation function - only allows letters
  const validateName = (name) => {
    if (name.length === 0) return true; // Allow empty field (validation will happen on submit)
    const nameRegex = /^[A-Za-z]+$/;
    return nameRegex.test(name);
  };

  // Handle first name input with validation and auto-uppercase
  const handleFirstNameChange = (e) => {
    const value = e.target.value;
    
    if (validateName(value)) {
      setFirstName(value.toUpperCase());
      setNameError("");
    } else {
      // Don't update the state with invalid input
      setNameError("Names can only contain letters (A-Z)");
    }
  };

  // Handle last name input with validation and auto-uppercase
  const handleLastNameChange = (e) => {
    const value = e.target.value;
    
    if (validateName(value)) {
      setLastName(value.toUpperCase());
      setNameError("");
    } else {
      // Don't update the state with invalid input
      setNameError("Names can only contain letters (A-Z)");
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setNameError("");

    // Final validation before submission
    if (firstName.length === 0 || lastName.length === 0) {
      setNameError("First name and last name are required.");
      return;
    }

    if (!validateName(firstName) || !validateName(lastName)) {
      setNameError("Names can only contain letters (A-Z)");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signup(email, password, "user", firstName, lastName);

      const user = userCredential.user;

      // Store user details in Firestore
      await setDoc(doc(db, "users", user.uid), {
        firstName,
        lastName,
        email,
        role: "user",
      });

      navigate("/user");
    } catch (err) {
      setError(err.message || "Failed to create an account.");
      setLoading(false);
    }
  };

  return (
    <div className="login-card">
      <div className="login-content">
        <div className="login-header">
          <h1 className="quiz-title">Jaibot Quiz</h1>
          <h2 className="auth-title-signup">Sign Up</h2>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {nameError && <div className="auth-error">{nameError}</div>}

        <form className="auth-form" onSubmit={handleSignup}>
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={handleFirstNameChange}
            required
            disabled={loading}
          />

          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={handleLastNameChange}
            required
            disabled={loading}
          />

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />

          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? (
              <div className="loading-indicator">
                <span className="loading-circle"></span>
                Processing...
              </div>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <div className="auth-link">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}