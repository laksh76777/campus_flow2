import api from "./api";
import type { ApiResponse } from "../types";

export const getMySupportConversations = async (): Promise<ApiResponse<any[]>> =>
  (await api.get("/support/my-conversations")).data;

export const getSupportConversation = async (id: string): Promise<ApiResponse<any>> =>
  (await api.get(`/support/conversations/${id}`)).data;

export const createSupportConversation = async (message: string, subject?: string): Promise<ApiResponse<any>> =>
  (await api.post("/support/conversations", { message, subject })).data;

export const sendSupportMessage = async (id: string, message: string): Promise<ApiResponse<any>> =>
  (await api.post(`/support/conversations/${id}/messages`, { message })).data;

export const requestAdminReply = async (id: string): Promise<ApiResponse<any>> =>
  (await api.post(`/support/conversations/${id}/request-admin`)).data;

export const getAdminSupportInbox = async (status = "open"): Promise<ApiResponse<any[]>> =>
  (await api.get("/support/admin/inbox", { params: { status } })).data;

export const sendAdminSupportReply = async (id: string, message: string): Promise<ApiResponse<any>> =>
  (await api.post(`/support/admin/${id}/reply`, { message })).data;

export const updateSupportStatus = async (id: string, status: string): Promise<ApiResponse<any>> =>
  (await api.patch(`/support/admin/${id}/status`, { status })).data;

export const sendAdminCopilotPrompt = async (prompt: string, messages: any[] = []): Promise<ApiResponse<any>> =>
  (await api.post("/support/admin/copilot", { prompt, messages })).data;
