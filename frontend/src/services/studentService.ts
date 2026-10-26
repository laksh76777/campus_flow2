import api from "./api";
import type { ApiResponse, StudentProfile, PlacementDrive, Application } from "../types";

// Fetch student dashboard statistics & upcoming drives & recent applications
export const getStudentDashboardStats = async (): Promise<ApiResponse<any>> => {
  const response = await api.get("/dashboard/student/stats");
  return response.data;
};

// Fetch current logged in student's academic profile
export const getCurrentStudentProfile = async (): Promise<ApiResponse<StudentProfile>> => {
  const response = await api.get("/studentprofile/current-student-profile");
  return response.data;
};

// Fetch placement drives where the student meets eligibility criteria
export const getMyEligibleDrives = async (): Promise<ApiResponse<PlacementDrive[]>> => {
  const response = await api.get("/placementdrive/my-eligible-drives");
  return response.data;
};

// Fetch all active placement drives
export const getAllPlacementDrives = async (): Promise<ApiResponse<PlacementDrive[]>> => {
  const response = await api.get("/placementdrive/all-drives");
  return response.data;
};

// Fetch all applications submitted by the current student
export const getMyApplications = async (): Promise<ApiResponse<Application[]>> => {
  const response = await api.get("/application/my-applications");
  return response.data;
};

// Apply for a specific placement drive (supports optional custom/updated resume file and customAnswers)
export const applyForDrive = async (
  driveId: string,
  resumeFile: File | null = null,
  customAnswers: any[] = []
): Promise<ApiResponse<Application>> => {
  if (resumeFile) {
    const formData = new FormData();
    formData.append("resume", resumeFile);
    if (customAnswers && customAnswers.length > 0) {
      formData.append("customAnswers", JSON.stringify(customAnswers));
    }
    const response = await api.post(`/application/${driveId}/apply`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }
  const payload = customAnswers && customAnswers.length > 0 ? { customAnswers } : {};
  const response = await api.post(`/application/${driveId}/apply`, payload);
  return response.data;
};

// Withdraw a submitted application
export const withdrawApplication = async (applicationId: string): Promise<ApiResponse<Application>> => {
  const response = await api.patch(`/application/${applicationId}/withdraw`);
  return response.data;
};

// Update student profile details (supports structured sections)
export const updateStudentProfile = async (profileData: any): Promise<ApiResponse<StudentProfile>> => {
  const response = await api.patch("/studentprofile/update-profile", profileData);
  return response.data;
};

// Upload / update student resume
export const updateStudentResume = async (formData: FormData): Promise<ApiResponse<any>> => {
  const response = await api.patch("/studentprofile/update-resume", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

// Delete student resume
export const deleteStudentResume = async (): Promise<ApiResponse<any>> => {
  const response = await api.delete("/studentprofile/delete-resume");
  return response.data;
};

// Upload / update user avatar image
export const updateUserAvatar = async (formData: FormData): Promise<ApiResponse<any>> => {
  const response = await api.patch("/users/update-avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

// Delete user avatar image
export const deleteUserAvatar = async (): Promise<ApiResponse<any>> => {
  const response = await api.delete("/users/delete-avatar");
  return response.data;
};

// Check student eligibility breakdown for a drive
export const checkDriveEligibility = async (driveId: string): Promise<ApiResponse<any>> => {
  const response = await api.get(`/placementdrive/${driveId}/eligibility-check`);
  return response.data;
};

// Add individual semester result with SGPA and credits
export const addSemesterResult = async (semesterData: any): Promise<ApiResponse<any>> => {
  const response = await api.post("/studentprofile/semester-result", semesterData);
  return response.data;
};

// Add or update backlog record
export const addBacklogRecord = async (backlogData: any): Promise<ApiResponse<any>> => {
  const response = await api.post("/studentprofile/backlog-record", backlogData);
  return response.data;
};

// Delete backlog record (allowed when unlocked or for admin)
export const deleteBacklogRecord = async (backlogId: string, studentProfileId: string | null = null): Promise<ApiResponse<any>> => {
  const url = studentProfileId
    ? `/studentprofile/backlog-record/${backlogId}?studentProfileId=${studentProfileId}`
    : `/studentprofile/backlog-record/${backlogId}`;
  const response = await api.delete(url);
  return response.data;
};

// Admin verify student profile
export const verifyStudentProfile = async (studentId: string, verificationData: any): Promise<ApiResponse<any>> => {
  const response = await api.patch(`/studentprofile/${studentId}/verify`, verificationData);
  return response.data;
};

// Admin trigger safe migration of profiles
export const safeMigrateExistingProfiles = async (): Promise<ApiResponse<any>> => {
  const response = await api.post("/studentprofile/migrate-profiles");
  return response.data;
};

// Student accept or decline formal placement offer
export const respondToOffer = async (applicationId: string, decision: "accepted" | "rejected", remarks = ""): Promise<ApiResponse<any>> => {
  const response = await api.patch(`/application/${applicationId}/respond-offer`, {
    decision,
    remarks,
  });
  return response.data;
};

// Check drive student information requirements checklist
export const checkPreApplicationRequirements = async (driveId: string): Promise<ApiResponse<any>> => {
  const response = await api.get(`/application/${driveId}/precheck`);
  return response.data;
};

// Lock student profile after verification
export const lockProfile = async (targetUserId: string): Promise<ApiResponse<any>> => {
  const response = await api.post("/studentprofile/lock-profile", { userId: targetUserId });
  return response.data;
};

// Request profile detail modification from TPO
export const requestProfileModification = async (modificationData: any): Promise<ApiResponse<any>> => {
  const response = await api.post("/studentprofile/request-modification", modificationData);
  return response.data;
};

// Validate certificate URL or document with backend verification pipeline & AI
export const validateCertificate = async ({ certificateUrl, file }: { certificateUrl?: string; file?: File }): Promise<ApiResponse<any>> => {
  if (file) {
    const formData = new FormData();
    formData.append("document", file);
    if (certificateUrl) formData.append("certificateUrl", certificateUrl);
    const response = await api.post("/studentprofile/certificates/validate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  }

  const response = await api.post("/studentprofile/certificates/validate", { certificateUrl });
  return response.data;
};

// Add validated certificate to student profile
export const addCertificate = async (certificateData: any): Promise<ApiResponse<any>> => {
  const response = await api.post("/studentprofile/certificates", certificateData);
  return response.data;
};

// Delete certificate from student profile
export const deleteCertificate = async (certId: string): Promise<ApiResponse<any>> => {
  const response = await api.delete(`/studentprofile/certificates/${certId}`);
  return response.data;
};

// Admin review / approve / reject student certificate
export const reviewCertificate = async (studentId: string, certId: string, reviewData: any): Promise<ApiResponse<any>> => {
  const response = await api.patch(`/studentprofile/certificates/${studentId}/${certId}/review`, reviewData);
  return response.data;
};
