import { Router } from "express";
import {
    createCompany,
    getAllCompanies,
    getCompanyById,
    updateCompany
} from "../controllers/company.controller.js";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createCompanySchema, updateCompanySchema } from "../schemas/company.schema.js";

const router = Router();
router.use(verifyJWT);

// Specific Named Routes
router.get("/all-companies", getAllCompanies);
router.post("/create-company", verifyAdmin, createCompany);
router.patch("/:id/deactivate", verifyAdmin, updateCompany);
router.patch("/:id/reactivate", verifyAdmin, updateCompany);

// Standard REST Endpoints
router.get("/", getAllCompanies);
router.get("/:id", getCompanyById);
router.post("/", verifyAdmin, validate(createCompanySchema), createCompany);
router.patch("/:id", verifyAdmin, validate(updateCompanySchema), updateCompany);

export default router;
