import { Router } from "express";
import {
    createSupportConversation,
    getMySupportConversations,
    getAdminSupportInbox,
    getSupportConversation,
    sendStudentSupportMessage,
    requestAdminReply,
    replyToSupportConversation,
    updateSupportConversationStatus,
    handleAdminCopilotPrompt
} from "../controllers/support.controller.js";
import { verifyJWT, verifyStudent, verifyAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { supportAssistantLimiter } from "../middlewares/security.middleware.js";
import {
    createSupportConversationSchema,
    sendSupportMessageSchema,
    adminReplySchema,
    adminCopilotSchema
} from "../schemas/support.schema.js";

const router = Router();
router.use(verifyJWT);

// Admin-only support inbox & AI copilot
router.get("/admin/inbox", verifyAdmin, getAdminSupportInbox);
router.post("/admin/copilot", verifyAdmin, validate(adminCopilotSchema), handleAdminCopilotPrompt);
router.post("/admin/:conversationId/reply", verifyAdmin, validate(adminReplySchema), replyToSupportConversation);
router.patch("/admin/:conversationId/status", verifyAdmin, updateSupportConversationStatus);

// Student support & AI mentor
router.get("/my-conversations", verifyStudent, getMySupportConversations);
router.post("/conversations", verifyStudent, supportAssistantLimiter, validate(createSupportConversationSchema), createSupportConversation);
router.get("/conversations/:conversationId", getSupportConversation);
router.post("/conversations/:conversationId/messages", verifyStudent, supportAssistantLimiter, validate(sendSupportMessageSchema), sendStudentSupportMessage);
router.post("/conversations/:conversationId/request-admin", verifyStudent, requestAdminReply);

export default router;
