import supabase from "../config/supabaseClient.js";

// Verify Token 
// Checks the Authorization header for a valid Supabase JWT
// Attaches the user to req.user for use in controllers
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = data.user;
    next();
  } catch (err) {
    console.error("verifyToken error:", err.message);
    res.status(500).json({ error: "Server error during token verification" });
  }
};

// Verify Clinician Role 
// After verifyToken, checks that the user's role is 'clinician'
// Prevents patients/caregivers from accessing clinician routes
const verifyClinician = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", req.user.id)
      .single();

    if (error || !data) {
      return res.status(403).json({ error: "Profile not found" });
    }

    if (data.role !== "clinician") {
      return res.status(403).json({ error: "Access denied. Clinicians only." });
    }

    req.userRole = data.role;
    next();
  } catch (err) {
    console.error("verifyClinician error:", err.message);
    res.status(500).json({ error: "Server error during role verification" });
  }
};

export { verifyToken, verifyClinician };