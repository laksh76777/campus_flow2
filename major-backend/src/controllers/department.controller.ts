import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { DepartmentRepository } from "../repositories/department.repository.js";

export const getAllDepartments = asyncHandler(async (req: Request, res: Response) => {
    const { activeOnly } = req.query;
    const departments = await DepartmentRepository.findAll(activeOnly === "true");
    return res.status(200).json(new ApiResponse(200, departments, "Departments retrieved."));
});
