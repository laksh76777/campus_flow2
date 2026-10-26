import { createContext, useContext } from "react";
import type { User, StudentProfile } from "../types";

export interface AuthContextType {
  token: string;
  user: User | null;
  userRole: "student" | "admin" | null;
  studentProfile: StudentProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (newToken: string, userData: any, explicitRole?: "student" | "admin" | null) => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
