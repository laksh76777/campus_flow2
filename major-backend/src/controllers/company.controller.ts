import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { CompanyRepository } from "../repositories/company.repository.js";
import { getParam } from "../utils/params.js";

export const createCompany = asyncHandler(async (req: Request, res: Response) => {
    const { companyName } = req.body;
    const existing = await CompanyRepository.findByName(companyName);
    if (existing) {
        throw new ApiError(409, "A company with this name already exists.");
    }

    const company = await CompanyRepository.create({
        ...req.body,
        createdBy: req.user.id
    });
    return res.status(201).json(new ApiResponse(201, company, "Company registered successfully."));
});

export const getAllCompanies = asyncHandler(async (req: Request, res: Response) => {
    const { activeOnly } = req.query;
    const companies = await CompanyRepository.findAll(activeOnly === "true");
    return res.status(200).json(new ApiResponse(200, companies, "Companies retrieved."));
});

export const getCompanyById = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const company = await CompanyRepository.findById(id);
    if (!company) {
        throw new ApiError(404, "Company not found.");
    }
    return res.status(200).json(new ApiResponse(200, company, "Company retrieved."));
});

export const updateCompany = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const company = await CompanyRepository.findById(id);
    if (!company) {
        throw new ApiError(404, "Company not found.");
    }

    const updated = await CompanyRepository.update(id, req.body);
    return res.status(200).json(new ApiResponse(200, updated, "Company updated successfully."));
});
