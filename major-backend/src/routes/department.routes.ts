import { Router } from "express";
import { getAllDepartments } from "../controllers/department.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyJWT);

router.get("/", getAllDepartments);

export default router;
