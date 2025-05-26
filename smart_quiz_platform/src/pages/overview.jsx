import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Lugo from "/src/assets/jaibot-logo.png";
import "./overview.css";

export default function LandingPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeSection, setActiveSection] = useState(0);
  
  // Features data for the carousel
  const features = [
    {
      title: "Adaptive Learning",
      icon: "🧠",
      description:
        "Our KNN algorithm adapts quiz difficulty based on your performance, making your learning experience personalized and more effective.",
    },
    {
      title: "Performance Analytics",
      icon: "📊",
      description:
        "Track your progress with detailed statistics and visualizations. Identify your strengths and areas that need improvement.",
    },
    {
      title: "Smart Recommendations",
      icon: "🎯",
      description:
        "Receive quiz recommendations based on your learning patterns and areas where you need the most practice.",
    },
    {
      title: "Diverse Quiz Library",
      icon: "📚",
      description:
        "Access a wide range of subjects from Mathematics and Science to Literature, History, and Computer Science.",
    },
  ];

  // Set up automatic slideshow with useEffect
  useEffect(() => {
    const slideInterval = setInterval(() => {
      setActiveSection((prev) => (prev + 1) % features.length);
    }, 5000); // Change slide every 5 seconds
    
    // Clean up the interval when component unmounts
    return () => clearInterval(slideInterval);
  }, [features.length]);

  // Tutorial steps
  const tutorialSteps = [
    {
      title: "Choose a Quiz",
      description:
        "Browse our extensive collection of quizzes organized by subject or try our recommended quizzes tailored to your learning needs.",
      icon: "🔍",
    },
    {
      title: "Take the Quiz",
      description:
        "Answer questions at your own pace. The system adapts to your knowledge level, providing appropriate challenges.",
      icon: "✏️",
    },
    {
      title: "Review Your Results",
      description:
        "Get immediate feedback on your performance with detailed explanations for each question.",
      icon: "📝",
    },
    {
      title: "Track Your Progress",
      description:
        "Visit your learning profile to see detailed statistics and track your improvement over time.",
      icon: "📈",
    },
  ];

  // Navigate to appropriate page based on user role
  const handleGetStarted = () => {
    if (currentUser) {
      const userRole = currentUser.role || "user"; // Default to user if role is not defined
      navigate(userRole === "admin" ? "/admin" : "/user");
    } else {
      navigate("/login");
    }
  };
  
  // Navigate directly to signup page - updated to use navigate
  const navigateToSignup = () => {
    navigate("/signup");
  };

  // Navigate to login page
  const navigateToLogin = () => {
    navigate("/login");
  };

  // Manual navigation functions (kept for manual control alongside automatic)
  const nextFeature = () => {
    setActiveSection((prev) => (prev + 1) % features.length);
  };

  const prevFeature = () => {
    setActiveSection((prev) => (prev - 1 + features.length) % features.length);
  };

  return (
    <div className="landing-container">
      <header className="landing-header">
        <div className="logo-container">
          <div className="logo">
            <img src={Lugo} alt="JAIBOT Logo" className="logo-image" />
          </div>
          <h1 className="app-title">JAIBOT Quiz</h1>
        </div>
        <div className="nav-buttons">
          {currentUser ? (
            <button
              className="nav-button"
              onClick={() =>
                navigate(currentUser.role === "admin" ? "/admin" : "/user")
              }
            >
              Dashboard
            </button>
          ) : (
            <>
              <button className="nav-button" onClick={navigateToLogin}>
                Login
              </button>
              <button
                className="primary-button"
                onClick={navigateToSignup}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">Smart Learning for the AI Age</h1>
            <p className="hero-subtitle">
              JAIBOT Quiz is an intelligent, adaptive learning platform that
              evolves with you. Using machine learning algorithms, we create a
              personalized learning experience that targets your specific needs.
            </p>
            <button className="cta-button" onClick={handleGetStarted}>
              {currentUser ? "Go to Dashboard" : "Get Started for Free"}
            </button>
          </div>
          <div className="hero-image">
            <div className="abstract-shape shape-1"></div>
            <div className="abstract-shape shape-2"></div>
            <div className="emoji-illustration">🚀</div>
          </div>
        </section>

        <section className="features-section">
          <h2 className="section-title">Why Choose JAIBOT Quiz?</h2>
          <div className="features-carousel">
            <button
              className="carousel-arrow carousel-prev"
              onClick={prevFeature}
            >
              ←
            </button>
            <div className="feature-cards-container">
              <div
                className="feature-cards"
                style={{ transform: `translateX(-${activeSection * 100}%)` }}
              >
                {features.map((feature, index) => (
                  <div key={index} className="feature-card">
                    <div className="feature-icon">{feature.icon}</div>
                    <h3 className="feature-title">{feature.title}</h3>
                    <p className="feature-description">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <button
              className="carousel-arrow carousel-next"
              onClick={nextFeature}
            >
              →
            </button>
          </div>
          <div className="carousel-indicators">
            {features.map((_, index) => (
              <button
                key={index}
                className={`indicator ${
                  activeSection === index ? "active" : ""
                }`}
                onClick={() => setActiveSection(index)}
              />
            ))}
          </div>
        </section>

        <section className="how-it-works-section">
          <h2 className="section-title">How It Works</h2>
          <div className="steps-container">
            {tutorialSteps.map((step, index) => (
              <div key={index} className="step-card">
                <div className="step-number">{index + 1}</div>
                <div className="step-icon">{step.icon}</div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </div>
            ))}
          </div>
        </section>    

        <section className="cta-section">
          <div className="cta-content">
            <h2 className="cta-title">
              Ready to Transform Your Learning Experience?
            </h2>
            <p className="cta-description">
              Join thousands of learners who have improved their knowledge and
              skills with our AI-powered quiz platform.
            </p>
            <button className="cta-button" onClick={currentUser ? handleGetStarted : navigateToSignup}>
              {currentUser ? "Go to Dashboard" : "Start Learning Now"}
            </button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <div className="logo">
            <img src={Lugo} alt="JAIBOT Logo" className="logo-image" />
            </div>
            <h2 className="footer-title">JAIBOT Quiz</h2>
          </div>
          
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 JAIBOT Quiz • All Rights Reserved</p>
          <div className="footer-legal">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}