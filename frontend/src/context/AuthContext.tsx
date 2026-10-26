import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../services/api";
import { AuthContext, useAuth } from "./authContextDef";
import type { User, StudentProfile } from "../types";

export { useAuth };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string>(() => localStorage.getItem("accessToken") || "");
  const [user, setUser] = useState<User | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [userRole, setUserRole] = useState<"student" | "admin" | null>(() => {
    const r = localStorage.getItem("userRole");
    return r === "admin" || r === "student" ? r : null;
  });

  // Load user details & student profile
  const fetchUserData = useCallback(async () => {
    const storedToken = localStorage.getItem("accessToken");
    const storedRole = localStorage.getItem("userRole") as "student" | "admin" | null;

    if (!storedToken) {
      setUser(null);
      setUserRole(null);
      setStudentProfile(null);
      setLoading(false);
      return;
    }

    const isCurrentSession = () => localStorage.getItem("accessToken") === storedToken;

    try {
      let userRes;

      if (storedRole === "admin") {
        try {
          userRes = await api.get("/admin/current-admin");
        } catch {
          userRes = await api.get("/users/current-user");
        }
      } else {
        userRes = await api.get("/users/current-user");
      }

      if (!isCurrentSession()) return;

      if (userRes.data?.data) {
        const resData = userRes.data.data;
        const userData = resData.user || resData;

        setUser(userData);

        const role = (userData.role || storedRole || "student") as "student" | "admin";

        setUserRole(role);
        localStorage.setItem("userRole", role);

        if (role === "student") {
          try {
            const profileRes = await api.get("/studentprofile/current-student-profile");

            if (isCurrentSession()) {
              setStudentProfile(profileRes.data?.data || null);
            }
          } catch (err: any) {
            if (isCurrentSession()) {
              setStudentProfile(null);
              if (err.response?.status !== 404) {
                console.warn("Student profile error:", err.message);
              }
            }
          }
        } else {
          setStudentProfile(null);
        }
      } else {
        setUser(null);
        setUserRole(null);
        setStudentProfile(null);
      }
    } catch (error: any) {
      if (!isCurrentSession()) return;
      console.warn("Failed to verify user session:", error.message);

      if (error.response?.status === 401) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("userRole");

        setToken("");
        setUser(null);
        setUserRole(null);
        setStudentProfile(null);
        setLoading(false);
      }
    } finally {
      if (isCurrentSession()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    const handleUnauthorized = () => {
      if (!localStorage.getItem("accessToken")) {
        return;
      }

      localStorage.removeItem("accessToken");
      localStorage.removeItem("userRole");
      setToken("");
      setUser(null);
      setUserRole(null);
      setStudentProfile(null);
      setLoading(false);
      toast.error("Your session expired. Please sign in again.");
    };

    window.addEventListener("campusflow:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("campusflow:unauthorized", handleUnauthorized);
  }, []);

  const login = (newToken: string, userData: any, explicitRole: "student" | "admin" | null = null) => {
    localStorage.setItem("accessToken", newToken);
    setToken(newToken);
    setStudentProfile(null);

    const resolvedRole = (userData?.role || explicitRole || "student") as "student" | "admin";

    setUserRole(resolvedRole);
    localStorage.setItem("userRole", resolvedRole);

    setUser(userData || null);

    setLoading(false);
  };

  const logout = async () => {
    try {
      const currentRole = userRole || localStorage.getItem("userRole");
      if (currentRole === "admin") {
        await api.post("/admin/logout");
      } else {
        await api.post("/users/logout");
      }
    } catch (err: any) {
      console.warn("Logout error:", err.message);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userRole");
      setToken("");
      setUser(null);
      setUserRole(null);
      setStudentProfile(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        userRole,
        studentProfile,
        loading,
        isAuthenticated: !!token,
        isAdmin: userRole === "admin",
        login,
        logout,
        refreshProfile: fetchUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
