import api from "./api";
import type { ApiResponse, Company, PlacementDrive, Application, StudentProfile } from "../types";

// 1. Dashboard Statistics
export const getAdminDashboardStats = async (): Promise<ApiResponse<any>> => {
  const response = await api.get("/dashboard/stats");
  return response.data;
};

// 2. Company Management
export const getAllCompanies = async (params: Record<string, any> = {}): Promise<ApiResponse<Company[]>> => {
  const response = await api.get("/company/all-companies", { params });
  return response.data;
};

export const createCompany = async (companyData: FormData | Record<string, any>): Promise<ApiResponse<Company>> => {
  const isFormData = companyData instanceof FormData;
  const response = await api.post("/company/create-company", companyData, {
    headers: isFormData ? { "Content-Type": "multipart/form-data" } : {},
  });
  return response.data;
};

export const updateCompany = async (companyId: string, updateData: Record<string, any>): Promise<ApiResponse<Company>> => {
  const response = await api.patch(`/company/${companyId}`, updateData);
  return response.data;
};

export const deactivateCompany = async (companyId: string): Promise<ApiResponse<Company>> => {
  const response = await api.patch(`/company/${companyId}/deactivate`);
  return response.data;
};

export const reactivateCompany = async (companyId: string): Promise<ApiResponse<Company>> => {
  const response = await api.patch(`/company/${companyId}/reactivate`);
  return response.data;
};

export const deleteCompany = async (companyId: string): Promise<ApiResponse<any>> => {
  const response = await api.delete(`/company/${companyId}`);
  return response.data;
};


// 3. Placement Drive Management
export const getAllPlacementDrives = async (params: Record<string, any> = {}): Promise<ApiResponse<PlacementDrive[]>> => {
  const response = await api.get("/placementdrive/all-drives", { params });
  return response.data;
};

export const createPlacementDrive = async (driveData: FormData | Record<string, any>): Promise<ApiResponse<PlacementDrive>> => {
  const isFormData = driveData instanceof FormData;
  const response = await api.post("/placementdrive/create-placement-drive", driveData, {
    headers: isFormData ? { "Content-Type": "multipart/form-data" } : {},
  });
  return response.data;
};

export const updatePlacementDrive = async (driveId: string, driveData: FormData | Record<string, any>): Promise<ApiResponse<PlacementDrive>> => {
  const isFormData = driveData instanceof FormData;
  const response = await api.patch(`/placementdrive/${driveId}`, driveData, {
    headers: isFormData ? { "Content-Type": "multipart/form-data" } : {},
  });
  return response.data;
};

export const deactivatePlacementDrive = async (driveId: string): Promise<ApiResponse<PlacementDrive>> => {
  const response = await api.patch(`/placementdrive/${driveId}/deactivate`);
  return response.data;
};

export const reactivatePlacementDrive = async (driveId: string): Promise<ApiResponse<PlacementDrive>> => {
  const response = await api.patch(`/placementdrive/${driveId}/reactivate`);
  return response.data;
};

export const deletePlacementDrive = async (driveId: string): Promise<ApiResponse<any>> => {
  const response = await api.delete(`/placementdrive/${driveId}`);
  return response.data;
};

export const getEligibleStudentsForDrive = async (driveId: string): Promise<ApiResponse<any>> => {
  const response = await api.get(`/placementdrive/${driveId}/eligible-students`);
  return response.data;
};

// 4. Application Management
export const getApplicationsByDrive = async (placementDriveId: string, params: Record<string, any> = {}): Promise<ApiResponse<Application[]>> => {
  const response = await api.get(`/application/drive/${placementDriveId}`, { params });
  return response.data;
};

export const updateApplicationStatus = async (
  applicationId: string,
  status: string,
  remarks = "",
  extraDetails: Record<string, any> = {}
): Promise<ApiResponse<Application>> => {
  const response = await api.patch(`/application/${applicationId}/status`, {
    status,
    remarks,
    ...extraDetails,
  });
  return response.data;
};

export const getApplicationById = async (applicationId: string): Promise<ApiResponse<Application>> => {
  const response = await api.get(`/application/${applicationId}`);
  return response.data;
};

export const getAllApplications = async (params: Record<string, any> = {}): Promise<ApiResponse<Application[]>> => {
  const response = await api.get("/application/all-applications", { params });
  return response.data;
};

// 5. Student Cohort Management
export const getAllStudentProfiles = async (params: Record<string, any> = {}): Promise<ApiResponse<{ students: StudentProfile[]; pagination?: any }>> => {
  const response = await api.get("/studentprofile/all-students", { params });
  return response.data;
};

export const getCompleteStudentDirectory = async (pageSize = 200): Promise<StudentProfile[]> => {
  const firstPage = await getAllStudentProfiles({ page: 1, limit: pageSize });
  const firstStudents = (firstPage?.data as any)?.students || (Array.isArray(firstPage?.data) ? firstPage.data : []);
  const totalPages = Math.max(1, Number((firstPage?.data as any)?.pagination?.pages) || 1);
  const remainingPages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
  const rest: StudentProfile[] = [];

  for (let index = 0; index < remainingPages.length; index += 5) {
    const batch = remainingPages.slice(index, index + 5);
    const responses = await Promise.all(batch.map((page) => getAllStudentProfiles({ page, limit: pageSize })));
    rest.push(...responses.flatMap((response) => (response?.data as any)?.students || []));
  }

  return [...firstStudents, ...rest];
};

export const getStudentProfileById = async (studentId: string): Promise<ApiResponse<StudentProfile>> => {
  const response = await api.get(`/studentprofile/${studentId}`);
  return response.data;
};

// 6. Drive Eligibility Preview & Authorized Overrides
export const getDriveEligibilityPreview = async (driveId: string): Promise<ApiResponse<any>> => {
  const response = await api.get(`/placementdrive/${driveId}/eligibility-preview`);
  return response.data;
};

export const adminOverrideApplication = async (applicationId: string, overrideData: Record<string, any>): Promise<ApiResponse<any>> => {
  const response = await api.post(`/application/${applicationId}/admin-override`, overrideData);
  return response.data;
};

// 7. Automated Placement Drive Lifecycle Management
export const getAutomatedDriveWorkspace = async (driveId: string): Promise<ApiResponse<any>> => {
  const response = await api.get(`/placementdrive/${driveId}/automated-workspace`);
  return response.data;
};

export const configureSelectionRounds = async (driveId: string, rounds: any[]): Promise<ApiResponse<any>> => {
  const response = await api.put(`/placementdrive/${driveId}/automated-rounds`, { rounds });
  return response.data;
};

export const exportCompanyRoster = async (driveId: string, roundNumber = 1, format = "xlsx"): Promise<Blob> => {
  const response = await api.get(`/placementdrive/${driveId}/export-company-roster`, {
    params: { roundNumber, format },
    responseType: "blob",
  });
  return response.data;
};

export const previewCompanyResults = async (driveId: string, formData: FormData): Promise<ApiResponse<any>> => {
  const response = await api.post(`/placementdrive/${driveId}/preview-results`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const commitCompanyResults = async (driveId: string, commitData: Record<string, any>): Promise<ApiResponse<any>> => {
  const response = await api.post(`/placementdrive/${driveId}/commit-results`, commitData);
  return response.data;
};

export const enrollEligibleStudents = async (driveId: string): Promise<ApiResponse<any>> => {
  const response = await api.post(`/placementdrive/${driveId}/enroll-eligible-students`);
  return response.data;
};

// Student Profile Locking & Modification Requests
export const getModificationRequests = async (): Promise<ApiResponse<any[]>> => {
  const response = await api.get("/studentprofile/modification-requests");
  return response.data;
};

export const reviewModificationRequest = async (
  requestId: string,
  { action, reviewRemarks }: { action: "approved" | "rejected"; reviewRemarks?: string }
): Promise<ApiResponse<any>> => {
  const response = await api.post(`/studentprofile/modification-requests/${requestId}/review`, {
    action,
    reviewRemarks,
  });
  return response.data;
};

export const unlockStudentProfile = async (studentId: string): Promise<ApiResponse<any>> => {
  const response = await api.post(`/studentprofile/${studentId}/unlock-profile`);
  return response.data;
};
