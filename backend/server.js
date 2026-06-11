require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.get("/", (req, res) => {
  res.send("API running");
});

app.get("/prescriptions", async (req, res) => {
  const { data, error } = await supabase
    .from("prescriptions")
    .select("*");

  if (error) return res.status(400).json(error);
  res.json(data);
});

app.post("/prescriptions", async (req, res) => {
  const { medicine, dosage } = req.body;

  const { data, error } = await supabase
    .from("prescriptions")
    .insert([{ medicine, dosage }]);

  if (error) return res.status(400).json(error);
  res.json(data);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on " + PORT));
