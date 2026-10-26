import axios from "axios";
import { API_BASE_URL, API_CONFIGURATION_ERROR } from "./apiConfig.js";

const ensureApiConfigured = () => {
  if (API_CONFIGURATION_ERROR) {
    throw new Error(API_CONFIGURATION_ERROR);
  }
};

export const registerStudent = async (userData: any) => {
  ensureApiConfigured();
  const response = await axios.post(`${API_BASE_URL}/users/register/student`, userData, {
    withCredentials: true,
  });
  return response.data;
};

export const getPublicDepartments = async (course = "") => {
  ensureApiConfigured();
  const url = course ? `${API_BASE_URL}/departments?course=${encodeURIComponent(course)}` : `${API_BASE_URL}/departments`;
  const response = await axios.get(url);
  return response.data;
};

export const getPublicSessions = async () => {
  ensureApiConfigured();
  const response = await axios.get(`${API_BASE_URL}/sessions`);
  return response.data;
};

export const loginStudent = async (credentials: any) => {
  ensureApiConfigured();
  const response = await axios.post(`${API_BASE_URL}/users/login`, credentials, {
    withCredentials: true,
  });
  return response.data;
};

export const registerAdmin = async (userData: any) => {
  ensureApiConfigured();
  const response = await axios.post(`${API_BASE_URL}/users/register/admin`, userData, {
    withCredentials: true,
  });
  return response.data;
};

export const loginAdmin = async (credentials: any) => {
  ensureApiConfigured();
  const response = await axios.post(`${API_BASE_URL}/users/login`, credentials, {
    withCredentials: true,
  });
  return response.data;
};

export const logoutAuth = async (_role = "student") => {
  ensureApiConfigured();
  const token = localStorage.getItem("accessToken");
  const response = await axios.post(
    `${API_BASE_URL}/users/logout`,
    {},
    {
      withCredentials: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return response.data;
};

export const requestPasswordResetOtp = async (email: string, _role = "student") => {
  ensureApiConfigured();
  const response = await axios.post(`${API_BASE_URL}/users/forgot-password`, { email }, { withCredentials: true });
  return response.data;
};

export const verifyPasswordResetOtp = async ({ email, otp }: { email: string; otp: string }, _role = "student") => {
  ensureApiConfigured();
  const response = await axios.post(`${API_BASE_URL}/users/verify-otp`, { email, otp }, { withCredentials: true });
  return response.data;
};

export const completePasswordReset = async (
  { resetToken, newPassword, confirmPassword }: { resetToken: string; newPassword: string; confirmPassword?: string },
  _role = "student"
) => {
  ensureApiConfigured();
  const response = await axios.post(
    `${API_BASE_URL}/users/reset-password`,
    { resetToken, newPassword, confirmPassword },
    { withCredentials: true }
  );
  return response.data;
};
