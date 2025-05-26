import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AuthPage from "./pages/auth/LoginPage"; // Using the combined auth page
import Homepage from "./pages/user/HomePage";
import AdminHomePage from "./pages/admin/AdminHomePage";
import Quiz from "./pages/user/Quiz";
import QuizHistory from "./pages/user/QuizHistory"; // Import the QuizHistory component
import { useAuth } from "./context/AuthContext";
import ForgotPassword from "./pages/auth/Resetpass";
import Overview from "./pages/overview";

// Protected route component
function ProtectedRoute({ children, requiredRole }) {
  const { currentUser, role } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/" />;
  }
  
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Landing Page */}
      <Route path="/" element={<Overview />} />
      
      {/* Authentication Routes - Updated to use initialMode prop */}
      <Route path="/login" element={<AuthPage initialMode="login" />} />
      <Route path="/signup" element={<AuthPage initialMode="signup" />} />
      <Route path="/reset-pass" element={<ForgotPassword />} />
      
      {/* User Homepage */}
      <Route
        path="/user"
        element={
          <ProtectedRoute requiredRole="user">
            <Homepage />
          </ProtectedRoute>
        }
      />
      
      {/* Admin Homepage */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminHomePage />
          </ProtectedRoute>
        }
      />
      
      {/* Quiz Route for Users */}
      <Route
        path="/quiz/:quizId"
        element={
          <ProtectedRoute requiredRole="user">
            <Quiz />
          </ProtectedRoute>
        }
      />
      
      {/* Quiz History Route for Users */}
      <Route
        path="/quiz-history"
        element={
          <ProtectedRoute requiredRole="user">
            <QuizHistory />
          </ProtectedRoute>
        }
      />
      
      {/* Default Route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}