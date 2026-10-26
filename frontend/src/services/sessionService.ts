import api from "./api";
import type { ApiResponse, PlacementSession } from "../types";

// 1. Get all placement sessions
export const getAllPlacementSessions = async (params: Record<string, any> = {}): Promise<ApiResponse<PlacementSession[]>> => {
  const response = await api.get("/sessions", { params });
  return response.data;
};

// 2. Get currently active placement session
export const getActivePlacementSession = async (): Promise<ApiResponse<PlacementSession>> => {
  const response = await api.get("/sessions/active");
  return response.data;
};

// 3. Get single session with analytics by ID
export const getPlacementSessionById = async (sessionId: string): Promise<ApiResponse<PlacementSession>> => {
  const response = await api.get(`/sessions/${sessionId}`);
  return response.data;
};

// 4. Create new placement session (Admin)
export const createPlacementSession = async (sessionData: Record<string, any>): Promise<ApiResponse<PlacementSession>> => {
  const response = await api.post("/sessions", sessionData);
  return response.data;
};

// 5. Update placement session (Admin)
export const updatePlacementSession = async (sessionId: string, sessionData: Record<string, any>): Promise<ApiResponse<PlacementSession>> => {
  const response = await api.patch(`/sessions/${sessionId}`, sessionData);
  return response.data;
};

// 6. Set placement session as active (Admin)
export const activatePlacementSession = async (sessionId: string): Promise<ApiResponse<PlacementSession>> => {
  const response = await api.patch(`/sessions/${sessionId}/activate`);
  return response.data;
};

// 7. Close placement session (Admin)
export const closePlacementSession = async (sessionId: string): Promise<ApiResponse<PlacementSession>> => {
  const response = await api.patch(`/sessions/${sessionId}/close`);
  return response.data;
};

// 8. Archive placement session (Admin)
export const archivePlacementSession = async (sessionId: string): Promise<ApiResponse<PlacementSession>> => {
  const response = await api.patch(`/sessions/${sessionId}/archive`);
  return response.data;
};

// 9. Preview migration / backfill mappings
export const previewSessionBackfill = async (): Promise<ApiResponse<any>> => {
  const response = await api.get("/sessions/backfill/preview");
  return response.data;
};

// 10. Execute migration / backfill
export const executeSessionBackfill = async (confirmedMappings: any[]): Promise<ApiResponse<any>> => {
  const response = await api.post("/sessions/backfill/execute", { confirmedMappings });
  return response.data;
};

// 11. Transfer students to another session
export const transferStudentsSession = async ({
  studentIds,
  targetSessionId,
  updateGraduationYear = true,
}: {
  studentIds: string[];
  targetSessionId: string;
  updateGraduationYear?: boolean;
}): Promise<ApiResponse<any>> => {
  const response = await api.post("/sessions/transfer-students", {
    studentIds,
    targetSessionId,
    updateGraduationYear,
  });
  return response.data;
};
