import { useState, useEffect } from "react";

export default function QuizInstructionsModal({ onClose, onReturn }) {
  const [showModal, setShowModal] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);

  // Animation effect when the modal appears
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimateIn(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const handleStartQuiz = () => {
    setAnimateIn(false);
    setTimeout(() => {
      setShowModal(false);
      onClose(); // Only called when starting the quiz
    }, 300);
  };

  const handleReturn = () => {
    setAnimateIn(false);
    setTimeout(() => {
      setShowModal(false);
      if (onReturn) {
        onReturn(); // Call onReturn to navigate back to HomePage
      }
    }, 300);
  };

  if (!showModal) return null;

  return (
    <div style={styles.modalOverlay}>
      {/* Semi-transparent overlay */}
      <div style={styles.overlay}></div>
      
      {/* Dialog box */}
      <div 
        style={{
          ...styles.modalContent,
          transform: animateIn ? 'translateY(0)' : 'translateY(20px)',
          opacity: animateIn ? 1 : 0,
        }}
      >
        {/* Dialog header */}
        <div style={styles.modalHeader}>
          <button
            onClick={handleReturn}
            style={styles.returnButton}
            title="Return to home page"
          >
            <span style={styles.returnIcon}>←</span>
          </button>
          
          <div style={styles.headerTitleContainer}>
            <div style={styles.infoIcon}>ℹ️</div>
            <h2 style={styles.headerTitle}>Quiz Instructions</h2>
          </div>
          
          {/* Empty div for spacing to keep title centered */}
          <div style={{ width: "28px" }}></div>
        </div>
        
        {/* Dialog content */}
        <div style={styles.modalBody}>
          <div style={styles.section}>
            <p style={styles.introText}>
              Welcome to the Adaptive Learning Quiz! Please review these instructions before you begin:
            </p>
            
            <div style={styles.instructionList}>
              <div style={styles.instructionItem}>
                <div style={styles.instructionNumber}>1</div>
                <p style={styles.instructionText}>
                  <span style={styles.instructionHighlight}>Start the Quiz</span> - The system begins with an easy-level question.
                </p>
              </div>
              
              <div style={styles.instructionItem}>
                <div style={styles.instructionNumber}>2</div>
                <p style={styles.instructionText}>
                  <span style={styles.instructionHighlight}>Answer Honestly</span> - Your answers determine the next question's difficulty.
                </p>
              </div>
              
              <div style={styles.instructionItem}>
                <div style={styles.instructionNumber}>3</div>
                <p style={styles.instructionText}>
                  <span style={styles.instructionHighlight}>Timed Questions</span> - Each question has a timer — answer within the time limit. You will have <strong>60 seconds</strong> per question.
                </p>
              </div>
              
              <div style={styles.instructionItem}>
                <div style={styles.instructionNumber}>4</div>
                <p style={styles.instructionText}>
                  <span style={styles.instructionHighlight}>Adaptive Flow</span> - The quiz adapts to your performance level.
                </p>
              </div>
              
              <div style={styles.instructionItem}>
                <div style={styles.instructionNumber}>5</div>
                <p style={styles.instructionText}>
                  <span style={styles.instructionHighlight}>Quiz Completion</span> - You'll receive feedback and performance insights.
                </p>
              </div>
            </div>
          </div>
          
          <div style={styles.infoBox}>
            <h4 style={styles.infoBoxTitle}>How Adaptive Learning Works</h4>
            <p style={styles.infoBoxText}>
              This quiz uses a trained machine learning model to adjust question difficulty based on:
              • The difficulty level of the current question
              • Whether your answer was correct
              • How long you took to answer
            </p>
          </div>
        </div>
        
        {/* Dialog footer */}
        <div style={styles.modalFooter}>
          <button
            onClick={handleStartQuiz}
            style={styles.startButton}
          >
            <span>Start Quiz</span>
            <span style={styles.arrowIcon}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    fontFamily: "'Poppins', 'Segoe UI', sans-serif",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    width: "85%",
    maxWidth: "450px", // Reduced from 600px
    height: "auto",
    maxHeight: "80vh", // Limit height to 80% of viewport height
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
    zIndex: 10,
    overflow: "hidden",
    transition: "transform 0.3s ease, opacity 0.3s ease",
    border: "1px solid #e0e6ff",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    backgroundColor: "#3a41e5",
    color: "#fff",
    padding: "12px 16px", // Reduced padding
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #2a30b5",
    flexShrink: 0, // Prevent header from shrinking
  },
  headerTitleContainer: {
    display: "flex",
    alignItems: "center",
  },
  infoIcon: {
    marginRight: "8px",
    fontSize: "18px", // Slightly reduced
  },
  headerTitle: {
    fontSize: "16px", // Reduced from 18px
    fontWeight: "600",
    margin: 0,
  },
  returnButton: {
    background: "rgba(255, 255, 255, 0.1)",
    border: "none",
    color: "#fff",
    fontSize: "16px", // Reduced
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    height: "28px", // Reduced from 36px
    width: "28px", // Reduced from 36px
    transition: "background-color 0.2s",
  },
  returnIcon: {
    fontSize: "18px", // Reduced from 22px
  },
  modalBody: {
    padding: "16px", // Reduced from 24px
    overflowY: "auto", // Enable vertical scrolling
    flexGrow: 1, // Allow body to expand to fill available space
  },
  section: {
    marginBottom: "16px", // Reduced from 24px
  },
  introText: {
    color: "#333",
    marginBottom: "14px", // Reduced from 20px
    fontSize: "14px", // Reduced from 16px
    lineHeight: "1.4",
  },
  instructionList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px", // Reduced from 16px
  },
  instructionItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px", // Reduced from 14px
  },
  instructionNumber: {
    backgroundColor: "#eef0ff",
    color: "#3a41e5",
    fontWeight: "bold",
    width: "24px", // Reduced from 28px
    height: "24px", // Reduced from 28px
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px", // Reduced from 15px
    flexShrink: 0,
  },
  instructionText: {
    margin: 0,
    fontSize: "14px", // Reduced from 16px
    lineHeight: "1.4",
    color: "#444",
  },
  instructionHighlight: {
    fontWeight: "600",
    color: "#333",
  },
  infoBox: {
    backgroundColor: "#eef0ff",
    padding: "14px", // Reduced from 18px
    borderRadius: "8px",
    borderLeft: "4px solid #3a41e5",
  },
  infoBoxTitle: {
    fontSize: "15px", // Reduced from 17px
    fontWeight: "600",
    color: "#3a41e5",
    marginTop: 0,
    marginBottom: "8px", // Reduced from 10px
  },
  infoBoxText: {
    fontSize: "13px", // Reduced from 15px
    color: "#444",
    margin: 0,
    lineHeight: "1.4",
  },
  modalFooter: {
    borderTop: "1px solid #e0e6ff",
    padding: "12px 16px", // Reduced from 18px 24px
    display: "flex",
    justifyContent: "flex-end",
    backgroundColor: "#f9faff",
    flexShrink: 0, // Prevent footer from shrinking
  },
  startButton: {
    backgroundColor: "#3a41e5",
    color: "#fff",
    border: "none",
    borderRadius: "6px", // Reduced from 8px
    padding: "8px 14px", // Reduced from 12px 20px
    fontSize: "14px", // Reduced from 16px
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    boxShadow: "0 4px 8px rgba(58, 65, 229, 0.2)",
    transition: "all 0.2s",
  },
  arrowIcon: {
    marginLeft: "6px", // Reduced from 8px
    fontSize: "16px", // Reduced from 18px
  }
};