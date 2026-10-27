import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { SessionRepository } from "../repositories/session.repository.js";
import { getParam } from "../utils/params.js";

export const createSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionYear } = req.body;
    const existing = await SessionRepository.findByYear(sessionYear);
    if (existing) {
        throw new ApiError(409, `Placement session for year ${sessionYear} already exists.`);
    }

    const session = await SessionRepository.create({
        ...req.body,
        createdBy: req.user.id
    });
    return res.status(201).json(new ApiResponse(201, session, "Placement session created successfully."));
});

export const getAllSessions = asyncHandler(async (req: Request, res: Response) => {
    const { status, includeArchived } = req.query;
    const sessions = await SessionRepository.findAll(
        status ? String(status) : undefined,
        includeArchived === "true"
    );
    return res.status(200).json(new ApiResponse(200, sessions, "Placement sessions retrieved."));
});

export const getActiveSession = asyncHandler(async (req: Request, res: Response) => {
    const session = await SessionRepository.findActive();
    return res.status(200).json(new ApiResponse(200, session, "Active placement session retrieved."));
});

export const getSessionById = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const session = await SessionRepository.findById(id);
    if (!session) {
        throw new ApiError(404, "Placement session not found.");
    }
    return res.status(200).json(new ApiResponse(200, session, "Placement session details retrieved."));
});

export const updateSession = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const session = await SessionRepository.findById(id);
    if (!session) {
        throw new ApiError(404, "Placement session not found.");
    }

    const updated = await SessionRepository.update(id, req.body);
    return res.status(200).json(new ApiResponse(200, updated, "Placement session updated successfully."));
});

export const activateSession = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const session = await SessionRepository.findById(id);
    if (!session) throw new ApiError(404, "Placement session not found.");

    const updated = await SessionRepository.activate(id);
    return res.status(200).json(new ApiResponse(200, updated, "Placement session activated."));
});

export const closeSession = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const session = await SessionRepository.findById(id);
    if (!session) throw new ApiError(404, "Placement session not found.");

    const updated = await SessionRepository.close(id);
    return res.status(200).json(new ApiResponse(200, updated, "Placement session closed."));
});

export const archiveSession = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const session = await SessionRepository.findById(id);
    if (!session) throw new ApiError(404, "Placement session not found.");

    const updated = await SessionRepository.archive(id);
    return res.status(200).json(new ApiResponse(200, updated, "Placement session archived."));
});

export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const session = await SessionRepository.findById(id);
    if (!session) throw new ApiError(404, "Placement session not found.");

    await SessionRepository.delete(id);
    return res.status(200).json(new ApiResponse(200, {}, "Placement session deleted successfully."));
});

export const previewSessionBackfill = asyncHandler(async (req: Request, res: Response) => {
    const preview = await SessionRepository.previewBackfill();
    return res.status(200).json(new ApiResponse(200, preview, "Session backfill preview generated."));
});

export const executeSessionBackfill = asyncHandler(async (req: Request, res: Response) => {
    const { confirmedMappings } = req.body;
    if (!Array.isArray(confirmedMappings)) {
        throw new ApiError(400, "confirmedMappings array is required.");
    }

    const result = await SessionRepository.executeBackfill(confirmedMappings);
    return res.status(200).json(
        new ApiResponse(200, result, `Successfully backfilled ${result.updatedCount} student profiles.`)
    );
});

export const transferStudents = asyncHandler(async (req: Request, res: Response) => {
    const { studentIds, targetSessionId, updateGraduationYear } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0 || !targetSessionId) {
        throw new ApiError(400, "studentIds array and targetSessionId are required.");
    }

    const result = await SessionRepository.transferStudents(
        studentIds,
        targetSessionId,
        updateGraduationYear !== false
    );

    return res.status(200).json(
        new ApiResponse(200, result, `Transferred ${result.transferredCount} students to new session.`)
    );
});
