import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { SupportRepository } from "../repositories/support.repository.js";
import { generateSupportReply } from "../services/integrations/ai/supportAssistant.service.js";
import { handleAdminCopilotPrompt as copilotService } from "../services/integrations/ai/adminCopilot.service.js";
import { getParam } from "../utils/params.js";

export const createSupportConversation = asyncHandler(async (req: Request, res: Response) => {
    const { subject, message } = req.body;
    const student = req.user;

    const conversation = await SupportRepository.create(student.id, subject, message);

    // Generate immediate AI assistance reply
    const aiResponse = await generateSupportReply(student.id, conversation.messages, message);
    const updated = await SupportRepository.addMessage(conversation.id, {
        senderRole: "assistant",
        content: aiResponse.answer,
        confidence: aiResponse.confidence,
        handoffRecommended: aiResponse.handoffRecommended
    });

    return res.status(201).json(new ApiResponse(201, updated, "Conversation created successfully."));
});

export const getMySupportConversations = asyncHandler(async (req: Request, res: Response) => {
    const conversations = await SupportRepository.findByStudent(req.user.id);
    return res.status(200).json(new ApiResponse(200, conversations, "Conversations retrieved."));
});

export const getAdminSupportInbox = asyncHandler(async (req: Request, res: Response) => {
    const conversations = await SupportRepository.findAllInbox();
    return res.status(200).json(new ApiResponse(200, conversations, "Admin support inbox retrieved."));
});

export const getSupportConversation = asyncHandler(async (req: Request, res: Response) => {
    const conversationId = getParam(req.params.conversationId);
    const conversation = await SupportRepository.findById(conversationId);
    if (!conversation) {
        throw new ApiError(404, "Support conversation not found.");
    }
    if (req.user.role === "student" && conversation.student_id !== req.user.id) {
        throw new ApiError(403, "You are not authorized to access this support conversation.");
    }
    return res.status(200).json(new ApiResponse(200, conversation, "Conversation retrieved."));
});

export const sendStudentSupportMessage = asyncHandler(async (req: Request, res: Response) => {
    const conversationId = getParam(req.params.conversationId);
    const { content } = req.body;
    const student = req.user;

    const conv = await SupportRepository.findById(conversationId);
    if (!conv) {
        throw new ApiError(404, "Support conversation not found.");
    }
    if (req.user.role === "student" && conv.student_id !== req.user.id) {
        throw new ApiError(403, "You are not authorized to participate in this support conversation.");
    }

    // Add student message
    const updatedWithUserMsg = await SupportRepository.addMessage(conversationId, {
        senderRole: "student",
        senderId: student.id,
        content
    });

    // Generate AI assistant reply
    const aiReply = await generateSupportReply(student.id, updatedWithUserMsg.messages, content);
    const finalConversation = await SupportRepository.addMessage(conversationId, {
        senderRole: "assistant",
        content: aiReply.answer,
        confidence: aiReply.confidence,
        handoffRecommended: aiReply.handoffRecommended
    });

    return res.status(200).json(new ApiResponse(200, finalConversation, "Message sent."));
});

export const requestAdminReply = asyncHandler(async (req: Request, res: Response) => {
    const conversationId = getParam(req.params.conversationId);
    const conv = await SupportRepository.findById(conversationId);
    if (!conv) {
        throw new ApiError(404, "Support conversation not found.");
    }
    if (req.user.role === "student" && conv.student_id !== req.user.id) {
        throw new ApiError(403, "You are not authorized to update this support conversation.");
    }
    const updated = await SupportRepository.updateStatus(conversationId, "open");
    return res.status(200).json(new ApiResponse(200, updated, "Handoff to placement officer requested."));
});

export const replyToSupportConversation = asyncHandler(async (req: Request, res: Response) => {
    const conversationId = getParam(req.params.conversationId);
    const { content } = req.body;

    const updated = await SupportRepository.addMessage(conversationId, {
        senderRole: "admin",
        senderId: req.user.id,
        content
    });

    return res.status(200).json(new ApiResponse(200, updated, "Officer reply posted successfully."));
});

export const updateSupportConversationStatus = asyncHandler(async (req: Request, res: Response) => {
    const conversationId = getParam(req.params.conversationId);
    const { status } = req.body;

    const updated = await SupportRepository.updateStatus(conversationId, status, req.user.id);
    return res.status(200).json(new ApiResponse(200, updated, "Status updated."));
});

export const handleAdminCopilotPrompt = asyncHandler(async (req: Request, res: Response) => {
    const { prompt } = req.body;
    const reply = await copilotService(prompt);
    return res.status(200).json(new ApiResponse(200, { reply }, "Copilot response generated."));
});
