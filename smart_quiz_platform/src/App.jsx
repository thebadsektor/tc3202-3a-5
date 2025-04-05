import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import Homepage from "./pages/user/HomePage";
import AdminHomePage from "./pages/admin/AdminHomePage";
import Quiz from "./pages/user/Quiz";
import { useAuth } from "./context/AuthContext";
import ForgotPassword from "./pages/auth/Resetpass"; // Adjust the path as needed

// Protected route component
function ProtectedRoute({ children, requiredRole }) {
  const { currentUser, role } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === "admin" ? "/admin" : "/user"} />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
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

      {/* Default Route */}
      <Route path="/" element={<Navigate to="/login" />} />
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
