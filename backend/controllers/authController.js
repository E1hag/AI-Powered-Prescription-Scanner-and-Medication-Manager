import supabase from "../config/supabaseClient.js";

// REGISTER 
const register = async (req, res) => {
  console.log("Register request received:", req.body.email);
  try {
    const { full_name, email, password, phone } = req.body;

    // Bug 1 Fix — check ALL empty fields first before anything else
    if (!full_name || !email || !password) {
      return res.status(400).json({ 
        error: "Full name, email and password are required" 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: "Password must be at least 6 characters" 
      });
    }

    // Bug 2 Fix — check if email already exists BEFORE calling signUp
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u) => u.email === email
    );

    if (emailExists) {
      console.log("Register failed: email already exists");
      return res.status(400).json({ 
        error: "An account with this email already exists" 
      });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.log("Supabase auth error:", authError.message);
      return res.status(400).json({ error: authError.message });
    }

    // Bug 3 Fix — double check user actually exists before inserting profile
    if (!authData.user || !authData.user.id) {
      console.log("Register failed: no user returned from Supabase");
      return res.status(400).json({ 
        error: "An account with this email already exists" 
      });
    }

    const userId = authData.user.id;
    console.log("Auth user created:", userId);

    // Insert profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      full_name,
      phone: phone || null,
      role: "clinician",
    });

    if (profileError) {
      console.log("Profile insert error:", profileError.message);
      return res.status(400).json({ error: profileError.message });
    }

    console.log("Profile created for:", email);
    res.status(201).json({
      message: "Clinician account created successfully. Redirecting to sign in.",
    });
  } catch (err) {
    console.error("Register server error:", err.message);
    res.status(500).json({ error: "Server error during registration" });
  }
};

// LOGIN 
const login = async (req, res) => {
  console.log("Login request received:", req.body.email);
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      console.log("Login failed: missing fields");
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Sign in with Supabase
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      console.log("Login failed: invalid credentials");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const userId = authData.user.id;
    const token = authData.session.access_token;
    console.log("Supabase auth passed for:", email);

    // Fetch profile and check role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, phone, role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.log("Login failed: profile not found");
      return res.status(404).json({ error: "Profile not found" });
    }

    if (profile.role !== "clinician") {
      console.log("Login failed: role is", profile.role, "not clinician");
      return res.status(403).json({
        error: "Access denied. This portal is for clinicians only.",
      });
    }

    console.log("Login successful for:", email, "| Role:", profile.role);
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: profile.id,
        full_name: profile.full_name,
        phone: profile.phone,
        role: profile.role,
      },
    });
  } catch (err) {
    console.error("Login server error:", err.message);
    res.status(500).json({ error: "Server error during login" });
  }
};

// LOGOUT 
const logout = async (req, res) => {
  console.log("Logout request received");
  try {
    await supabase.auth.signOut();
    console.log("Logout successful");
    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout server error:", err.message);
    res.status(500).json({ error: "Server error during logout" });
  }
};

export { register, login, logout };