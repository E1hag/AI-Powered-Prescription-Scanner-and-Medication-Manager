import supabase from "../config/supabaseClient.js";

// ─── DASHBOARD ───────────────────────────────────────────────
// GET /api/clinician/dashboard
const getDashboard = async (req, res) => {
  console.log("📥 Dashboard request for clinician:", req.user.id);
  try {
    const clinicianId = req.user.id;

    const { data: accessList, error: accessError } = await supabase
      .from("clinician_access_requests")
      .select("patient_id, status, requested_at")
      .eq("clinician_id", clinicianId);

    if (accessError) {
      console.log("❌ Access list error:", accessError.message);
      return res.status(400).json({ error: accessError.message });
    }

    const approvedIds = accessList
      .filter((a) => a.status === "approved")
      .map((a) => a.patient_id);

    const pendingCount = accessList.filter((a) => a.status === "pending").length;

    let recentPatients = [];
    if (approvedIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, patient_code")
        .in("id", approvedIds);

      recentPatients = await Promise.all(
        (profiles || []).map(async (p) => {
          const { data: doses } = await supabase
            .from("dose_events")
            .select("status")
            .eq("patient_id", p.id)
            .neq("status", "pending");

          const total = doses?.length || 0;
          const taken = doses?.filter((d) => d.status === "taken").length || 0;
          const adherence_pct = total > 0 ? Math.round((taken / total) * 100) : 0;

          return {
            id: p.id,
            full_name: p.full_name,
            patient_code: p.patient_code,
            adherence_pct,
            last_visit: null,
          };
        })
      );
    }

    const activeAlerts = recentPatients.filter((p) => p.adherence_pct < 60).length;
    const avgAdherence =
      recentPatients.length > 0
        ? Math.round(
            recentPatients.reduce((sum, p) => sum + p.adherence_pct, 0) /
              recentPatients.length
          )
        : 0;

    console.log("✅ Dashboard loaded for clinician:", clinicianId);
    res.status(200).json({
      stats: {
        totalPatients: approvedIds.length,
        pendingRequests: pendingCount,
        activeAlerts,
        avgAdherence,
      },
      recentPatients,
    });
  } catch (err) {
    console.error("❌ Dashboard error:", err.message);
    res.status(500).json({ error: "Server error loading dashboard" });
  }
};

// ─── REQUEST ACCESS ───────────────────────────────────────────
// POST /api/clinician/request-access
const requestAccess = async (req, res) => {
  console.log("📥 Request access from clinician:", req.user.id);
  try {
    const clinicianId = req.user.id;
    const { patient_code, reason } = req.body;

    if (!patient_code) {
      return res.status(400).json({ error: "Patient code is required" });
    }

    const { data: patient, error: patientError } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("patient_code", patient_code.trim().toUpperCase())
      .single();

    if (patientError || !patient) {
      console.log("❌ Patient not found:", patient_code);
      return res.status(404).json({ error: "No patient found with this ID" });
    }

    if (patient.role !== "patient") {
      return res.status(400).json({ error: "This code does not belong to a patient" });
    }

    const { data: existing } = await supabase
      .from("clinician_access_requests")
      .select("id, status")
      .eq("clinician_id", clinicianId)
      .eq("patient_id", patient.id)
      .single();

    if (existing) {
      if (existing.status === "pending") {
        return res.status(400).json({ error: "You already have a pending request for this patient" });
      }
      if (existing.status === "approved") {
        return res.status(400).json({ error: "You already have approved access to this patient" });
      }

      await supabase
        .from("clinician_access_requests")
        .update({ status: "pending", requested_at: new Date(), responded_at: null, reason: reason || null })
        .eq("id", existing.id);

      console.log("✅ Re-requested access for patient:", patient.full_name);
      return res.status(200).json({ message: "Access re-requested successfully. Waiting for patient approval." });
    }

    const { error: insertError } = await supabase
      .from("clinician_access_requests")
      .insert({
        clinician_id: clinicianId,
        patient_id: patient.id,
        status: "pending",
        reason: reason || null,
      });

    if (insertError) {
      console.log("❌ Insert error:", insertError.message);
      return res.status(400).json({ error: insertError.message });
    }

    await supabase.from("audit_logs").insert({
      actor_id: clinicianId,
      action: "request_access",
      target_patient_id: patient.id,
      metadata: { patient_code, reason },
    });

    console.log("✅ Access requested for patient:", patient.full_name);
    res.status(201).json({
      message: `Access request sent to ${patient.full_name}. Waiting for patient approval.`,
    });
  } catch (err) {
    console.error("❌ Request access error:", err.message);
    res.status(500).json({ error: "Server error during access request" });
  }
};

// ─── GET REQUEST HISTORY ──────────────────────────────────────
// GET /api/clinician/request-history
const getRequestHistory = async (req, res) => {
  console.log("📥 Request history for clinician:", req.user.id);
  try {
    const clinicianId = req.user.id;

    const { data, error } = await supabase
      .from("clinician_access_requests")
      .select("id, status, requested_at, responded_at, patient_id, reason")
      .eq("clinician_id", clinicianId)
      .order("requested_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const enriched = await Promise.all(
      (data || []).map(async (item) => {
        const { data: patient } = await supabase
          .from("profiles")
          .select("full_name, patient_code")
          .eq("id", item.patient_id)
          .single();

        return {
          id: item.id,
          status: item.status,
          requested_at: item.requested_at,
          patient_name: patient?.full_name || "Unknown",
          patient_code: patient?.patient_code || "—",
          reason: item.reason || "—",
        };
      })
    );

    console.log("✅ Request history loaded");
    res.status(200).json({ history: enriched });
  } catch (err) {
    console.error("❌ Request history error:", err.message);
    res.status(500).json({ error: "Server error loading request history" });
  }
};

export { getDashboard, requestAccess, getRequestHistory };