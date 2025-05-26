import React, { useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./AdminHomePage.css";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState("");
  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [activeTab, setActiveTab] = useState("home");
  const [quizTitle, setQuizTitle] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [processingStage, setProcessingStage] = useState("");

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
    fetchSavedQuizzes();
  }, []);

  const fetchSavedQuizzes = async () => {
    try {
      const quizSnapshot = await getDocs(
        query(collection(db, "quizzes"), orderBy("createdAt", "desc"))
      );
      const quizList = quizSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSavedQuizzes(quizList);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
      setError("Failed to load saved quizzes");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      setError("Failed to log out");
    }
  };

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setQuizTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      setError("");
    } else {
      setFile(null);
      setQuizTitle("");
      setError("Please select a valid PDF file.");
    }
  };

  const processAndGenerateQuiz = async () => {
    if (!file) {
      setError("Please select a PDF file first.");
      return;
    }

    setIsLoading(true);
    setProcessingStage("Extracting Text");
    setError("");
    setQuiz(null);

    const fileReader = new FileReader();
    fileReader.onload = async function () {
      try {
        const arrayBuffer = this.result;
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          setProcessingStage(`Extracting Text (Page ${i} of ${pdf.numPages})`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item) => item.str).join(" ");
          fullText += `Page ${i}:\n${pageText}\n\n`;
        }

        setExtractedText(fullText);
        setProcessingStage("Generating Quiz");

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Generate a multiple-choice quiz based on the following content:
                
                ${fullText}

                The quiz must contain:
                - 15 easy questions
                - 15 medium questions
                - 15 hard questions

                Each question should have 4 answer choices and 1 correct answer.

                Return ONLY a valid JSON object with the following structure:

                {
                  "easy": [
                    {
                      "id": 1,
                      "question": "What is 2+2?",
                      "choices": ["1", "2", "3", "4"],
                      "correct_answer": "4"
                    }
                  ],
                  "medium": [
                    {
                      "id": 1,
                      "question": "Solve for x: 2x + 3 = 9",
                      "choices": ["2", "3", "4", "5"],
                      "correct_answer": "3"
                    }
                  ],
                  "hard": [
                    {
                      "id": 1,
                      "question": "What is the derivative of x^3?",
                      "choices": ["3x", "x^2", "3x^2", "x^3/3"],
                      "correct_answer": "3x^2"
                    }
                  ]
                }

                DO NOT include any explanations or extra text outside the JSON object.`,
                  },
                ],
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch quiz from Gemini API.");
        }

        const data = await response.json();
        const responseText = data.candidates[0].content.parts[0].text;
        const cleanedText = responseText.replace(/```(json)?\s*|\s*```/g, "");
        const quizData = JSON.parse(cleanedText);

        setQuiz(quizData);
        setIsLoading(false);
        setProcessingStage("");
      } catch (err) {
        console.error("Processing error:", err);
        setError(`Failed to process PDF: ${err.message}`);
        setIsLoading(false);
        setProcessingStage("");
      }
    };

    fileReader.onerror = () => {
      setError("Failed to read the file.");
      setIsLoading(false);
      setProcessingStage("");
    };

    fileReader.readAsArrayBuffer(file);
  };

  const cancelFileUpload = () => {
    setFile(null);
    setExtractedText("");
    setQuiz(null);
    setQuizTitle("");
    setError("");
  };

  const saveQuiz = async () => {
    if (!quiz) {
      setError("No quiz to save.");
      return;
    }

    if (!quizTitle.trim()) {
      setError("Please enter a quiz title.");
      return;
    }

    setIsLoading(true);
    setSaveSuccess(false);

    try {
      const quizRef = await addDoc(collection(db, "quizzes"), {
        title: quizTitle,
        totalQuestions:
          quiz.easy.length + quiz.medium.length + quiz.hard.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const easyCollectionRef = collection(db, "quizzes", quizRef.id, "easy");
      const mediumCollectionRef = collection(
        db,
        "quizzes",
        quizRef.id,
        "medium"
      );
      const hardCollectionRef = collection(db, "quizzes", quizRef.id, "hard");

      const easyPromises = quiz.easy.map((question) =>
        addDoc(easyCollectionRef, {
          ...question,
          createdAt: new Date().toISOString(),
        })
      );

      const mediumPromises = quiz.medium.map((question) =>
        addDoc(mediumCollectionRef, {
          ...question,
          createdAt: new Date().toISOString(),
        })
      );

      const hardPromises = quiz.hard.map((question) =>
        addDoc(hardCollectionRef, {
          ...question,
          createdAt: new Date().toISOString(),
        })
      );

      await Promise.all([...easyPromises, ...mediumPromises, ...hardPromises]);

      await fetchSavedQuizzes();

      setFile(null);
      setExtractedText("");
      setQuiz(null);
      setQuizTitle("");
      setSaveSuccess(true);
      setError("");
      setIsLoading(false);

      setTimeout(() => {
        setActiveTab("quizzes");
        setSaveSuccess(false);
      }, 2000);
    } catch (error) {
      console.error("Error saving quiz to Firestore:", error);
      setError(`Failed to save quiz: ${error.message}`);
      setIsLoading(false);
    }
  };

  const deleteQuiz = async (id) => {
    if (
      confirm(
        "Are you sure you want to delete this quiz? This will also delete all questions in all difficulty levels."
      )
    ) {
      try {
        setIsLoading(true);

        const easySnapshot = await getDocs(
          collection(db, "quizzes", id, "easy")
        );
        easySnapshot.docs.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });

        const mediumSnapshot = await getDocs(
          collection(db, "quizzes", id, "medium")
        );
        mediumSnapshot.docs.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });

        const hardSnapshot = await getDocs(
          collection(db, "quizzes", id, "hard")
        );
        hardSnapshot.docs.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });

        await deleteDoc(doc(db, "quizzes", id));

        await fetchSavedQuizzes();
        setIsLoading(false);
      } catch (error) {
        console.error("Error deleting quiz:", error);
        setError("Failed to delete quiz");
        setIsLoading(false);
      }
    }
  };

  const viewQuizQuestions = async (id, title) => {
    try {
      setIsLoading(true);

      const easySnapshot = await getDocs(collection(db, "quizzes", id, "easy"));
      const mediumSnapshot = await getDocs(
        collection(db, "quizzes", id, "medium")
      );
      const hardSnapshot = await getDocs(collection(db, "quizzes", id, "hard"));

      const easyQuestions = easySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const mediumQuestions = mediumSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const hardQuestions = hardSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const fetchedQuiz = {
        easy: easyQuestions,
        medium: mediumQuestions,
        hard: hardQuestions,
      };

      setQuiz(fetchedQuiz);
      setQuizTitle(title);
      setIsLoading(false);

      setActiveTab("upload");
    } catch (error) {
      console.error("Error fetching quiz questions:", error);
      setError("Failed to load quiz questions");
      setIsLoading(false);
    }
  };

  // Format date function to handle invalid dates
  const formatDate = (dateString) => {
    try {
      if (!dateString) return "N/A";
      const date = new Date(dateString);
      return date instanceof Date && !isNaN(date) 
        ? date.toLocaleDateString() 
        : "N/A";
    } catch (error) {
      return "N/A";
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="container">
          <h1 className="app-title">Quiz Admin Dashboard</h1>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <main className="container admin-content">
        <div className="admin-panel">
          <nav className="admin-tabs">
            <button
              onClick={() => setActiveTab("home")}
              className={`admin-tab ${activeTab === "home" ? "active" : ""}`}
            >
              Home
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`admin-tab ${activeTab === "upload" ? "active" : ""}`}
            >
              Upload & Generate
            </button>
            <button
              onClick={() => setActiveTab("quizzes")}
              className={`admin-tab ${activeTab === "quizzes" ? "active" : ""}`}
            >
              Published Quizzes
            </button>
          </nav>

          <div className="admin-tab-content">
            {activeTab === "home" && (
              <div className="admin-home">
                <h2 className="section-title">Welcome to Quiz Generator</h2>
                <p className="section-description">
                  Create and manage quizzes by uploading PDF documents. Our
                  AI-powered system will generate multiple-choice questions
                  across different difficulty levels.
                </p>
                <div className="action-buttons">
                  <button
                    onClick={() => setActiveTab("upload")}
                    className="primary-button"
                  >
                    Create New Quiz
                  </button>
                  <button
                    onClick={() => setActiveTab("quizzes")}
                    className="secondary-button"
                  >
                    View Published Quizzes
                  </button>
                </div>
              </div>
            )}

            {activeTab === "upload" && (
              <div className="upload-section">
                {saveSuccess && (
                  <div className="success-message">
                    Quiz saved successfully! Questions have been stored in
                    Firestore with separate collections for each difficulty
                    level.
                  </div>
                )}

                <div className="upload-area">
                  <h2 className="upload-title">Upload PDF Document</h2>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="file-input"
                  />
                  {error && <p className="error-message">{error}</p>}
                  {file && (
                    <div className="file-actions">
                      <button
                        onClick={processAndGenerateQuiz}
                        disabled={isLoading}
                        className={
                          isLoading ? "button-disabled" : "button-generate"
                        }
                      >
                        {isLoading ? "Processing..." : "Generate Quiz"}
                      </button>
                      <button
                        onClick={cancelFileUpload}
                        className="button-cancel"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {isLoading && (
                  <div className="loading-indicator">
                    <div className="loading-spinner"></div>
                    <p className="loading-text">{processingStage}</p>
                  </div>
                )}

                {quiz && !isLoading && (
                  <div className="quiz-preview">
                    {/* Quiz actions at the top */}
                    <div className="quiz-actions">
                      <button onClick={saveQuiz} className="button-save">
                        Save to Firestore
                      </button>
                      <button
                        onClick={processAndGenerateQuiz}
                        className="button-regenerate"
                      >
                        Regenerate Quiz
                      </button>
                      <button
                        onClick={cancelFileUpload}
                        className="button-cancel"
                      >
                        Cancel
                      </button>
                    </div>

                    <h3 className="preview-title">Generated Quiz</h3>

                    <div className="quiz-title-input">
                      <label htmlFor="quiz-title" className="input-label">
                        Quiz Title:
                      </label>
                      <input
                        type="text"
                        id="quiz-title"
                        value={quizTitle}
                        onChange={(e) => setQuizTitle(e.target.value)}
                        className="text-input"
                        placeholder="Enter quiz title"
                      />
                    </div>

                    <div className="quiz-summary">
                      <div className="summary-section">
                        <h4 className="summary-title">Summary:</h4>
                        <p className="total-questions">
                          Total Questions:{" "}
                          {quiz.easy.length +
                            quiz.medium.length +
                            quiz.hard.length}
                        </p>
                        <ul className="question-counts">
                          <li>Easy: {quiz.easy.length} questions</li>
                          <li>Medium: {quiz.medium.length} questions</li>
                          <li>Hard: {quiz.hard.length} questions</li>
                        </ul>
                      </div>

                      <div className="question-preview-sections">
                        <div className="question-section">
                          <h5 className="difficulty-title easy">
                            Easy Questions:
                          </h5>
                          <div className="questions-list">
                            {quiz.easy.map((q, idx) => (
                              <div
                                key={idx}
                                className="question-item easy-question"
                              >
                                <p className="question-text">
                                  {idx + 1}. {q.question}
                                </p>
                                <ul className="answer-choices">
                                  {q.choices.map((choice, choiceIdx) => (
                                    <li
                                      key={choiceIdx}
                                      className={
                                        choice === q.correct_answer
                                          ? "correct-answer"
                                          : "answer-choice"
                                      }
                                    >
                                      {choice === q.correct_answer ? "✓ " : ""}
                                      {choice}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="question-section">
                          <h5 className="difficulty-title medium">
                            Medium Questions:
                          </h5>
                          <div className="questions-list">
                            {quiz.medium.map((q, idx) => (
                              <div
                                key={idx}
                                className="question-item medium-question"
                              >
                                <p className="question-text">
                                  {idx + 1}. {q.question}
                                </p>
                                <ul className="answer-choices">
                                  {q.choices.map((choice, choiceIdx) => (
                                    <li
                                      key={choiceIdx}
                                      className={
                                        choice === q.correct_answer
                                          ? "correct-answer"
                                          : "answer-choice"
                                      }
                                    >
                                      {choice === q.correct_answer ? "✓ " : ""}
                                      {choice}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="question-section">
                          <h5 className="difficulty-title hard">
                            Hard Questions:
                          </h5>
                          <div className="questions-list">
                            {quiz.hard.map((q, idx) => (
                              <div
                                key={idx}
                                className="question-item hard-question"
                              >
                                <p className="question-text">
                                  {idx + 1}. {q.question}
                                </p>
                                <ul className="answer-choices">
                                  {q.choices.map((choice, choiceIdx) => (
                                    <li
                                      key={choiceIdx}
                                      className={
                                        choice === q.correct_answer
                                          ? "correct-answer"
                                          : "answer-choice"
                                      }
                                    >
                                      {choice === q.correct_answer ? "✓ " : ""}
                                      {choice}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quiz actions at the bottom */}
                    <div className="quiz-actions">
                      <button onClick={saveQuiz} className="button-save">
                        Save to Firestore
                      </button>
                      <button
                        onClick={processAndGenerateQuiz}
                        className="button-regenerate"
                      >
                        Regenerate Quiz
                      </button>
                      <button
                        onClick={cancelFileUpload}
                        className="button-cancel"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "quizzes" && (
              <div className="quizzes-section">
                <h2 className="section-title">Published Quizzes</h2>

                {savedQuizzes.length === 0 ? (
                  <div className="empty-state">
                    <p>No quizzes available. Create one from the Upload tab.</p>
                  </div>
                ) : (
                  <div className="quizzes-table-container">
                    <table className="quizzes-table">
                      <thead>
                        <tr>
                          <th className="table-header">Title</th>
                          <th className="table-header">Questions</th>
                          <th className="table-header">Created</th>
                          <th className="table-header actions-column">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedQuizzes.map((quiz) => (
                          <tr key={quiz.id} className="table-row">
                            <td className="table-cell">
                              <div className="quiz-title-cell">
                                {quiz.title}
                              </div>
                            </td>
                            <td className="table-cell">
                              <div className="quiz-count-cell">
                                {quiz.totalQuestions}
                              </div>
                            </td>
                            <td className="table-cell">
                              <div className="quiz-date-cell">
                                {formatDate(quiz.createdAt)}
                              </div>
                            </td>
                            <td className="table-cell actions-cell">
                              <button
                                className="action-button view"
                                onClick={() =>
                                  viewQuizQuestions(quiz.id, quiz.title)
                                }
                              >
                                View
                              </button>
                              <button
                                className="action-button delete"
                                onClick={() => deleteQuiz(quiz.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}