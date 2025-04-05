import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from 'axios'; // Add axios for ML service calls
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from "firebase/firestore";

export default function Quiz() {
  const { quizId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const db = getFirestore();

  // Quiz configuration
  const quizTitle = location.state?.quizTitle || "Quiz";
  const TIME_PER_QUESTION = 60; // 60 seconds per question
  const MAX_QUESTIONS = 15;

  // State variables
  const [loading, setLoading] = useState(true);
  const [questionsByDifficulty, setQuestionsByDifficulty] = useState({
    easy: [],
    medium: [],
    hard: []
  });
  const [usedQuestionIds, setUsedQuestionIds] = useState({
    easy: [],
    medium: [],
    hard: []
  });
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [nextQuestion, setNextQuestion] = useState(null); // Store the preloaded next question
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [error, setError] = useState(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [loadingNextQuestion, setLoadingNextQuestion] = useState(false); // Loading state for next question
  const [isSubmitting, setIsSubmitting] = useState(false); // New state for submit button loading

  // Difficulty progression
  const [currentDifficulty, setCurrentDifficulty] = useState('medium');
  const [nextDifficulty, setNextDifficulty] = useState(null); // Store the predicted next difficulty

  // ML Service URL (replace with your actual endpoint)
  const ML_SERVICE_URL = 'http://localhost:5000/predict_difficulty';

  // Difficulty numeric mapping
  const difficultyNumericMap = {
    'easy': 1,
    'medium': 2,
    'hard': 3
  };

  // Timer management
  useEffect(() => {
    let timer;
    if (!quizCompleted && timeLeft > 0 && !isAnswerSubmitted) {
      timer = setInterval(() => {
        setTimeLeft(prevTime => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0 && !isAnswerSubmitted) {
      handleTimeUp();
    }
    
    return () => clearInterval(timer);
  }, [timeLeft, quizCompleted, isAnswerSubmitted]);

  // Load quiz data
  useEffect(() => {
    async function fetchQuizData() {
      try {
        setLoading(true);
        
        const quizRef = doc(db, "quizzes", quizId);
        const quizDoc = await getDoc(quizRef);
        
        if (!quizDoc.exists()) {
          setError("Quiz not found");
          setLoading(false);
          return;
        }

        const difficultiesRef = {
          easy: collection(db, "quizzes", quizId, "easy"),
          medium: collection(db, "quizzes", quizId, "medium"),
          hard: collection(db, "quizzes", quizId, "hard")
        };

        const [easySnapshot, mediumSnapshot, hardSnapshot] = await Promise.all([
          getDocs(difficultiesRef.easy),
          getDocs(difficultiesRef.medium),
          getDocs(difficultiesRef.hard)
        ]);

        const loadQuestionsByDifficulty = (snapshot, difficulty) => 
          snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            difficulty
          }));

        // Store questions separately by difficulty
        const questionsMap = {
          easy: loadQuestionsByDifficulty(easySnapshot, 'easy'),
          medium: loadQuestionsByDifficulty(mediumSnapshot, 'medium'),
          hard: loadQuestionsByDifficulty(hardSnapshot, 'hard')
        };

        setQuestionsByDifficulty(questionsMap);
        
        // Set initial question randomly from currentDifficulty
        const initialQuestion = getRandomQuestion(questionsMap, currentDifficulty);
        setCurrentQuestion(initialQuestion);
        
        // Track used question IDs
        if (initialQuestion) {
          setUsedQuestionIds(prev => ({
            ...prev,
            [currentDifficulty]: [...prev[currentDifficulty], initialQuestion.id]
          }));
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading quiz:", error);
        setError("Error loading quiz: " + error.message);
        setLoading(false);
      }
    }

    if (quizId) {
      fetchQuizData();
    }
  }, [quizId]);

  // Function to get a random question by difficulty, avoiding repeats
  const getRandomQuestion = (questionsMap, difficulty) => {
    const questions = questionsMap[difficulty] || [];
    
    if (questions.length === 0) {
      console.warn(`No questions found for difficulty: ${difficulty}. Falling back to medium`);
      return getRandomQuestion(questionsMap, 'medium');
    }
    
    // Filter out already used questions
    const availableQuestions = questions.filter(q => 
      !usedQuestionIds[difficulty].includes(q.id)
    );
    
    // If all questions have been used, reset and use all questions
    const questionPool = availableQuestions.length > 0 ? availableQuestions : questions;
    
    // Get a random question from the pool
    const randomIndex = Math.floor(Math.random() * questionPool.length);
    return questionPool[randomIndex];
  };

  // Adaptive difficulty selection with ML prediction
  const selectNextQuestionDifficulty = useCallback(async (prevCorrect, prevDifficulty, timeTaken) => {
    try {
      // Predict next difficulty using ML service
      const response = await axios.post(ML_SERVICE_URL, {
        current_difficulty: difficultyNumericMap[prevDifficulty],
        was_correct: prevCorrect,
        time_taken: timeTaken
      });

      return response.data.predicted_difficulty;
    } catch (error) {
      console.error('ML Difficulty Prediction Error:', error);
      
      // Fallback to default logic
      if (prevCorrect) {
        switch (prevDifficulty) {
          case 'easy': return 'medium';
          case 'medium': return 'hard';
          default: return 'hard';
        }
      } else {
        switch (prevDifficulty) {
          case 'hard': return 'medium';
          case 'medium': return 'easy';
          default: return 'easy';
        }
      }
    }
  }, []);

  // Handle time up
  const handleTimeUp = () => {
    submitAnswer(true);
  };

  // Handle user selecting an option (just tracks selection, doesn't submit)
  const handleOptionSelect = (option) => {
    if (!isAnswerSubmitted) {
      setSelectedAnswer(option);
    }
  };

  // Function to preload the next question based on predicted difficulty
  const preloadNextQuestion = async (predictedDifficulty) => {
    try {
      setLoadingNextQuestion(true);
      
      // Set the next difficulty
      setNextDifficulty(predictedDifficulty);
      
      // Select a random question from the next difficulty
      const nextQ = getRandomQuestion(questionsByDifficulty, predictedDifficulty);
      
      // Update used questions list for this difficulty
      if (nextQ) {
        setUsedQuestionIds(prev => ({
          ...prev,
          [predictedDifficulty]: [...prev[predictedDifficulty], nextQ.id]
        }));
      }
      
      // Store the next question
      setNextQuestion(nextQ);
      setLoadingNextQuestion(false);
    } catch (error) {
      console.error("Error preloading next question:", error);
      setLoadingNextQuestion(false);
    }
  };

  // Handle answer submission
  const submitAnswer = async (timedOut = false) => {
    if (quizCompleted || isAnswerSubmitted) return;

    setIsAnswerSubmitted(true);
    setIsSubmitting(true); // Show loading on submit button
    
    const isCorrect = !timedOut && selectedAnswer === currentQuestion.correct_answer;

    // Store user's answer
    const answerData = {
      questionId: currentQuestion.id,
      selectedOption: selectedAnswer,
      isCorrect,
      timeTaken: TIME_PER_QUESTION - timeLeft,
      timedOut,
      difficulty: currentDifficulty
    };

    const newUserAnswers = [...userAnswers, answerData];
    setUserAnswers(newUserAnswers);
    
    try {
      // Predict next difficulty using ML service
      const predictedDifficulty = await selectNextQuestionDifficulty(
        isCorrect, 
        currentDifficulty, 
        answerData.timeTaken
      );
      
      // Preload the next question with the predicted difficulty
      await preloadNextQuestion(predictedDifficulty);
      
      // Show feedback with correct answer after loading next question
      setShowFeedback(true);
    } catch (error) {
      console.error("Error during answer submission:", error);
    } finally {
      setIsSubmitting(false); // Hide loading on submit button
    }
  };

  // Move to next question
  const handleNextQuestion = () => {
    // Check if quiz should be completed
    if (currentIndex + 1 >= MAX_QUESTIONS) {
      // We're at the last question, complete the quiz immediately
      completeQuiz([...userAnswers]);
      return;
    }

    // Verify next question is loaded before proceeding
    if (!nextQuestion) {
      console.error("Next question not loaded yet");
      return;
    }

    // Reset state for next question
    setTimeLeft(TIME_PER_QUESTION);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setIsAnswerSubmitted(false);
    
    // Move to next question index
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    
    // Use the preloaded question and difficulty
    setCurrentQuestion(nextQuestion);
    setCurrentDifficulty(nextDifficulty);
    
    // Reset the next question state
    setNextQuestion(null);
    setNextDifficulty(null);
  };

  // Complete quiz
  const completeQuiz = (finalAnswers) => {
    const correctAnswers = finalAnswers.filter(ans => ans.isCorrect);
    const finalScore = (correctAnswers.length / finalAnswers.length) * 100;
    
    setScore(finalScore);
    setQuizCompleted(true);
    setLoading(false); // Ensure loading is false when quiz is completed
  };

  // SVG Text Generator Components
  const TextAsSVG = ({ text, fontSize = 16, fontWeight = "normal", lineHeight = 1.5, width = 700, textAlign = "left" }) => {
    // Function to split text into lines based on available width
    const wrapText = (text, maxWidth, fontSize) => {
      // Roughly estimate characters per line based on font size
      // This is an approximation and would need refinement for production
      const charsPerLine = Math.floor(maxWidth / (fontSize * 0.6));
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      
      words.forEach(word => {
        if ((currentLine + word).length > charsPerLine) {
          lines.push(currentLine);
          currentLine = word + ' ';
        } else {
          currentLine += word + ' ';
        }
      });
      
      if (currentLine) {
        lines.push(currentLine);
      }
      
      return lines;
    };

    const lines = wrapText(text, width, fontSize);
    
    // Calculate x position based on text alignment
    const getXPosition = (textAlign, width) => {
      if (textAlign === 'center') {
        return width / 2;
      } else if (textAlign === 'right') {
        return width - 10;
      }
      return 10; // Default left alignment
    };
    
    // Get text-anchor based on alignment
    const getTextAnchor = (textAlign) => {
      if (textAlign === 'center') return 'middle';
      if (textAlign === 'right') return 'end';
      return 'start'; // Default for left alignment
    };
    
    return (
      <svg 
        width={width} 
        height={lines.length * fontSize * lineHeight} 
        viewBox={`0 0 ${width} ${lines.length * fontSize * lineHeight}`}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        <defs>
          <filter id="noiseFilter" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.005" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1" />
          </filter>
        </defs>
        {lines.map((line, i) => (
          <text
            key={i}
            x={getXPosition(textAlign, width)}
            y={i * fontSize * lineHeight + fontSize}
            fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
            fontSize={fontSize}
            fontWeight={fontWeight}
            fill="#000000"
            filter="url(#noiseFilter)"
            textAnchor={getTextAnchor(textAlign)}
          >
            {line}
          </text>
        ))}
      </svg>
    );
  };

  const OptionAsSVG = ({ option, isSelected, isCorrect, isIncorrect, onClick }) => {
    let backgroundColor = "#f8f9fa";
    let borderColor = "#dee2e6";
    let textColor = "#000000";
    
    if (isSelected) {
      backgroundColor = "#e3f2fd";
      borderColor = "#90caf9";
      textColor = "#0d47a1";
    }
    
    if (isCorrect) {
      backgroundColor = "#d4edda";
      borderColor = "#c3e6cb";
      textColor = "#155724";
    }
    
    if (isIncorrect) {
      backgroundColor = "#f8d7da";
      borderColor = "#f5c6cb";
      textColor = "#721c24";
    }
    
    return (
      <div 
        style={{
          ...styles.optionContainer,
          backgroundColor,
          borderColor,
        }}
        onClick={onClick}
      >
        <svg 
          width="100%" 
          height="50"
          viewBox="0 0 700 50"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          <defs>
            <filter id="noiseFilter2" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="2" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1" />
            </filter>
          </defs>
          <text
            x="15"
            y="30"
            fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
            fontSize="16"
            fontWeight="normal"
            fill={textColor}
            filter="url(#noiseFilter2)"
          >
            {option}
          </text>
        </svg>
      </div>
    );
  };

  // Render quiz completed screen directly if quiz is completed
  if (quizCompleted) {
    return (
      <div style={styles.container}>
        <div style={styles.resultCard}>
          <h1>Quiz Completed</h1>
          <div style={styles.scoreCircle}>
            <span style={styles.scoreText}>{Math.round(score)}%</span>
          </div>
          <div style={styles.statsContainer}>
            <div>Total Questions: {userAnswers.length}</div>
            <div>Correct Answers: {userAnswers.filter(ans => ans.isCorrect).length}</div>
            <div>Incorrect Answers: {userAnswers.filter(ans => !ans.isCorrect).length}</div>
          </div>
          <button 
            style={styles.finishButton} 
            onClick={() => navigate("/user")}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Render loading state only for initial quiz loading
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingIndicator}>
          Loading Quiz...
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate("/user")}>Return Home</button>
        </div>
      </div>
    );
  }

  // Check if current question exists
  if (!currentQuestion) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <h2>Error</h2>
          <p>No questions available for the current difficulty level.</p>
          <button onClick={() => navigate("/user")}>Return Home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.quizHeader}>
      <h1 style={styles.quizTitle}>{quizTitle}</h1>
        <div style={styles.progressIndicator}>
          Question {currentIndex + 1} of {MAX_QUESTIONS}
        </div>
        <div style={styles.timerContainer}>
          <div style={{
            ...styles.timerBar,
            width: `${(timeLeft / TIME_PER_QUESTION) * 100}%`,
            backgroundColor: timeLeft > 10 ? '#4CAF50' : '#F44336'
          }} />
          <span style={styles.timerText}>Time Left: {timeLeft}s</span>
        </div>
      </div>

      <div style={styles.questionCard}>
        <div style={styles.difficultyBadge}>
        <div style={{ fontSize: "20px" }}>
          Difficulty: {currentDifficulty.toUpperCase()}
          </div>
        </div>

        {/* Question text as SVG */}
        <div style={styles.questionText}>
          <TextAsSVG 
            text={currentQuestion.question} 
            fontSize={18} 
            fontWeight="bold" 
            textAlign="justify"
          />
        </div>

        <div style={styles.optionsContainer}>
          {currentQuestion.choices.map((option, index) => {
            const isSelected = selectedAnswer === option && !showFeedback;
            const isCorrect = showFeedback && option === currentQuestion.correct_answer;
            const isIncorrect = showFeedback && selectedAnswer === option && option !== currentQuestion.correct_answer;
            
            return (
              <OptionAsSVG
                key={index}
                option={option}
                isSelected={isSelected}
                isCorrect={isCorrect}
                isIncorrect={isIncorrect}
                onClick={() => !isAnswerSubmitted && handleOptionSelect(option)}
              />
            );
          })}
        </div>

        {!isAnswerSubmitted ? (
          <div style={styles.actionContainer}>
            <button 
              style={{
                ...styles.submitButton,
                opacity: (selectedAnswer && !isSubmitting) ? 1 : 0.6,
                cursor: (selectedAnswer && !isSubmitting) ? 'pointer' : 'not-allowed'
              }}
              onClick={() => selectedAnswer && !isSubmitting && submitAnswer()}
              disabled={!selectedAnswer || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Answer'}
            </button>
          </div>
        ) : (
          <div style={styles.feedbackContainer}>
            {showFeedback ? (
              <>
                {selectedAnswer === currentQuestion.correct_answer ? (
                  <div style={styles.correctFeedback}>Correct! Good job!</div>
                ) : (
                  <div style={styles.incorrectFeedback}>
                    <p>Incorrect.</p>
                    <div style={styles.correctAnswerContainer}>
                      <p>The correct answer is:</p>
                      <div style={styles.correctAnswerText}>
                        <TextAsSVG 
                          text={currentQuestion.correct_answer} 
                          fontSize={16} 
                          fontWeight="bold"
                          width={600}
                          textAlign="center"
                        />
                      </div>
                    </div>
                  </div>
                )}
                <button 
                  style={{
                    ...styles.nextButton,
                    opacity: loadingNextQuestion ? 0.6 : 1,
                    cursor: loadingNextQuestion ? 'not-allowed' : 'pointer'
                  }}
                  onClick={handleNextQuestion}
                  disabled={loadingNextQuestion || !nextQuestion}
                >
                  {loadingNextQuestion ? 'Loading Next Question...' : 'Next Question'}
                </button>
              </>
            ) : (
              <div style={styles.loadingFeedback}>
                Loading result...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    maxWidth: "800px",
    margin: "0 auto",
    padding: "20px",
    backgroundColor: "#f8f9fa",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  quizHeader: {
    marginBottom: "20px",
    textAlign: "center",
  },
  progressIndicator: {
    fontSize: "16px",
    marginBottom: "10px",
    color: "#6c757d",
  },

  timerContainer: {
    height: "10px",
    backgroundColor: "#e9ecef",
    borderRadius: "5px",
    overflow: "hidden",
    position: "relative",
  },
  timerBar: {
    height: "100%",
    transition: "width 0.5s, background-color 0.5s",
  },
  timerText: {
    position: "absolute",
    top: "15px",
    right: "0",
    fontSize: "14px",
    color: "#6c757d",
  },
  questionCard: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    padding: "20px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  optionsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "20px",
  },
  optionContainer: {
    padding: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderRadius: "5px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    position: "relative",
    minHeight: "50px",
    display: "flex",
    alignItems: "center",
  },
  actionContainer: {
    display: "flex",
    justifyContent: "center",
    marginTop: "20px",
  },
  submitButton: {
    backgroundColor: "#3a56e4",
    color: "white",
    padding: "10px 20px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
    minWidth: "180px",
  },
  feedbackContainer: {
    marginTop: "20px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  loadingFeedback: {
    padding: "15px",
    backgroundColor: "#e9ecef",
    borderRadius: "5px",
    color: "#495057",
    fontSize: "16px",
  },
  correctFeedback: {
    backgroundColor: "#d4edda",
    color: "#155724",
    padding: "10px",
    borderRadius: "5px",
    fontSize: "16px",
    fontWeight: "bold",
  },
  incorrectFeedback: {
    backgroundColor: "#f8d7da",
    color: "#721c24",
    padding: "10px",
    borderRadius: "5px",
    fontSize: "16px",
  },
  correctAnswerContainer: {
    marginTop: "10px",
    textAlign: "center",
  },
  correctAnswerText: {
    backgroundColor: "#f8d7da", // Same color as incorrect feedback background
    padding: "10px",
    borderRadius: "5px",
    margin: "10px auto",
    maxWidth: "90%",
    display: "flex",
    justifyContent: "center",
  },
  nextButton: {
    backgroundColor: "#3a56e4",
    color: "white",
    padding: "10px 20px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
    margin: "10px auto",
    width: "180px",
  },
  resultCard: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    padding: "30px",
    textAlign: "center",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  scoreCircle: {
    width: "120px",
    height: "120px",
    borderRadius: "50%",
    backgroundColor: "#3a56e4",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    margin: "0 auto 20px",
  },
  scoreText: {
    color: "white",
    fontSize: "32px",
    fontWeight: "bold",
  },
  statsContainer: {
    display: "flex",
    justifyContent: "space-around",
    marginBottom: "20px",
  },
  finishButton: {
    backgroundColor: "#3a56e4",
    color: "white",
    padding: "10px 20px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "16px",
  },
  difficultyBadge: {
    backgroundColor: "#e9ecef",
    padding: "5px 10px",
    borderRadius: "15px",
    alignSelf: "flex-start",
    marginBottom: "10px",
    fontSize: "12px",
    fontWeight: "bold",
    color: "#495057",
    display: "inline-block",
  },
  questionText: {
    marginBottom: "20px",
    textAlign: "justify",
  },
  loadingIndicator: {
    textAlign: "center",
    fontSize: "18px",
    color: "#6c757d",
  },
  errorContainer: {
    textAlign: "center",
    padding: "20px",
    backgroundColor: "#f8d7da",
    borderRadius: "8px",
  },

  quizTitle: {
    fontSize: "32px", // Adjust size as needed
    fontWeight: "bold",
    textAlign: "center",
  }

};