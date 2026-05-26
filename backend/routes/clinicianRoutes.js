import express from "express";
import { getDashboard, requestAccess, getRequestHistory } from "../controllers/clinicianController.js";
import { verifyToken, verifyClinician } from "../middleware/authMiddleware.js";

const router = express.Router();

// All clinician routes are protected
router.use(verifyToken);
router.use(verifyClinician);

// GET  /api/clinician/dashboard
router.get("/dashboard", getDashboard);

// POST /api/clinician/request-access
router.post("/request-access", requestAccess);

// GET  /api/clinician/request-history
router.get("/request-history", getRequestHistory);

export default router;