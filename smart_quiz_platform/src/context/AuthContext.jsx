import { createContext, useContext, useEffect, useState } from "react";
import { 
  getAuth, 
  onAuthStateChanged, 
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { firebaseApp } from "../firebase";


const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext); // ✅ Provides all authentication functions
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          setRole(userDoc.exists() ? userDoc.data().role : "user");
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRole("user"); // Default role if Firestore fetch fails
        }
      } else {
        setRole(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // ✅ Signup function (creates user & stores in Firestore)
 // In AuthContext.jsx
// In AuthContext.jsx
const signup = async (email, password, role, firstName, lastName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Make sure firstName and lastName have default values if they're undefined
    const userData = {
      email, 
      role: role || "user",
      firstName: firstName || "",
      lastName: lastName || ""
    };

    // Now set the document with valid data (no undefined values)
    await setDoc(doc(db, "users", user.uid), userData);

    setCurrentUser(user);
    setRole(userData.role);

    return userCredential;
  } catch (error) {
    console.error("Error during signup:", error);
    throw error; // Re-throw to let component handle it
  }
};

  // ✅ Login function (fetches user role from Firestore)
  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    setCurrentUser(user); // ✅ Ensure currentUser updates

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      setRole(userDoc.exists() ? userDoc.data().role : "user");
    } catch (error) {
      console.error("Error fetching user role:", error);
      setRole("user"); // Default role if Firestore fetch fails
    }

    return userCredential; // ✅ Return user data for further processing
  };

  // ✅ Logout function
  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setRole(null);
  };
  
  const resetPassword = async (email) => {
    return await sendPasswordResetEmail(auth, email);
  };
  // ✅ Provide authentication values to the app
  const value = {
    currentUser,
    role,
    signup,
    login,
    resetPassword,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
