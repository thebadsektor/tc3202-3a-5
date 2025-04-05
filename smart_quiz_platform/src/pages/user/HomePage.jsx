import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, getDocs, query, orderBy, getDoc, doc } from "firebase/firestore";
import { initializeApp } from "firebase/app";

// Firebase configuration - replace with your own config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function HomePage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [availableQuizzes, setAvailableQuizzes] = useState([]);
  const [recentQuizzes, setRecentQuizzes] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [userStats, setUserStats] = useState({
    quizzesCompleted: 0,
    averageScore: 0,
    topicsStrong: [],
    topicsWeak: []
  });
  const [loading, setLoading] = useState(true);
  const [activeQuiz, setActiveQuiz] = useState(null);

  // Fetch available quizzes and user data on component mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Fetch all available quizzes from Firestore
        const quizzesSnapshot = await getDocs(query(collection(db, "quizzes"), orderBy("createdAt", "desc")));
        const quizzesList = quizzesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Add a default subject icon based on title
          icon: getSubjectIcon(doc.data().title),
          color: getSubjectColor(doc.data().title)
        }));
        setAvailableQuizzes(quizzesList);
        
        // If user is logged in, fetch their quiz history and stats
        if (user && user.uid) {
          // Fetch user's quiz history
          const historySnapshot = await getDocs(
            query(collection(db, "users", user.uid, "quizHistory"), orderBy("completedAt", "desc"))
          );
          
          const history = historySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Get user's recent quizzes with full quiz details
          const recentWithDetails = await Promise.all(
            history.slice(0, 3).map(async (item) => {
              const quizDoc = await getDoc(doc(db, "quizzes", item.quizId));
              if (quizDoc.exists()) {
                return {
                  ...item,
                  quizTitle: quizDoc.data().title,
                  icon: getSubjectIcon(quizDoc.data().title),
                  color: getSubjectColor(quizDoc.data().title)
                };
              }
              return null;
            })
          );
          
          setRecentQuizzes(recentWithDetails.filter(item => item !== null));
          
          // Check if user has an active quiz session
          const activeSessionDoc = await getDoc(doc(db, "users", user.uid, "activeSession", "current"));
          if (activeSessionDoc.exists()) {
            setActiveQuiz(activeSessionDoc.data());
          }
          
          // Calculate user stats from history
          if (history.length > 0) {
            const completed = history.length;
            const avgScore = history.reduce((sum, quiz) => sum + quiz.score, 0) / completed;
            
            // Group performance by topics
            const topicPerformance = {};
            history.forEach(quiz => {
              if (!topicPerformance[quiz.topic]) {
                topicPerformance[quiz.topic] = { total: 0, correct: 0 };
              }
              topicPerformance[quiz.topic].total += quiz.totalQuestions;
              topicPerformance[quiz.topic].correct += quiz.correctAnswers;
            });
            
            // Sort topics by performance
            const sortedTopics = Object.entries(topicPerformance).map(([topic, data]) => ({
              topic,
              performance: data.correct / data.total
            })).sort((a, b) => b.performance - a.performance);
            
            setUserStats({
              quizzesCompleted: completed,
              averageScore: Math.round(avgScore * 100),
              topicsStrong: sortedTopics.slice(0, 3).map(t => t.topic),
              topicsWeak: sortedTopics.slice(-3).map(t => t.topic)
            });
            
            // Generate recommendations based on weak topics and available quizzes
            const recommendedQuizzes = quizzesList.filter(quiz => {
              // Match quiz title with weak topics
              return sortedTopics.slice(-3).some(topic => 
                quiz.title.toLowerCase().includes(topic.topic.toLowerCase())
              );
            });
            
            // If not enough topic-based recommendations, add some random quizzes the user hasn't taken
            const takenQuizIds = new Set(history.map(h => h.quizId));
            const notTakenQuizzes = quizzesList.filter(q => !takenQuizIds.has(q.id));
            
            while (recommendedQuizzes.length < 3 && notTakenQuizzes.length > 0) {
              const randomIndex = Math.floor(Math.random() * notTakenQuizzes.length);
              recommendedQuizzes.push(notTakenQuizzes[randomIndex]);
              notTakenQuizzes.splice(randomIndex, 1);
            }
            
            setRecommendations(recommendedQuizzes.slice(0, 3));
          } else {
            // For new users with no history, recommend any 3 quizzes
            setRecommendations(quizzesList.slice(0, 3));
          }
        } else {
          // For not logged in or new users
          setRecommendations(quizzesList.slice(0, 3));
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    }
    
    fetchData();
  }, [user]);

  // Helper function to get icon based on quiz title
  function getSubjectIcon(title) {
    const titleLower = title.toLowerCase();
    if (titleLower.includes("math")) return "📐";
    if (titleLower.includes("science") || titleLower.includes("physics") || titleLower.includes("chemistry")) return "🔬";
    if (titleLower.includes("history")) return "📜";
    if (titleLower.includes("literature") || titleLower.includes("english")) return "📚";
    if (titleLower.includes("computer") || titleLower.includes("programming")) return "💻";
    if (titleLower.includes("geography")) return "🌍";
    return "📝"; // Default icon
  }

  // Helper function to get color based on quiz title
  function getSubjectColor(title) {
    const titleLower = title.toLowerCase();
    if (titleLower.includes("math")) return "#4285F4";
    if (titleLower.includes("science") || titleLower.includes("physics") || titleLower.includes("chemistry")) return "#34A853";
    if (titleLower.includes("history")) return "#FBBC05";
    if (titleLower.includes("literature") || titleLower.includes("english")) return "#EA4335";
    if (titleLower.includes("computer") || titleLower.includes("programming")) return "#7B61FF";
    if (titleLower.includes("geography")) return "#1DA1F2";
    
    // Generate a random color if no match
    const colors = ["#4285F4", "#34A853", "#FBBC05", "#EA4335", "#7B61FF", "#1DA1F2"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Start a new quiz
  const startQuiz = async (quizId) => {
    try {
      // Fetch the quiz data from Firestore
      const quizDoc = await getDoc(doc(db, "quizzes", quizId));
      
      if (!quizDoc.exists()) {
        console.error("Quiz not found");
        return;
      }
      
      const quizData = quizDoc.data();
      
      // Navigate to the quiz page with the quiz ID
      navigate(`/quiz/${quizId}`, { 
        state: { 
          quizTitle: quizData.title,
          isAdaptive: true
        } 
      });
    } catch (error) {
      console.error("Error starting quiz:", error);
    }
  };

  // Resume an active quiz
  const resumeQuiz = () => {
    if (activeQuiz) {
      navigate(`/quiz/${activeQuiz.quizId}`, { 
        state: { 
          quizTitle: activeQuiz.quizTitle,
          resuming: true,
          isAdaptive: true
        } 
      });
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>JAIBOT Quiz: An AI-Powered Smart Quiz Platform</h1>
        <div style={styles.userNav}>
          <span style={styles.username}>Hi, {user?.displayName || "Learner"}!</span>
          <button 
            style={styles.logoutButton} 
            onClick={() => { logout(); navigate("/login"); }}
          >
            Logout
          </button>
        </div>
      </header>

      <section style={styles.heroSection}>
        <div style={styles.heroContent}>
          <h2 style={styles.heroTitle}>Smart Learning, Smart Progress</h2>
          <p style={styles.heroText}>
            Our intelligent quiz system uses machine learning to adapt to your knowledge level,
            providing personalized learning that evolves with you.
          </p>
          <button 
            style={styles.startButton} 
            onClick={() => document.getElementById("quizzes-section").scrollIntoView({ behavior: "smooth" })}
          >
            Explore Quizzes
          </button>
          {activeQuiz && (
            <button style={styles.resumeButton} onClick={resumeQuiz}>
              Resume Quiz
            </button>
          )}
        </div>
        <div style={styles.heroImagePlaceholder}>
          <div style={styles.placeholderImage}>🚀</div>
        </div>
      </section>

      <section id="quizzes-section" style={styles.section}>
        <h2 style={styles.sectionTitle}>Available Quizzes</h2>
        {loading ? (
          <div style={styles.loadingIndicator}>Loading quizzes...</div>
        ) : availableQuizzes.length > 0 ? (
          <div style={styles.quizzesGrid}>
            {availableQuizzes.map((quiz) => (
              <div 
                key={quiz.id} 
                style={{...styles.quizCard, backgroundColor: quiz.color + "15"}}
                onClick={() => startQuiz(quiz.id)}
              >
                <div style={{...styles.quizIcon, backgroundColor: quiz.color}}>{quiz.icon}</div>
                <h3 style={styles.quizName}>{quiz.title}</h3>
                <p style={styles.quizDescription}>
                  {quiz.totalQuestions} questions • Adaptive difficulty
                </p>
                <div style={styles.quizMeta}>
                  <span style={styles.quizDate}>
                    Added: {new Date(quiz.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button style={styles.startQuizButton}>Start Quiz</button>
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.emptyState}>No quizzes available at the moment.</p>
        )}
      </section>

      {recentQuizzes.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Your Recent Quizzes</h2>
          <div style={styles.recentQuizzes}>
            {recentQuizzes.map((quiz) => (
              <div 
                key={quiz.id}
                style={styles.recentQuizCard}
                onClick={() => startQuiz(quiz.quizId)}
              >
                <div style={{...styles.miniQuizIcon, backgroundColor: quiz.color}}>{quiz.icon}</div>
                <div style={styles.recentQuizInfo}>
                  <h4 style={styles.recentQuizName}>{quiz.quizTitle}</h4>
                  <p style={styles.recentQuizStats}>
                    Score: {quiz.score.toFixed(1)}% • 
                    {new Date(quiz.completedAt).toLocaleDateString()}
                  </p>
                </div>
                <div style={styles.retakeButton}>Retake</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {recommendations.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Recommended For You</h2>
          <div style={styles.recommendationsGrid}>
            {recommendations.map((quiz) => (
              <div 
                key={quiz.id}
                style={styles.recommendationCard}
                onClick={() => startQuiz(quiz.id)}
              >
                <div style={{...styles.miniQuizIcon, backgroundColor: quiz.color}}>{quiz.icon}</div>
                <div style={styles.recommendationInfo}>
                  <h4 style={styles.recommendationName}>{quiz.title}</h4>
                  <p style={styles.recommendationReason}>
                    Based on your performance patterns and learning needs
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Your Learning Journey</h2>
        <div style={styles.statsCards}>
          <div style={styles.statCard}>
            <h3 style={styles.statNumber}>{userStats.quizzesCompleted}</h3>
            <p style={styles.statLabel}>Quizzes Completed</p>
          </div>
          <div style={styles.statCard}>
            <h3 style={styles.statNumber}>{userStats.averageScore}%</h3>
            <p style={styles.statLabel}>Average Score</p>
          </div>
          <div style={styles.statCard}>
            <h3 style={styles.statNumber}>{userStats.topicsStrong.length}</h3>
            <p style={styles.statLabel}>Strong Areas</p>
          </div>
        </div>
        <button 
          style={styles.viewProgressButton} 
          onClick={() => navigate("/learning-profile")}
        >
          View Detailed Stats
        </button>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Our Adaptive Learning Technology</h2>
        <div style={styles.featureCards}>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>🤖</div>
            <h3 style={styles.featureTitle}>KNN Algorithm</h3>
            <p style={styles.featureDescription}>
              We use K-Nearest Neighbors machine learning to predict the optimal difficulty level for each question.
            </p>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>📈</div>
            <h3 style={styles.featureTitle}>Smart Adaptation</h3>
            <p style={styles.featureDescription}>
              Questions adapt based on your performance, difficulty rating, and time taken to answer questions.
            </p>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>🎯</div>
            <h3 style={styles.featureTitle}>Personalized Insights</h3>
            <p style={styles.featureDescription}>
              Receive AI-powered feedback about your strengths and areas for improvement after each quiz.
            </p>
          </div>
        </div>
      </section>

      <footer style={styles.footer}>
        <p>&copy; 2025 QuizSmart • Intelligent Adaptive Learning</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'Poppins', 'Segoe UI', sans-serif",
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "20px",
    backgroundColor: "#f5f7ff",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 0",
    borderBottom: "1px solid #e0e6ff",
    marginBottom: "30px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#3a41e5",
    margin: 0,
  },
  userNav: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
  },
  username: {
    fontSize: "16px",
    fontWeight: "500",
    color: "#444",
  },
  logoutButton: {
    padding: "8px 16px",
    backgroundColor: "#f0f2ff",
    color: "#3a41e5",
    border: "1px solid #d0d6ff",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all 0.2s",
  },
  heroSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "40px",
    marginBottom: "40px",
    backgroundColor: "#fff",
    borderRadius: "16px",
    boxShadow: "0 10px 30px rgba(58, 65, 229, 0.1)",
  },
  heroContent: {
    flex: "1",
    paddingRight: "30px",
  },
  heroTitle: {
    fontSize: "36px",
    fontWeight: "bold",
    color: "#212529",
    marginBottom: "16px",
    background: "linear-gradient(90deg, #3a41e5, #6c63ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  heroText: {
    fontSize: "18px",
    color: "#555",
    marginBottom: "28px",
    lineHeight: "1.6",
  },
  startButton: {
    backgroundColor: "#3a41e5",
    color: "#fff",
    padding: "14px 28px",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "600",
    border: "none",
    cursor: "pointer",
    marginRight: "16px",
    boxShadow: "0 8px 15px rgba(58, 65, 229, 0.3)",
    transition: "all 0.3s",
  },
  resumeButton: {
    backgroundColor: "#fff",
    color: "#3a41e5",
    padding: "14px 28px",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "600",
    border: "1px solid #3a41e5",
    cursor: "pointer",
    transition: "all 0.3s",
  },
  heroImagePlaceholder: {
    flex: "1",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "16px",
    overflow: "hidden",
    backgroundColor: "#f0f2ff",
    minHeight: "300px",
  },
  placeholderImage: {
    fontSize: "100px",
    color: "#3a41e5",
  },
  section: {
    marginBottom: "40px",
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "30px",
    boxShadow: "0 10px 30px rgba(58, 65, 229, 0.1)",
  },
  sectionTitle: {
    fontSize: "26px",
    fontWeight: "bold",
    color: "#222",
    marginBottom: "24px",
    paddingBottom: "10px",
    borderBottom: "2px solid #f0f2ff",
  },
  loadingIndicator: {
    textAlign: "center",
    padding: "20px",
    color: "#6c757d",
    fontSize: "16px",
  },
  quizzesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "25px",
  },
  quizCard: {
    padding: "25px",
    borderRadius: "16px",
    cursor: "pointer",
    transition: "transform 0.2s, box-shadow 0.2s",
    boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
    "&:hover": {
      transform: "translateY(-5px)",
      boxShadow: "0 8px 25px rgba(0,0,0,0.1)",
    }
  },
  quizIcon: {
    width: "70px",
    height: "70px",
    borderRadius: "50%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "20px",
    fontSize: "28px",
    color: "#fff",
    boxShadow: "0 8px 15px rgba(0,0,0,0.1)",
  },
  quizName: {
    fontSize: "22px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "10px",
  },
  quizDescription: {
    fontSize: "15px",
    color: "#666",
    marginBottom: "16px",
  },
  quizMeta: {
    fontSize: "13px",
    color: "#888",
    marginBottom: "20px",
  },
  startQuizButton: {
    padding: "10px 18px",
    backgroundColor: "#3a41e5",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.3s",
  },
  recentQuizzes: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  recentQuizCard: {
    display: "flex",
    alignItems: "center",
    padding: "18px",
    borderRadius: "14px",
    backgroundColor: "#f8f9ff",
    cursor: "pointer",
    transition: "all 0.2s",
    "&:hover": {
      backgroundColor: "#f0f2ff",
    }
  },
  miniQuizIcon: {
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "22px",
    color: "#fff",
    marginRight: "18px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
  },
  recentQuizInfo: {
    flex: "1",
  },
  recentQuizName: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "4px",
  },
  recentQuizStats: {
    fontSize: "14px",
    color: "#777",
  },
  retakeButton: {
    padding: "8px 16px",
    backgroundColor: "#3a41e5",
    color: "#fff",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(58, 65, 229, 0.2)",
  },
  emptyState: {
    textAlign: "center",
    padding: "20px",
    color: "#6c757d",
    fontStyle: "italic",
  },
  recommendationsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "20px",
  },
  recommendationCard: {
    display: "flex",
    alignItems: "center",
    padding: "20px",
    borderRadius: "14px",
    backgroundColor: "#f8f9ff",
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
    "&:hover": {
      backgroundColor: "#f0f2ff",
      boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
    }
  },
  recommendationInfo: {
    flex: "1",
  },
  recommendationName: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "6px",
  },
  recommendationReason: {
    fontSize: "14px",
    color: "#777",
  },
  statsCards: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "25px",
    marginBottom: "30px",
  },
  statCard: {
    padding: "25px",
    textAlign: "center",
    borderRadius: "14px",
    backgroundColor: "#f8f9ff",
    boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
    transition: "transform 0.3s",
    "&:hover": {
      transform: "translateY(-5px)",
    }
  },
  statNumber: {
    fontSize: "36px",
    fontWeight: "bold",
    color: "#3a41e5",
    marginBottom: "10px",
  },
  statLabel: {
    fontSize: "16px",
    color: "#666",
  },
  viewProgressButton: {
    backgroundColor: "#fff",
    color: "#3a41e5",
    border: "2px solid #3a41e5",
    padding: "12px 24px",
    borderRadius: "12px",
    fontWeight: "600",
    cursor: "pointer",
    display: "block",
    margin: "0 auto",
    transition: "all 0.3s",
    "&:hover": {
      backgroundColor: "#f0f2ff",
      transform: "translateY(-3px)",
    }
  },
  featureCards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "25px",
  },
  featureCard: {
    padding: "30px",
    borderRadius: "16px",
    backgroundColor: "#f8f9ff",
    textAlign: "center",
    boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
    transition: "transform 0.3s, box-shadow 0.3s",
    "&:hover": {
      transform: "translateY(-8px)",
      boxShadow: "0 12px 30px rgba(58, 65, 229, 0.1)",
    }
  },
  featureIcon: {
    fontSize: "60px",
    marginBottom: "20px",
  },
  featureTitle: {
    fontSize: "22px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "16px",
  },
  featureDescription: {
    fontSize: "15px",
    color: "#666",
    lineHeight: "1.7",
  },
  footer: {
    textAlign: "center",
    padding: "25px 0",
    borderTop: "1px solid #e0e6ff",
    marginTop: "40px",
    color: "#777",
    fontSize: "15px",
  }
};