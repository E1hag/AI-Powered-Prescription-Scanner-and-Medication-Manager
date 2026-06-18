import express from "express";
import {
  getDashboard,
  requestAccess,
  getRequestHistory,
  getPatientSummary,
  getMyPatients,
  getAdherenceTrends,
  addTreatmentNote,
  getTreatmentNotes,
  getDrugInteractions,
} from "../controllers/clinicianController.js";
import { verifyToken, verifyClinician } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(verifyToken);
router.use(verifyClinician);

router.get("/dashboard", getDashboard);
router.post("/request-access", requestAccess);
router.get("/request-history", getRequestHistory);
router.get("/my-patients", getMyPatients);
router.get("/patient-summary/:patientId", getPatientSummary);
router.get("/adherence/:patientId", getAdherenceTrends);
router.post("/notes", addTreatmentNote);
router.get("/notes/:patientId", getTreatmentNotes);
router.get("/interactions/:patientId", getDrugInteractions);

export default router;