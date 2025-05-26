import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from 'axios';
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc,
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
  const [savingResults, setSavingResults] = useState(false); // Added state for saving results

  // Difficulty progression
  const [currentDifficulty, setCurrentDifficulty] = useState('medium');
  const [nextDifficulty, setNextDifficulty] = useState(null); // Store the predicted next difficulty

  // ML Service URL (replace with your actual endpoint)
  const ML_SERVICE_URL = 'http://localhost:5000/predict_difficulty';

  const [showModelViz, setShowModelViz] = useState(false);
  const [predictionData, setPredictionData] = useState(null);

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
  
      // Store the prediction data for visualization
      setPredictionData({
        current: prevDifficulty,
        prediction: response.data.predicted_difficulty,
        wasCorrect: prevCorrect,
        timeTaken: timeTaken
      });
      
      setShowModelViz(true);
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

  // Add this component inside the Quiz component
// KNN Visualization Component with improved design
const KNNVisualization = ({ predictionData }) => {
  if (!predictionData) return null;
  
  const difficultyColors = {
    easy: "#4CAF50",
    medium: "#FFC107",
    hard: "#F44336"
  };
  
  const difficultyLabels = {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard"
  };
  
  const { current, prediction, wasCorrect, timeTaken } = predictionData;
  
  return (
    <div style={styles.knnContainer}>
      <h3 style={styles.knnTitle}>Adaptive Learning Model</h3>
      
      <div style={styles.knnStats}>
        <div style={styles.knnStatItem}>
          <span style={styles.knnStatLabel}>Current Question:</span>
          <span style={{
            ...styles.knnStatValue,
            color: difficultyColors[current]
          }}>{difficultyLabels[current]}</span>
          <span style={{
            ...styles.knnStatBadge,
            backgroundColor: wasCorrect ? difficultyColors.easy : difficultyColors.hard
          }}>
            {wasCorrect ? "Correct" : "Incorrect"}
          </span>
        </div>
        
        <div style={styles.knnStatItem}>
          <span style={styles.knnStatLabel}>Time Taken:</span>
          <span style={styles.knnStatValue}>{timeTaken} seconds</span>
        </div>
        
        <div style={styles.knnStatItem}>
          <span style={styles.knnStatLabel}>Next Question:</span>
          <span style={{
            ...styles.knnStatValue,
            color: difficultyColors[prediction],
            fontWeight: "600"
          }}>{difficultyLabels[prediction]}</span>
        </div>
      </div>
      
      <div style={styles.knnVisual}>
        <svg width="100%" height="220" viewBox="0 0 400 220">
          {/* Background with grid lines */}
          <rect x="50" y="30" width="300" height="120" fill="#f9f9f9" stroke="#eaeaea" />
          
          {/* Grid lines */}
          <line x1="50" y1="70" x2="350" y2="70" stroke="#eaeaea" strokeWidth="1" />
          <line x1="50" y1="110" x2="350" y2="110" stroke="#eaeaea" strokeWidth="1" />
          <line x1="150" y1="30" x2="150" y2="150" stroke="#eaeaea" strokeWidth="1" />
          <line x1="250" y1="30" x2="250" y2="150" stroke="#eaeaea" strokeWidth="1" />
          
          {/* Y-axis (difficulty) */}
          <line x1="50" y1="30" x2="50" y2="150" stroke="#555" strokeWidth="1.5" />
          <text x="25" y="40" fontSize="12" fontWeight="500" textAnchor="middle" fill="#555">Hard</text>
          <text x="25" y="90" fontSize="12" fontWeight="500" textAnchor="middle" fill="#555">Med</text>
          <text x="25" y="140" fontSize="12" fontWeight="500" textAnchor="middle" fill="#555">Easy</text>
          
          {/* X-axis (time) */}
          <line x1="50" y1="150" x2="350" y2="150" stroke="#555" strokeWidth="1.5" />
          <text x="50" y="170" fontSize="11" textAnchor="middle" fill="#555">0s</text>
          <text x="150" y="170" fontSize="11" textAnchor="middle" fill="#555">20s</text>
          <text x="250" y="170" fontSize="11" textAnchor="middle" fill="#555">40s</text>
          <text x="350" y="170" fontSize="11" textAnchor="middle" fill="#555">60s</text>
          <text x="200" y="190" fontSize="12" fontWeight="500" textAnchor="middle" fill="#555">Response Time</text>
          
          {/* KNN neighbor points - more strategic placement */}
          {/* Easy points cluster */}
          <circle cx={90} cy={135} r="4" fill="#90CAF9" opacity="0.6" />
          <circle cx={110} cy={138} r="4" fill="#90CAF9" opacity="0.6" />
          <circle cx={130} cy={130} r="4" fill="#90CAF9" opacity="0.6" />
          
          {/* Medium points cluster */}
          <circle cx={180} cy={85} r="4" fill="#90CAF9" opacity="0.6" />
          <circle cx={200} cy={95} r="4" fill="#90CAF9" opacity="0.6" />
          <circle cx={220} cy={82} r="4" fill="#90CAF9" opacity="0.6" />
          
          {/* Hard points cluster */}
          <circle cx={260} cy={45} r="4" fill="#90CAF9" opacity="0.6" />
          <circle cx={280} cy={38} r="4" fill="#90CAF9" opacity="0.6" />
          <circle cx={300} cy={50} r="4" fill="#90CAF9" opacity="0.6" />
          
          {/* Decision boundary visualization - more elegant curve */}
          <path 
            d={`M50,${prediction === 'hard' ? 60 : prediction === 'medium' ? 100 : 130} 
                 C120,${prediction === 'hard' ? 40 : prediction === 'medium' ? 80 : 120} 
                 280,${prediction === 'hard' ? 40 : prediction === 'medium' ? 80 : 120}
                 350,${prediction === 'hard' ? 60 : prediction === 'medium' ? 100 : 130}`} 
            stroke={difficultyColors[prediction]} 
            strokeWidth="2" 
            fill="none" 
            strokeDasharray="3,3"
          />
          
          {/* Current data point (user answer) */}
          <circle 
            cx={50 + (timeTaken/60) * 300} 
            cy={current === 'easy' ? 140 : current === 'medium' ? 90 : 40}
            r="8" 
            fill={wasCorrect ? difficultyColors.easy : difficultyColors.hard}
            stroke="#fff"
            strokeWidth="2" 
          />
          
          {/* Target prediction point with pulse animation */}
          <circle 
            cx={200} 
            cy={prediction === 'easy' ? 140 : prediction === 'medium' ? 90 : 40}
            r="10" 
            fill={difficultyColors[prediction]} 
            stroke="#fff"
            strokeWidth="2"
            opacity="0.8"
          >
            <animate 
              attributeName="r" 
              values="8;12;8" 
              dur="2s" 
              repeatCount="indefinite" 
            />
          </circle>
          
          {/* Label for current point */}
          <text 
            x={50 + (timeTaken/60) * 300} 
            y={current === 'easy' ? 155 : current === 'medium' ? 75 : 25}
            fontSize="11" 
            textAnchor="middle"
            fontWeight="500"
            fill="#333"
          >
            Current
          </text>
          
          {/* Label for prediction point */}
          <text 
            x={200} 
            y={prediction === 'easy' ? 155 : prediction === 'medium' ? 75 : 25}
            fontSize="11" 
            textAnchor="middle"
            fontWeight="500"
            fill="#333"
          >
            Next
          </text>
          
          {/* Legend */}
          <rect x="260" y="30" width="85" height="60" fill="white" stroke="#eaeaea" strokeWidth="1" rx="3" />
          <circle cx="270" y="45" r="4" fill={difficultyColors.easy} />
          <text x="280" y="48" fontSize="10" fill="#333">Correct</text>
          <circle cx="270" y="60" r="4" fill={difficultyColors.hard} />
          <text x="280" y="63" fontSize="10" fill="#333">Incorrect</text>
          <circle cx="270" y="75" r="4" fill="#90CAF9" />
          <text x="280" y="78" fontSize="10" fill="#333">KNN Points</text>
        </svg>
      </div>
      
      <div style={styles.knnExplanation}>
        <p style={styles.knnExplanationText}>
          <span style={styles.knnHighlight}>How it works:</span> The system analyzes your performance and response time 
          to adjust question difficulty for optimal learning.
        </p>
      </div>
    </div>
  );
};

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
    setShowModelViz(false); // Reset KNN visualization
    
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

  // Save quiz results to Firestore with retry mechanism and additional analytics
// Enhanced saveQuizResults function with better error handling and logging
const saveQuizResults = async (finalAnswers, finalScore) => {
  try {
    setSavingResults(true);
    setError(null); // Clear any previous errors
    
    console.log("Starting to save quiz results to Firestore...");
    
    // Enhanced authentication check
    if (!user) {
      console.error("No user found in AuthContext");
      
      // Check if we can get the user from Firebase Auth directly
      const currentUser = getAuth().currentUser;
      
      if (!currentUser) {
        console.error("No authenticated user found in Firebase Auth either");
        setError("Authentication error: Please login again before submitting quiz results");
        return { success: false, error: "No authenticated user found" };
      }
      
      console.log("Retrieved user from Firebase Auth:", currentUser.uid);
      // Use the current user from Firebase Auth instead
      var userId = currentUser.uid;
      var userEmail = currentUser.email;
      var userName = currentUser.displayName || currentUser.email;
    } else {
      // Use user from context if available
      var userId = user.uid;
      var userEmail = user.email;
      var userName = user.displayName || user.email;
    }
    
    console.log("User ID:", userId);
    console.log("Quiz ID:", quizId);

    // Calculate basic statistics
    const totalQuestions = finalAnswers.length;
    const correctAnswers = finalAnswers.filter(ans => ans.isCorrect).length;
    const incorrectAnswers = totalQuestions - correctAnswers;
    
    // Calculate difficulty distribution
    const difficultyDistribution = {
      easy: finalAnswers.filter(ans => ans.difficulty === 'easy').length,
      medium: finalAnswers.filter(ans => ans.difficulty === 'medium').length,
      hard: finalAnswers.filter(ans => ans.difficulty === 'hard').length
    };

    // Calculate average time per question
    const totalTime = finalAnswers.reduce((sum, ans) => sum + ans.timeTaken, 0);
    const avgTime = totalTime / totalQuestions;

    // Calculate performance by difficulty level
    const performanceByDifficulty = {
      easy: {
        total: difficultyDistribution.easy,
        correct: finalAnswers.filter(ans => ans.difficulty === 'easy' && ans.isCorrect).length,
        avgTime: finalAnswers.filter(ans => ans.difficulty === 'easy').reduce((sum, ans) => sum + ans.timeTaken, 0) / 
                (difficultyDistribution.easy || 1) // Avoid division by zero
      },
      medium: {
        total: difficultyDistribution.medium,
        correct: finalAnswers.filter(ans => ans.difficulty === 'medium' && ans.isCorrect).length,
        avgTime: finalAnswers.filter(ans => ans.difficulty === 'medium').reduce((sum, ans) => sum + ans.timeTaken, 0) / 
                (difficultyDistribution.medium || 1)
      },
      hard: {
        total: difficultyDistribution.hard,
        correct: finalAnswers.filter(ans => ans.difficulty === 'hard' && ans.isCorrect).length,
        avgTime: finalAnswers.filter(ans => ans.difficulty === 'hard').reduce((sum, ans) => sum + ans.timeTaken, 0) / 
                (difficultyDistribution.hard || 1)
      }
    };

    // Track adaptive learning patterns
    const difficultyTransitions = [];
    for (let i = 1; i < finalAnswers.length; i++) {
      difficultyTransitions.push({
        from: finalAnswers[i-1].difficulty,
        to: finalAnswers[i].difficulty,
        afterCorrect: finalAnswers[i-1].isCorrect
      });
    }

    // Create enhanced results document
    const resultsData = {
      // User information
      userId,
      userName,
      userEmail,
      
      // Quiz information
      quizId,
      quizTitle,
      
      // Score information
      score: finalScore,
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      
      // Detailed analytics
      difficultyDistribution,
      performanceByDifficulty,
      difficultyTransitions,
      averageTimePerQuestion: avgTime,
      timeDistribution: {
        under10s: finalAnswers.filter(ans => ans.timeTaken < 10).length,
        under30s: finalAnswers.filter(ans => ans.timeTaken >= 10 && ans.timeTaken < 30).length,
        under60s: finalAnswers.filter(ans => ans.timeTaken >= 30 && ans.timeTaken < 60).length,
        timeout: finalAnswers.filter(ans => ans.timedOut).length
      },
      
      // Raw answer data
      answersDetail: finalAnswers,
      
      // Metadata
      completedAt: serverTimestamp(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }
    };

    console.log("Results data prepared:", JSON.stringify(resultsData, null, 2));

    // Implement retry logic for Firestore save
    const MAX_RETRIES = 3;
    let attempt = 0;
    let saveSuccessful = false;
    let lastError = null;

    while (attempt < MAX_RETRIES && !saveSuccessful) {
      try {
        attempt++;
        console.log(`Attempt ${attempt} to save quiz results to Firestore...`);
        
        // Get a reference to the Firestore database
        if (!db) {
          console.error("Firestore database reference is undefined, initializing again");
          const newDb = getFirestore();
          if (!newDb) {
            throw new Error("Failed to initialize Firestore database");
          }
          db = newDb; // Update the reference
        }
        
        // Save to Firestore main results collection
        const resultsRef = collection(db, "quizResults");
        console.log("Collection reference created:", resultsRef);
        
        // Add the document to Firestore
        console.log("Calling addDoc...");
        const docRef = await addDoc(resultsRef, resultsData);
        console.log("Document added with ID:", docRef.id);
        
        // Store the reference ID for potential future updates
        const resultId = docRef.id;
        
        // Update user profile with quiz history (in user subcollection)
        console.log("Creating user quiz history entry...");
        const userQuizHistoryRef = collection(db, "users", userId, "quizHistory");
        await addDoc(userQuizHistoryRef, {
          resultId, // Reference to the full results
          quizId,
          quizTitle,
          score: finalScore,
          difficultyDistribution,
          completedAt: serverTimestamp()
        });
        console.log("User quiz history entry added.");

        // Also update the quiz's aggregate statistics (optional)
        try {
          console.log("Updating quiz statistics...");
          const quizStatsRef = doc(db, "quizStatistics", quizId);
          const quizStatsDoc = await getDoc(quizStatsRef);
          
          if (quizStatsDoc.exists()) {
            // Update existing stats
            console.log("Updating existing quiz statistics...");
            const statsData = quizStatsDoc.data();
            const totalAttempts = (statsData.totalAttempts || 0) + 1;
            const totalScore = (statsData.totalScore || 0) + finalScore;
            
            await updateDoc(quizStatsRef, {
              totalAttempts,
              averageScore: totalScore / totalAttempts,
              lastAttemptAt: serverTimestamp()
            });
            console.log("Quiz statistics updated.");
          } else {
            // Create new stats document
            console.log("Creating new quiz statistics document...");
            await setDoc(quizStatsRef, {
              quizId,
              quizTitle,
              totalAttempts: 1,
              averageScore: finalScore,
              createdAt: serverTimestamp(),
              lastAttemptAt: serverTimestamp()
            });
            console.log("New quiz statistics created.");
          }
        } catch (statsError) {
          console.warn("Error updating quiz statistics:", statsError);
          // Non-critical, continue execution
        }
        
        saveSuccessful = true;
        console.log("Quiz results successfully saved to Firestore!");
      } catch (saveError) {
        console.error(`Save attempt ${attempt} failed:`, saveError);
        lastError = saveError;
        
        // If there's a Firebase-specific error code, log it
        if (saveError.code) {
          console.error(`Firebase error code: ${saveError.code}`);
        }
        
        // Check for permissions error and provide helpful message
        if (saveError.code === 'permission-denied') {
          setError("Permission denied: Your account doesn't have permission to save quiz results");
          return { success: false, error: "Permission denied" };
        }
        
        // Exponential backoff before retry (300ms, 900ms, 2700ms)
        if (attempt < MAX_RETRIES) {
          const backoffTime = Math.pow(3, attempt - 1) * 300;
          console.log(`Retrying in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }

    if (!saveSuccessful) {
      throw new Error(`Failed to save after ${MAX_RETRIES} attempts: ${lastError.message}`);
    }

    console.log("Quiz results save process completed successfully");
    return { success: true };
  } catch (error) {
    console.error("Error saving quiz results:", error);
    // Log detailed error information
    if (error.code) {
      console.error("Firebase error code:", error.code);
    }
    if (error.message) {
      console.error("Error message:", error.message);
    }
    
    setError(`Failed to save results: ${error.message}. Please try again or contact support.`);
    return { success: false, error: error.message };
  } finally {
    setSavingResults(false);
  }
};

  // Complete quiz
  const completeQuiz = async (finalAnswers) => {
    try {
      const correctAnswers = finalAnswers.filter(ans => ans.isCorrect);
      const finalScore = (correctAnswers.length / finalAnswers.length) * 100;
      
      setScore(finalScore);
      console.log("Quiz completed with score:", finalScore);
      
      // Save results to Firestore
      console.log("Attempting to save quiz results to Firestore...");
      const saveResult = await saveQuizResults(finalAnswers, finalScore);
      
      if (saveResult.success) {
        console.log("Quiz results saved successfully to Firestore");
      } else {
        console.error("Failed to save quiz results:", saveResult.error);
        setError(`Failed to save results: ${saveResult.error || "Unknown error"}. Your score was calculated, but results may not be saved.`);
      }
    } catch (error) {
      console.error("Error in completeQuiz function:", error);
      setError("An unexpected error occurred. Your score was calculated, but results may not be saved.");
    } finally {
      setQuizCompleted(true);
      setLoading(false); // Ensure loading is false when quiz is completed
    }
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
    
    // Create a ref to the option text for measuring
    const textRef = useRef(null);
    // State to track the text height
    const [textHeight, setTextHeight] = useState(50);
    
    // Calculate text wrap and height
    const calculateTextHeight = useCallback(() => {
      // Estimate roughly 16px per line and ~50 chars per line at 700px width
      const charsPerLine = 50;
      const lines = Math.ceil(option.length / charsPerLine);
      const estimatedHeight = Math.max(50, lines * 20); // Minimum 50px, 20px per line
      setTextHeight(estimatedHeight);
    }, [option]);
    
    // Calculate height on mount and when option changes
    useEffect(() => {
      calculateTextHeight();
    }, [option, calculateTextHeight]);
    
    // Function to wrap text for SVG
    const wrapText = (text, maxWidth = 670) => {
      // Estimate about 10 pixels per character for our font
      const charsPerLine = Math.floor(maxWidth / 10);
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
    
    // Get wrapped lines
    const lines = wrapText(option);
    
    // Calculate the actual height needed for SVG
    const svgHeight = Math.max(50, lines.length * 20); // 20px for each line
    
    return (
      <div 
        style={{
          ...styles.optionContainer,
          backgroundColor,
          borderColor,
          minHeight: svgHeight + 20, // Add 20px padding (10px top + 10px bottom)
        }}
        onClick={onClick}
      >
        <svg 
          width="100%" 
          height={svgHeight}
          viewBox={`0 0 700 ${svgHeight}`}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
          ref={textRef}
        >
          <defs>
            <filter id="noiseFilter2" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="2" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1" />
            </filter>
          </defs>
          {lines.map((line, i) => (
            <text
              key={i}
              x="15"
              y={20 + i * 20} // 20px line height
              fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
              fontSize="16"
              fontWeight="normal"
              fill={textColor}
              filter="url(#noiseFilter2)"
            >
              {line}
            </text>
          ))}
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
          <div style={styles.saveStatus}>
            {error ? (
              <p style={styles.saveError}>{error}</p>
            ) : (
              <p style={styles.saveSuccess}>Results saved successfully!</p>
            )}
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
        Difficulty: {' '}
        <span style={{ 
          color: currentDifficulty === 'easy' ? '#4CAF50' : 
                currentDifficulty === 'medium' ? '#FFC107' : 
                '#F44336'
        }}>
          {currentDifficulty.toUpperCase()}
        </span>
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
          
          {/* Add KNN Visualization here */}
          {showModelViz && predictionData && (
            <KNNVisualization predictionData={predictionData} />
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
    minHeight: "50px", // This is now a minimum height, actual height will adjust based on content
    display: "flex",
    alignItems: "center",
    overflow: "hidden", // Prevent overflow of SVG content
    width: "100%",     // Ensure full width
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
  saveStatus: {
    margin: "10px 0",
    padding: "10px",
    borderRadius: "5px",
  },
  saveSuccess: {
    color: "#155724",
    backgroundColor: "#d4edda",
    padding: "10px",
    borderRadius: "5px",
  },
  saveError: {
    color: "#721c24",
    backgroundColor: "#f8d7da",
    padding: "10px",
    borderRadius: "5px",
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
  },
  knnContainer: {
    marginTop: "20px",
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
    overflow: "hidden",
  },
  knnTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
    marginTop: 0,
    marginBottom: "16px",
    textAlign: "center",
  },
  knnStats: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "15px",
    padding: "10px 15px",
    borderRadius: "8px",
    backgroundColor: "#f9f9f9",
  },
  knnStatItem: {
    display: "flex",
    alignItems: "center",
    marginRight: "10px",
    marginBottom: "5px",
  },
  knnStatLabel: {
    fontSize: "13px",
    color: "#555",
    marginRight: "6px",
  },
  knnStatValue: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#333",
  },
  knnStatBadge: {
    fontSize: "11px",
    fontWeight: "500",
    color: "white",
    padding: "2px 8px",
    borderRadius: "12px",
    marginLeft: "8px",
  },
  knnVisual: {
    borderRadius: "8px",
    padding: "5px",
    marginBottom: "15px",
    backgroundColor: "white",
    border: "1px solid #eaeaea",
  },
  knnExplanation: {
    fontSize: "13px",
    color: "#666",
    backgroundColor: "#f5f7fa",
    borderRadius: "6px",
    padding: "10px 15px",
  },
  knnExplanationText: {
    margin: "0",
    lineHeight: "1.5",
  },
  knnHighlight: {
    fontWeight: "600",
    color: "#1976D2",
  },  

};