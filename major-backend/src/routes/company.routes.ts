import { Router } from "express";
import {
    createCompany,
    getAllCompanies,
    getCompanyById,
    updateCompany,
    deactivateCompany,
    reactivateCompany,
    deleteCompany
} from "../controllers/company.controller.js";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { createCompanySchema, updateCompanySchema } from "../schemas/company.schema.js";

const router = Router();
router.use(verifyJWT);

// Specific Named Routes
router.get("/all-companies", getAllCompanies);
router.post("/create-company", verifyAdmin, upload.single("companyLogo"), createCompany);
router.patch("/:id/deactivate", verifyAdmin, deactivateCompany);
router.patch("/:id/archive", verifyAdmin, deactivateCompany);
router.patch("/:id/reactivate", verifyAdmin, reactivateCompany);

// Standard REST Endpoints
router.get("/", getAllCompanies);
router.get("/:id", getCompanyById);
router.post("/", verifyAdmin, upload.single("companyLogo"), validate(createCompanySchema), createCompany);
router.patch("/:id", verifyAdmin, upload.single("companyLogo"), validate(updateCompanySchema), updateCompany);
router.delete("/:id", verifyAdmin, deleteCompany);

export default router;
