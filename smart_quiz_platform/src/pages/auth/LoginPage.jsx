import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import Lugo from "/src/assets/jaibot-logo.png";
import show from "/src/assets/showpassicon.png";
import hide from "/src/assets/hidepassicon.png";
import "./LoginPage.css";

export default function AuthPage({ initialMode = "login" }) {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine initial mode based on URL path or prop
  const getInitialMode = () => {
    if (location.pathname === "/signup") return "signup";
    if (location.pathname === "/login") return "login";
    return initialMode;
  };

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Signup form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Shared state
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(getInitialMode() === "signup");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 576);

  // Handle window resizing for responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 576);
    };
    window.addEventListener("resize", handleResize);
    
    // Ensure mode is correctly set based on URL path when component mounts
    // or when location changes
    setIsSignUp(getInitialMode() === "signup");
    
    return () => window.removeEventListener("resize", handleResize);
  }, [location.pathname, initialMode]);

  // Validation function for name inputs - only letters and spaces allowed
  const validateName = (name) => {
    const nameRegex = /^[A-Za-z\s]+$/;
    return nameRegex.test(name);
  };

  // Handle name input changes with validation and uppercase conversion
  const handleNameChange = (e, setFunction) => {
    const value = e.target.value.toUpperCase();
    
    // Allow empty value (for clearing the field) or values that pass validation
    if (value === "" || validateName(value)) {
      setFunction(value);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const userCredential = await login(loginEmail, loginPassword);
      const user = userCredential.user;

      // Show success animation before navigation
      setLoginSuccess(true);
      
      setTimeout(async () => {
        // Fetch user role from Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const role = userDoc.data().role;
          navigate(role === "admin" ? "/admin" : "/user");
        } else {
          setLoginError("User role not found.");
          setLoginSuccess(false);
          setLoginLoading(false);
        }
      }, 800); // Brief delay to show success animation
    } catch (err) {
      setLoginError("Invalid email or password.");
      setLoginLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError("");

    // Enhanced validation
    if (!firstName.trim()) {
      setSignupError("Please enter your first name.");
      return;
    }

    if (!validateName(firstName)) {
      setSignupError("First name should contain only letters and spaces.");
      return;
    }

    if (!lastName.trim()) {
      setSignupError("Please enter your last name.");
      return;
    }

    if (!validateName(lastName)) {
      setSignupError("Last name should contain only letters and spaces.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupEmail)) {
      setSignupError("Please enter a valid email address.");
      return;
    }

    if (signupPassword !== confirmPassword) {
      setSignupError("Passwords do not match.");
      return;
    }

    setSignupLoading(true);
    try {
      const userCredential = await signup(signupEmail, signupPassword, "user", firstName, lastName);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        firstName,
        lastName,
        email: signupEmail,
        role: "user",
        createdAt: new Date().toISOString(),
      });

      // Show success animation before navigation
      setSignupSuccess(true);
      
      setTimeout(() => {
        navigate("/user");
      }, 800);
    } catch (err) {
      const errorCode = err.code;
      let errorMessage = "Password must be at least 8 characters long and include an uppercase letter, a number, and a special character.";
      
      if (errorCode === "auth/email-already-in-use") {
        errorMessage = "This email is already in use.";
      } else if (errorCode === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      }
      
      setSignupError(errorMessage);
      setSignupLoading(false);
    }
  };

  // Toggle between login and signup panels
  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setLoginError("");
    setSignupError("");
    
    // Update URL without refreshing
    const newPath = isSignUp ? '/login' : '/signup';
    navigate(newPath, { replace: true });
  };

  return (
    <div className="auth-page">
      {/* Floating background elements */}
      <div className="floating-element"></div>
      <div className="floating-element"></div>
      <div className="floating-element"></div>
      <div className="floating-element"></div>
      
      <div className={`auth-container ${isSignUp ? 'right-panel-active' : ''}`}>
        {/* Sign In Container */}
        <div className="auth-form-container sign-in-container">
          <form onSubmit={handleLogin}>
            <div className="gradient-text">Sign In</div>
            
            {loginError && <div className="auth-error">{loginError}</div>}
            
            <div className="floating-label-group">
              <input
                type="email"
                id="loginEmail"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className={loginEmail ? "has-value" : ""}
                disabled={loginLoading}
              />
              <label htmlFor="loginEmail">Email</label>
            </div>
            
            <div className="floating-label-group auth-password-field">
              <input
                type={showLoginPassword ? "text" : "password"}
                id="loginPassword"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className={loginPassword ? "has-value" : ""}
                disabled={loginLoading}
              />
              <label htmlFor="loginPassword">Password</label>
              <img
                src={showLoginPassword ? hide : show}
                alt="Toggle password visibility"
                className="auth-password-toggle"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
              />
            </div>
            
            <a href="/reset-pass" className="auth-forgot-link">
              Forgot your password?
            </a>
            
            <button 
              type="submit" 
              className="auth-button"
              disabled={loginLoading || loginSuccess}
            >
              {loginLoading ? (
                <div className="auth-loading-indicator">
                  <span className="auth-loading-circle"></span>
                  <span>Signing In...</span>
                </div>
              ) : loginSuccess ? (
                <div className="auth-loading-indicator">
                  <span>Success!</span>
                </div>
              ) : (
                "Sign In"
              )}
            </button>
            
            {isMobile && (
              <div className="auth-mobile-toggle">
                <p>Don't have an account? <a onClick={switchMode}>Sign Up</a></p>
              </div>
            )}
          </form>
        </div>
        
        {/* Sign Up Container */}
        <div className="auth-form-container sign-up-container">
          <form onSubmit={handleSignup}>
            
            {signupError && <div className="auth-error">{signupError}</div>}
            
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <div className="floating-label-group">
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => handleNameChange(e, setFirstName)}
                  required
                  className={firstName ? "has-value" : ""}
                  disabled={signupLoading}
                />
                <label htmlFor="firstName">First Name</label>
              </div>
              
              <div className="floating-label-group">
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => handleNameChange(e, setLastName)}
                  required
                  className={lastName ? "has-value" : ""}
                  disabled={signupLoading}
                />
                <label htmlFor="lastName">Last Name</label>
              </div>
            </div>
            
            <div className="floating-label-group">
              <input
                type="email"
                id="signupEmail"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
                className={signupEmail ? "has-value" : ""}
                disabled={signupLoading}
              />
              <label htmlFor="signupEmail">Email</label>
            </div>
            
            <div className="floating-label-group auth-password-field">
              <input
                type={showSignupPassword ? "text" : "password"}
                id="signupPassword"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
                className={signupPassword ? "has-value" : ""}
                disabled={signupLoading}
              />
              <label htmlFor="signupPassword">Password</label>
              <img
                src={showSignupPassword ? hide : show}
                alt="Toggle password visibility"
                className="auth-password-toggle"
                onClick={() => setShowSignupPassword(!showSignupPassword)}
              />
            </div>
            
            <div className="floating-label-group auth-password-field">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={confirmPassword ? "has-value" : ""}
                disabled={signupLoading}
              />
              <label htmlFor="confirmPassword">Confirm Password</label>
              <img
                src={showConfirmPassword ? hide : show}
                alt="Toggle password visibility"
                className="auth-password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            </div>
            
            <button 
              type="submit" 
              className="auth-button"
              disabled={signupLoading || signupSuccess}
            >
              {signupLoading ? (
                <div className="auth-loading-indicator">
                  <span className="auth-loading-circle"></span>
                  <span>Creating Account...</span>
                </div>
              ) : signupSuccess ? (
                <div className="auth-loading-indicator">
                  <span>Success!</span>
                </div>
              ) : (
                "Sign Up"
              )}
            </button>
            
            {isMobile && (
              <div className="auth-mobile-toggle">
                <p>Already have an account? <a onClick={switchMode}>Sign In</a></p>
              </div>
            )}
          </form>
        </div>
        
        {/* Overlay Container */}
        <div className="auth-overlay-container">
          <div className="auth-overlay">
            <div className="auth-overlay-panel overlay-left">
              <div className="auth-logo-container">
                <img src={Lugo} alt="Logo" className="auth-logo" />
              </div>
              <h1 className="auth-title">Create an Account</h1>
              <p>To keep connected with us please login with your personal info</p>
              <button className="auth-button ghost" id="signIn" onClick={switchMode}>
                Sign In
              </button>
            </div>
            <div className="auth-overlay-panel overlay-right">
              <div className="overlay-content">
                <img src={Lugo} alt="Logo" className="auth-logo" />
                <h1 className="auth-title">Hello, Learner!</h1>
                <p>Enter your personal details and start journey with us</p>
                <button className="auth-button ghost" id="signUp" onClick={switchMode}>
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}