import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, getDocs, query, orderBy, getDoc, doc } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Firebase configuration
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

export default function QuizHistory() {
  const { currentUser: user } = useAuth();
  const navigate = useNavigate();
  const [quizHistory, setQuizHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedTimeframe, setSelectedTimeframe] = useState("all");
  const [summaryStats, setSummaryStats] = useState({
    totalQuizzes: 0,
    averageScore: 0,
    bestScore: 0,
    bestQuiz: "",
    totalTimeSpent: 0
  });
  const [chartData, setChartData] = useState([]);

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
    if (titleLower.includes("math")) return "#4285F4"; // Blue
    if (titleLower.includes("science") || titleLower.includes("physics") || titleLower.includes("chemistry")) return "#34A853"; // Green
    if (titleLower.includes("history")) return "#FBBC05"; // Yellow
    if (titleLower.includes("literature") || titleLower.includes("english")) return "#7B61FF"; // Purple
    if (titleLower.includes("computer") || titleLower.includes("programming")) return "#34A853"; // Green
    if (titleLower.includes("geography")) return "#4285F4"; // Blue
    
    // Generate a random color from the allowed colors (Yellow, Green, Blue, Purple)
    const colors = ["#FBBC05", "#34A853", "#4285F4", "#7B61FF"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Helper function to format time duration
  function formatTimeDuration(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }

  // Fetch quiz history data when component mounts
  useEffect(() => {
    async function fetchQuizHistory() {
      if (!user) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        
        // Fetch user's quiz history
        const historySnapshot = await getDocs(
          query(collection(db, "users", user.uid, "quizHistory"), orderBy("completedAt", "desc"))
        );
        
        const history = await Promise.all(
          historySnapshot.docs.map(async (historyDoc) => {
            const historyData = { id: historyDoc.id, ...historyDoc.data() };
            
            // Fetch the associated quiz info for each history item
            const quizDoc = await getDoc(doc(db, "quizzes", historyData.quizId));
            
            if (quizDoc.exists()) {
              const quizData = quizDoc.data();
              return {
                ...historyData,
                quizTitle: quizData.title || historyData.quizTitle,
                totalQuestions: quizData.totalQuestions || historyData.totalQuestions || 15, // Default to 15 questions
                icon: getSubjectIcon(quizData.title || historyData.quizTitle),
                color: getSubjectColor(quizData.title || historyData.quizTitle)
              };
            }
            
            // If quiz doesn't exist anymore, still return the history with available info
            return {
              ...historyData,
              quizTitle: historyData.quizTitle || "Unknown Quiz",
              totalQuestions: historyData.totalQuestions || 15, // Default to 15 questions
              icon: getSubjectIcon(historyData.quizTitle || "Unknown Quiz"),
              color: getSubjectColor(historyData.quizTitle || "Unknown Quiz")
            };
          })
        );
        
        setQuizHistory(history);
        
        // Prepare chart data - only using score data, not difficulty
        const chartDataArray = history.slice(0, 10).reverse().map(quiz => {
          return {
            name: quiz.completedAt ? quiz.completedAt.toDate().toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : 'Unknown',
            score: quiz.score || 0
          };
        });
        
        setChartData(chartDataArray);
        
        // Calculate summary statistics
        if (history.length > 0) {
          const totalQuizzes = history.length;
          const totalScore = history.reduce((sum, quiz) => sum + (quiz.score || 0), 0);
          const averageScore = totalQuizzes > 0 ? totalScore / totalQuizzes : 0;
          
          // Find best performance
          const bestQuiz = history.reduce((best, current) => 
            (current.score || 0) > (best.score || 0) ? current : best, history[0]);
          
          // Calculate time statistics if available
          let totalTimeSpent = 0;
          
          history.forEach(quiz => {
            if (quiz.timeSpent) {
              totalTimeSpent += quiz.timeSpent;
            }
          });
          
          setSummaryStats({
            totalQuizzes,
            averageScore: averageScore.toFixed(1),
            bestScore: (bestQuiz.score || 0).toFixed(1),
            bestQuiz: bestQuiz.quizTitle || "Unknown Quiz",
            totalTimeSpent
          });
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching quiz history:", error);
        setLoading(false);
      }
    }
    
    fetchQuizHistory();
  }, [user, navigate]);

  // Navigate back to home page
  const goBackHome = () => {
    navigate('/user');
  };
  
  // Get all unique subjects from quiz history
  const getUniqueSubjects = () => {
    const subjects = new Set();
    
    quizHistory.forEach(quiz => {
      const titleLower = (quiz.quizTitle || "").toLowerCase();
      
      if (titleLower.includes("math")) subjects.add("math");
      else if (titleLower.includes("science") || titleLower.includes("physics") || titleLower.includes("chemistry")) subjects.add("science");
      else if (titleLower.includes("history")) subjects.add("history");
      else if (titleLower.includes("literature") || titleLower.includes("english")) subjects.add("literature");
      else if (titleLower.includes("computer") || titleLower.includes("programming")) subjects.add("computer");
      else if (titleLower.includes("geography")) subjects.add("geography");
      else subjects.add("other");
    });
    
    return Array.from(subjects);
  };

  // Filter quiz history based on selected filter and timeframe
  const getFilteredHistory = () => {
    let filtered = [...quizHistory];
    
    // Apply subject filter
    if (selectedFilter !== "all") {
      filtered = filtered.filter(quiz => 
        (quiz.quizTitle || "").toLowerCase().includes(selectedFilter.toLowerCase())
      );
    }
    
    // Apply timeframe filter
    if (selectedTimeframe !== "all") {
      const now = new Date();
      let cutoffDate = new Date();
      
      switch (selectedTimeframe) {
        case "week":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "month":
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case "year":
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          break;
      }
      
      filtered = filtered.filter(quiz => 
        quiz.completedAt && new Date(quiz.completedAt.toDate()) >= cutoffDate
      );
    }
    
    return filtered;
  };

  const filteredHistory = getFilteredHistory();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={goBackHome}>
          &larr; Back to Home
        </button>
        <h1 style={styles.title}>Your Quiz History</h1>
      </header>

      <section style={styles.statsSection}>
        <h2 style={styles.sectionTitle}>Performance Summary</h2>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>🏆</div>
            <div style={styles.statValue}>{summaryStats.totalQuizzes}</div>
            <div style={styles.statLabel}>Quizzes Completed</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>📊</div>
            <div style={styles.statValue}>{summaryStats.averageScore}%</div>
            <div style={styles.statLabel}>Average Score</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>⭐</div>
            <div style={styles.statValue}>{summaryStats.bestScore}%</div>
            <div style={styles.statLabel}>Best Score</div>
          </div>
          
        </div>
      </section>

      <section style={styles.chartSection}>
        <h2 style={styles.sectionTitle}>Performance Trends</h2>
        <div style={styles.chartContainer}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  tick={{ fontSize: 12 }}
                  height={60}
                />
                <YAxis 
                  domain={[0, 100]} 
                  label={{ value: 'Score (%)', angle: -90, position: 'insideLeft' }} 
                />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#3a41e5" 
                  name="Quiz Score" 
                  strokeWidth={2}
                  dot={{ stroke: '#3a41e5', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={styles.chartPlaceholder}>
              <p>Complete quizzes to see your performance trends over time.</p>
            </div>
          )}
        </div>
      </section>

      <section style={styles.quizListSection}>
        <div style={styles.quizListHeader}>
          <h2 style={styles.sectionTitle}>Your Quizzes</h2>
          <div style={styles.filters}>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Subject:</label>
              <select 
                style={styles.filterSelect}
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
              >
                <option value="all">All Subjects</option>
                {getUniqueSubjects().map(subject => (
                  <option key={subject} value={subject}>
                    {subject.charAt(0).toUpperCase() + subject.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Timeframe:</label>
              <select 
                style={styles.filterSelect}
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="year">Past Year</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={styles.loadingIndicator}>Loading quiz data...</div>
        ) : filteredHistory.length > 0 ? (
          <div style={styles.quizGrid}>
            {filteredHistory.map((quiz) => (
              <div key={quiz.id} style={styles.quizCard}>
                <div style={{...styles.quizIconWrapper, backgroundColor: quiz.color}}>
                  <div style={styles.quizIcon}>{quiz.icon}</div>
                </div>
                <div style={styles.quizContent}>
                  <h3 style={styles.quizTitle}>{quiz.quizTitle || "Unknown Quiz"}</h3>
                  <div style={styles.quizDate}>
                    {quiz.completedAt ? 
                      quiz.completedAt.toDate().toLocaleDateString('en-US', {
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric'
                      }) : 
                      "Date unknown"}
                  </div>
                  <div style={styles.quizStats}>
                    <div style={styles.quizStat}>
                      <span style={styles.quizStatLabel}>Score</span>
                      <span style={styles.quizStatValue}>{(quiz.score || 0).toFixed(1)}%</span>
                    </div>
                   
                   
                  </div>
                  <button 
                    style={styles.retakeButton}
                    onClick={() => navigate(`/quiz/${quiz.quizId}`, {
                      state: {
                        quizTitle: quiz.quizTitle,
                        isAdaptive: true
                      }
                    })}
                  >
                    Retake Quiz
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📝</div>
            <p style={styles.emptyText}>No quiz history found for the selected filters.</p>
            {selectedFilter !== "all" || selectedTimeframe !== "all" ? (
              <button 
                style={styles.resetFiltersButton}
                onClick={() => {
                  setSelectedFilter("all");
                  setSelectedTimeframe("all");
                }}
              >
                Reset Filters
              </button>
            ) : (
              <button 
                style={styles.takeQuizButton}
                onClick={goBackHome}
              >
                Take Your First Quiz
              </button>
            )}
          </div>
        )}
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
    alignItems: "center",
    padding: "20px 0",
    borderBottom: "1px solid #e0e6ff",
    marginBottom: "30px",
  },
  backButton: {
    backgroundColor: "#fff",
    color: "#3a41e5",
    border: "1px solid #d0d6ff",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "15px",
    fontWeight: "500",
    cursor: "pointer",
    marginRight: "20px",
    transition: "all 0.2s",
  },
  title: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#212529",
    margin: 0,
  },
  statsSection: {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "30px",
    marginBottom: "30px",
    boxShadow: "0 10px 30px rgba(58, 65, 229, 0.1)",
  },
  sectionTitle: {
    fontSize: "22px",
    fontWeight: "bold",
    color: "#222",
    marginBottom: "24px",
    paddingBottom: "10px",
    borderBottom: "2px solid #f0f2ff",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "20px",
  },
  statCard: {
    backgroundColor: "#f8f9ff",
    borderRadius: "12px",
    padding: "20px",
    textAlign: "center",
    boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
    transition: "transform 0.3s",
  },
  statIcon: {
    fontSize: "32px",
    marginBottom: "10px",
  },
  statValue: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#3a41e5",
    marginBottom: "8px",
  },
  statLabel: {
    fontSize: "14px",
    color: "#666",
  },
  chartSection: {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "30px",
    marginBottom: "30px",
    boxShadow: "0 10px 30px rgba(58, 65, 229, 0.1)",
  },
  chartContainer: {
    width: "100%",
    height: "300px",
    marginTop: "20px",
  },
  chartPlaceholder: {
    height: "300px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f9ff",
    borderRadius: "12px",
    color: "#777",
    fontSize: "16px",
    textAlign: "center",
    padding: "20px",
  },
  quizListSection: {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "30px",
    marginBottom: "30px",
    boxShadow: "0 10px 30px rgba(58, 65, 229, 0.1)",
  },
  quizListHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "20px",
    marginBottom: "24px",
  },
  filters: {
    display: "flex",
    gap: "15px",
    flexWrap: "wrap",
  },
  filterGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  filterLabel: {
    fontSize: "15px",
    fontWeight: "500",
    color: "#666",
  },
  filterSelect: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #d0d6ff",
    backgroundColor: "#f8f9ff",
    color: "#333",
    fontSize: "14px",
    cursor: "pointer",
  },
  loadingIndicator: {
    textAlign: "center",
    padding: "30px",
    color: "#6c757d",
    fontSize: "16px",
  },
  quizGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "20px",
  },
  quizCard: {
    backgroundColor: "#f8f9ff",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
    transition: "transform 0.3s ease",
  },
  quizIconWrapper: {
    height: "100px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  quizIcon: {
    fontSize: "36px",
    color: "#fff",
  },
  quizContent: {
    padding: "20px",
  },
  quizTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "5px",
  },
  quizDate: {
    fontSize: "14px",
    color: "#777",
    marginBottom: "15px",
  },
  quizStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
    marginBottom: "20px",
  },
  quizStat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "6px",
    borderRadius: "8px",
    backgroundColor: "#f0f2ff",
  },
  quizStatLabel: {
    fontSize: "12px",
    color: "#666",
    marginBottom: "3px",
  },
  quizStatValue: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#3a41e5",
  },
  retakeButton: {
    backgroundColor: "#3a41e5",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 4px 10px rgba(58, 65, 229, 0.2)",
    transition: "all 0.2s",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "60px",
    marginBottom: "20px",
    color: "#d0d6ff",
  },
  emptyText: {
    fontSize: "16px",
    color: "#777",
    marginBottom: "20px",
  },
  resetFiltersButton: {
    backgroundColor: "#f0f2ff",
    color: "#3a41e5",
    border: "1px solid #d0d6ff",
    borderRadius: "10px",
    padding: "10px 20px",
    fontSize: "15px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  takeQuizButton: {
    backgroundColor: "#3a41e5",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "12px 24px",
    fontSize: "15px",
    fontWeight: "500",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(58, 65, 229, 0.2)",
    transition: "all 0.2s",
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