import api from "./api";
import type { ApiResponse } from "../types";

// Helper to trigger browser download of binary Blob
const triggerBlobDownload = (blobData: any, filename: string) => {
  const blob =
    blobData instanceof Blob
      ? blobData
      : new Blob([blobData], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 200);
};

export const excelService = {
  // Download standard .xlsx template with instructions
  downloadTemplate: async (importType: string): Promise<boolean> => {
    const response = await api.get(`/excel/template/${importType}`, {
      responseType: "blob",
    });
    triggerBlobDownload(response.data, `CampusFlow_Template_${importType}.xlsx`);
    return true;
  },

  // Upload spreadsheet to generate preview and validate rows without writing
  uploadAndPreview: async ({
    file,
    importType,
    placementSessionId,
    conflictStrategy = "skip",
  }: {
    file: File;
    importType: string;
    placementSessionId?: string;
    conflictStrategy?: string;
  }): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("importType", importType);
    if (placementSessionId && placementSessionId !== "all") {
      formData.append("placementSessionId", placementSessionId);
    }
    formData.append("conflictStrategy", conflictStrategy);

    const response = await api.post("/excel/preview", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Confirm and commit approved import batch
  commitBatch: async (batchId: string): Promise<ApiResponse<any>> => {
    const response = await api.post(`/excel/commit/${batchId}`);
    return response.data;
  },

  // Fetch import audit batches
  listBatches: async (params: Record<string, any> = {}): Promise<ApiResponse<any[]>> => {
    const response = await api.get("/excel/batches", { params });
    return response.data;
  },

  // Get specific batch details
  getBatchDetails: async (batchId: string): Promise<ApiResponse<any>> => {
    const response = await api.get(`/excel/batches/${batchId}`);
    return response.data;
  },

  // Download error report for a batch
  downloadErrorReport: async (batchId: string): Promise<boolean> => {
    const response = await api.get(`/excel/batches/${batchId}/error-report`, {
      responseType: "blob",
    });
    triggerBlobDownload(response.data, `CampusFlow_ErrorReport_${batchId}.xlsx`);
    return true;
  },

  // Export Eligible Students for a Placement Drive
  exportEligibleStudents: async (driveId: string, driveTitle = "Drive"): Promise<boolean> => {
    const response = await api.get(`/excel/export/eligible/${driveId}`, {
      responseType: "blob",
    });
    triggerBlobDownload(response.data, `CampusFlow_Eligible_${driveTitle.replace(/\s+/g, "_")}.xlsx`);
    return true;
  },

  // Export Drive Applicants (Optionally Company-Facing with Privacy Shield)
  exportDriveApplicants: async (
    driveId: string,
    { status = "all", isCompanyFacing = false, driveTitle = "Drive" }: { status?: string; isCompanyFacing?: boolean; driveTitle?: string } = {}
  ): Promise<boolean> => {
    const response = await api.get(`/excel/export/drive/${driveId}`, {
      params: { status, isCompanyFacing },
      responseType: "blob",
    });
    const prefix = isCompanyFacing ? "Company_Roster" : "Applicants";
    triggerBlobDownload(response.data, `CampusFlow_${prefix}_${driveTitle.replace(/\s+/g, "_")}.xlsx`);
    return true;
  },

  // Export Session Cohort Summary & Roster
  exportSessionReport: async (sessionId: string, sessionName = "Cohort"): Promise<boolean> => {
    const response = await api.get(`/excel/export/session/${sessionId}`, {
      responseType: "blob",
    });
    triggerBlobDownload(response.data, `CampusFlow_Session_${sessionName.replace(/\s+/g, "_")}.xlsx`);
    return true;
  },

  // Export Department Breakdown Report
  exportDepartmentReport: async (sessionId: string, sessionName = "Cohort"): Promise<boolean> => {
    const response = await api.get(`/excel/export/department/${sessionId}`, {
      responseType: "blob",
    });
    triggerBlobDownload(response.data, `CampusFlow_Department_Analytics_${sessionName.replace(/\s+/g, "_")}.xlsx`);
    return true;
  },

  // Export Historical Placement Outcomes
  exportHistoricalPlacements: async (sessionId = ""): Promise<boolean> => {
    const url = sessionId && sessionId !== "all" ? `/excel/export/historical/${sessionId}` : "/excel/export/historical";
    const response = await api.get(url, {
      responseType: "blob",
    });
    triggerBlobDownload(response.data, "CampusFlow_Historical_Placements.xlsx");
    return true;
  },
};
