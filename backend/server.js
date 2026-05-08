import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// HTTP Request Logger 
// Shows every request in terminal: method, route, status, time
app.use(morgan("dev"));

//  Routes 
app.use("/api/auth", authRoutes);

// Health Check 
app.get("/", (req, res) => {
  res.json({ message: "MEDCO Backend is running" });
});

app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "API works fine" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});