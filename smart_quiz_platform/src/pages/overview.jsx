import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function GetStartedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState(0);

  // Features data for the carousel
  const features = [
    {
      title: "Adaptive Learning",
      icon: "🧠",
      description: "Our KNN algorithm adapts quiz difficulty based on your performance, making your learning experience personalized and more effective."
    },
    {
      title: "Performance Analytics",
      icon: "📊",
      description: "Track your progress with detailed statistics and visualizations. Identify your strengths and areas that need improvement."
    },
    {
      title: "Smart Recommendations",
      icon: "🎯",
      description: "Receive quiz recommendations based on your learning patterns and areas where you need the most practice."
    },
    {
      title: "Diverse Quiz Library",
      icon: "📚",
      description: "Access a wide range of subjects from Mathematics and Science to Literature, History, and Computer Science."
    }
  ];

  // Tutorial steps
  const tutorialSteps = [
    {
      title: "Choose a Quiz",
      description: "Browse our extensive collection of quizzes organized by subject or try our recommended quizzes tailored to your learning needs.",
      icon: "🔍"
    },
    {
      title: "Take the Quiz",
      description: "Answer questions at your own pace. The system adapts to your knowledge level, providing appropriate challenges.",
      icon: "✏️"
    },
    {
      title: "Review Your Results",
      description: "Get immediate feedback on your performance with detailed explanations for each question.",
      icon: "📝"
    },
    {
      title: "Track Your Progress",
      description: "Visit your learning profile to see detailed statistics and track your improvement over time.",
      icon: "📈"
    }
  ];

  // Navigate to appropriate page
  const handleGetStarted = () => {
    if (user) {
      navigate('/home');
    } else {
      navigate('/login');
    }
  };

  // Change active feature in carousel
  const nextFeature = () => {
    setActiveSection((prev) => (prev + 1) % features.length);
  };

  const prevFeature = () => {
    setActiveSection((prev) => (prev - 1 + features.length) % features.length);
  };

  return (
    <div className="get-started-container">
      <header className="get-started-header">
        <div className="logo-container">
          <div className="logo">📚</div>
          <h1 className="app-title">JAIBOT Quiz</h1>
        </div>
        <div className="nav-buttons">
          {user ? (
            <button className="nav-button" onClick={() => navigate('/home')}>
              Dashboard
            </button>
          ) : (
            <>
              <button className="nav-button" onClick={() => navigate('/login')}>
                Login
              </button>
              <button className="primary-button" onClick={() => navigate('/signup')}>
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
              JAIBOT Quiz is an intelligent, adaptive learning platform that evolves with you.
              Using machine learning algorithms, we create a personalized learning experience
              that targets your specific needs.
            </p>
            <button className="cta-button" onClick={handleGetStarted}>
              {user ? 'Go to Dashboard' : 'Get Started for Free'}
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
            <button className="carousel-arrow carousel-prev" onClick={prevFeature}>
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
            <button className="carousel-arrow carousel-next" onClick={nextFeature}>
              →
            </button>
          </div>
          <div className="carousel-indicators">
            {features.map((_, index) => (
              <button 
                key={index} 
                className={`indicator ${activeSection === index ? 'active' : ''}`}
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

        <section className="testimonials-section">
          <h2 className="section-title">What Our Users Say</h2>
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="quote-icon">❝</div>
              <p className="testimonial-text">
                The adaptive learning system helped me identify and focus on my weak areas in mathematics. 
                My test scores improved significantly after just a few weeks!
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">👨‍🎓</div>
                <div className="author-details">
                  <p className="author-name">Michael Chen</p>
                  <p className="author-title">College Student</p>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="quote-icon">❝</div>
              <p className="testimonial-text">
                As a teacher, I appreciate how the platform adapts to each student's needs, 
                making it easier to provide personalized support in my classroom.
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">👩‍🏫</div>
                <div className="author-details">
                  <p className="author-name">Sarah Johnson</p>
                  <p className="author-title">High School Teacher</p>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="quote-icon">❝</div>
              <p className="testimonial-text">
                I was preparing for my certification exams and the recommendations 
                feature helped me focus on exactly what I needed to study.
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">👨‍💼</div>
                <div className="author-details">
                  <p className="author-name">David Wilson</p>
                  <p className="author-title">IT Professional</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Transform Your Learning Experience?</h2>
            <p className="cta-description">
              Join thousands of learners who have improved their knowledge and skills with our AI-powered quiz platform.
            </p>
            <button className="cta-button" onClick={handleGetStarted}>
              {user ? 'Go to Dashboard' : 'Start Learning Now'}
            </button>
          </div>
        </section>
      </main>

      <footer className="get-started-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <div className="logo">📚</div>
            <h2 className="footer-title">JAIBOT Quiz</h2>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h3 className="footer-heading">Product</h3>
              <ul>
                <li><a href="#">Features</a></li>
                <li><a href="#">How It Works</a></li>
                <li><a href="#">Pricing</a></li>
                <li><a href="#">FAQ</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h3 className="footer-heading">Company</h3>
              <ul>
                <li><a href="#">About Us</a></li>
                <li><a href="#">Team</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h3 className="footer-heading">Resources</h3>
              <ul>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Help Center</a></li>
                <li><a href="#">Community</a></li>
                <li><a href="#">Tutorials</a></li>
              </ul>
            </div>
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