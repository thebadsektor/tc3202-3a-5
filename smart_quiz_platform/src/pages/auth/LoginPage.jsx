import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import Lugo from "/src/assets/jaibot-logo.png";
import show from "/src/assets/showpassicon.png";
import hide from "/src/assets/hidepassicon.png";
import "./LoginPage.css";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Authenticate user
      const userCredential = await login(email, password);
      const user = userCredential.user;

      // Fetch user role from Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role;

        if (role === "admin") {
          navigate("/admin");
        } else {
          navigate("/user");
        }
      } else {
        setError("User role not found.");
      }
    } catch (err) {
      setError("Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-card">
      <div className="login-content">
        <div className="login-header">
          <h1 className="quiz-title">Jaibot Quiz</h1>
          <img src={Lugo} className="jaibot-image" alt="Jaibot" />

          {/* Auth Title */}
          <h2 className="auth-title">Login</h2>
        </div>

        {/* Display error if exists */}
        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="input-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div style={{ position: "relative", width: "100%" }}>
              <div className="password-container">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <img
                  src={showPassword ? hide : show}
                  alt="Toggle Password Visibility"
                  className="show-password-icon"
                  onClick={() => setShowPassword((prev) => !prev)}
                />
              </div>
            </div>
          </div>

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </button>

          <div className="auth-footer">
            <p className="auth-link">
              Don't have an account? <Link to="/signup">Sign up</Link> |
              <Link to="/reset-pass" className="forgot-password-link">
                Forgot Password
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
