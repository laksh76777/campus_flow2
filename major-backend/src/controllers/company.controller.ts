import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { CompanyRepository } from "../repositories/company.repository.js";
import { uploadToStorage } from "../services/integrations/storage/cloudinary.service.js";
import { getParam } from "../utils/params.js";

export const formatCompanyResponse = (c: any, isStudent: boolean = false) => {
    if (!c) return null;
    const base: Record<string, any> = {
        ...c,
        _id: c.id,
        companyName: c.company_name,
        companyDescription: c.company_description,
        companyWebsite: c.company_website,
        companyLogoUrl: c.company_logo_url,
        companyLogo: { url: c.company_logo_url, publicId: c.company_logo_public_id },
        isActive: c.is_active
    };
    if (isStudent) {
        delete base.contact_email;
        delete base.contact_phone;
        delete base.contactEmail;
        delete base.contactPhone;
    } else {
        base.contactEmail = c.contact_email;
        base.contactPhone = c.contact_phone;
    }
    return base;
};

export const createCompany = asyncHandler(async (req: Request, res: Response) => {
    const {
        companyName,
        companyDescription,
        companyWebsite,
        industry,
        location,
        contactEmail,
        contactPhone
    } = req.body;

    if (!companyName || !companyName.trim()) {
        throw new ApiError(400, "Company name is required.");
    }

    const existing = await CompanyRepository.findByName(companyName);
    if (existing) {
        throw new ApiError(409, "A company with this name already exists.");
    }

    let logoUrl = req.body.companyLogoUrl || req.body.logoUrl || "";
    let logoPublicId = req.body.companyLogoPublicId || "";

    const file = req.file || (req.files as any)?.[0];
    if (file) {
        const uploadRes = await uploadToStorage(
            file.buffer,
            "companies",
            `company_${Date.now()}`,
            "image"
        );
        logoUrl = uploadRes.url;
        logoPublicId = uploadRes.publicId;
    }

    const company = await CompanyRepository.create({
        companyName,
        companyDescription,
        companyWebsite,
        companyLogoUrl: logoUrl,
        companyLogoPublicId: logoPublicId,
        industry,
        location,
        contactEmail,
        contactPhone,
        createdBy: req.user.id
    });

    return res.status(201).json(new ApiResponse(201, formatCompanyResponse(company), "Company registered successfully."));
});

export const getAllCompanies = asyncHandler(async (req: Request, res: Response) => {
    const { activeOnly, search } = req.query;
    const isStudent = req.user?.role === "student";

    const companies = await CompanyRepository.findAll(
        activeOnly === "true",
        search ? String(search) : undefined
    );

    const formatted = companies.map((c) => formatCompanyResponse(c, isStudent));

    return res.status(200).json(new ApiResponse(200, formatted, "Companies retrieved."));
});

export const getCompanyById = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const company = await CompanyRepository.findById(id);
    if (!company) {
        throw new ApiError(404, "Company not found.");
    }

    const isStudent = req.user?.role === "student";
    return res.status(200).json(new ApiResponse(200, formatCompanyResponse(company, isStudent), "Company retrieved."));
});

export const updateCompany = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const company = await CompanyRepository.findById(id);
    if (!company) {
        throw new ApiError(404, "Company not found.");
    }

    const updates = { ...req.body };

    const file = req.file || (req.files as any)?.[0];
    if (file) {
        const uploadRes = await uploadToStorage(
            file.buffer,
            "companies",
            `company_${id}_logo`,
            "image"
        );
        updates.company_logo_url = uploadRes.url;
        updates.company_logo_public_id = uploadRes.publicId;
    }

    const updated = await CompanyRepository.update(id, updates);
    return res.status(200).json(new ApiResponse(200, formatCompanyResponse(updated), "Company updated successfully."));
});

export const deactivateCompany = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const company = await CompanyRepository.findById(id);
    if (!company) throw new ApiError(404, "Company not found.");

    const updated = await CompanyRepository.deactivate(id);
    return res.status(200).json(new ApiResponse(200, formatCompanyResponse(updated), "Company deactivated successfully."));
});

export const reactivateCompany = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const company = await CompanyRepository.findById(id);
    if (!company) throw new ApiError(404, "Company not found.");

    const updated = await CompanyRepository.reactivate(id);
    return res.status(200).json(new ApiResponse(200, formatCompanyResponse(updated), "Company reactivated successfully."));
});

export const deleteCompany = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const company = await CompanyRepository.findById(id);
    if (!company) throw new ApiError(404, "Company not found.");

    await CompanyRepository.delete(id);
    return res.status(200).json(new ApiResponse(200, {}, "Company deleted successfully."));
});
