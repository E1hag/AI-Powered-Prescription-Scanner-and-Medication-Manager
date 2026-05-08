import express from "express";
import { register, login, logout } from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/auth/register — clinician sign up
router.post("/register", register);

// POST /api/auth/login — clinician sign in
router.post("/login", login);

// POST /api/auth/logout — clinician sign out (protected)
router.post("/logout", verifyToken, logout);

export default router;