import React, { useState, useEffect } from 'react';
import './App.css';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// Palitan ito ng sarili mong Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDYM0lfI2ItticteBYYznjV0EdqcLLhlvY",
  authDomain: "smartquiz-618e0.firebaseapp.com",
  projectId: "smartquiz-618e0",
  storageBucket: "smartquiz-618e0.firebasestorage.app",
  messagingSenderId: "139353391327",
  appId: "1:139353391327:web:7514f7e2ae4e5cc94ce96a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function App() {
  // State variables
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  });

  // Check if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // You can redirect to dashboard here
        // window.location.href = '/dashboard';
      } else {
        setUser(null);
        // Check if email is saved in localStorage
        const savedEmail = localStorage.getItem('quizEmail');
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Form validation function
  const validateForm = () => {
    let isValid = true;
    const newErrors = { 
      email: '', 
      password: '',
      confirmPassword: '',
      fullName: ''
    };
    
    // Email validation
    if (!email) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
      isValid = false;
    }
    
    // Password validation
    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    // Additional validations for signup
    if (isSignup) {
      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
        isValid = false;
      }
      
      if (!fullName) {
        newErrors.fullName = 'Full name is required';
        isValid = false;
      }
    }
    
    setErrors(newErrors);
    return isValid;
  };

  // Login function
  const loginUser = async () => {
    try {
      setIsLoading(true);
      
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Login successful!", userCredential.user);
      
      // Save email if "Remember me" is checked
      if (rememberMe) {
        localStorage.setItem('quizEmail', email);
      } else {
        localStorage.removeItem('quizEmail');
      }
      
      // Redirect to dashboard (you can replace this with your own logic)
      alert("Login successful! Redirecting to dashboard...");
      // window.location.href = '/dashboard';
      
    } catch (error) {
      console.error("Login error:", error.message);
      let errorMessage = "Login failed";
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = "Invalid email or password";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed login attempts. Try again later";
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Signup function
  const signupUser = async () => {
    try {
      setIsLoading(true);
      
      // Create user with Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("Signup successful!", user);
      
      // Store additional user data in Firestore
      await setDoc(doc(db, "users", user.uid), {
        fullName: fullName,
        email: email,
        createdAt: new Date().toISOString(),
        quizzesTaken: 0,
        points: 0
      });
      
      alert("Account created successfully! You are now logged in.");
      // window.location.href = '/dashboard';
      
    } catch (error) {
      console.error("Signup error:", error.message);
      let errorMessage = "Signup failed";
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already registered";
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Form submission handler
  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      if (isSignup) {
        signupUser();
      } else {
        loginUser();
      }
    }
  };

  // Forgot password handler
  const handleForgotPassword = async () => {
    if (!email) {
      setErrors({...errors, email: 'Please enter your email first'});
      return;
    }
    
    try {
      setIsLoading(true);
      await sendPasswordResetEmail(auth, email);
      alert(`Password reset link has been sent to ${email}`);
    } catch (error) {
      console.error("Password reset error:", error.message);
      alert("Failed to send password reset email: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle between login and signup
  const toggleAuthMode = () => {
    setIsSignup(!isSignup);
    setErrors({
      email: '',
      password: '',
      confirmPassword: '',
      fullName: ''
    });
  };

  

  // If user is already logged in
  if (user) {
    return (
      <div className="App">
        <div className="login-container">
          <div className="login-card">
            <h2>You are logged in!</h2>
            <p>Email: {user.email}</p>
            <button 
              onClick={() => signOut(auth)}
              className="login-button"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="logo">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
                <path d="M12 4.75L19.25 9V17.25L12 21.5L4.75 17.25V9L12 4.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1>Quiz Platform</h1>
            <p className="tagline">Test your knowledge. Challenge your friends.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="login-form">
            {isSignup && (
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <input 
                  type="text" 
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan dela Cruz"
                  className={errors.fullName ? 'error' : ''}
                />
                {errors.fullName && <p className="error-message">{errors.fullName}</p>}
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input 
                type="email" 
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <p className="error-message">{errors.email}</p>}
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input 
                type="password" 
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={errors.password ? 'error' : ''}
              />
              {errors.password && <p className="error-message">{errors.password}</p>}
              {!isSignup && (
                <div className="forgot-password">
                  <a href="#" onClick={(e) => {e.preventDefault(); handleForgotPassword();}}>
                    Forgot password?
                  </a>
                </div>
              )}
            </div>
            
            {isSignup && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input 
                  type="password" 
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={errors.confirmPassword ? 'error' : ''}
                />
                {errors.confirmPassword && <p className="error-message">{errors.confirmPassword}</p>}
              </div>
            )}
            
            {!isSignup && (
              <div className="form-group remember-me">
                <input 
                  type="checkbox" 
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label htmlFor="rememberMe">Remember me</label>
              </div>
            )}
            
            <button 
              type="submit" 
              className={`login-button ${isLoading ? 'loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading 
                ? (isSignup ? 'Creating Account...' : 'Signing in...') 
                : (isSignup ? 'Create Account' : 'Sign In')}
            </button>
          </form>
          
          <div className="login-footer">
            <p>
              {isSignup 
                ? 'Already have an account?' 
                : "Don't have an account?"}
              <a href="#" onClick={(e) => {e.preventDefault(); toggleAuthMode();}}>
                {isSignup ? ' Sign In' : ' Sign Up'}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;