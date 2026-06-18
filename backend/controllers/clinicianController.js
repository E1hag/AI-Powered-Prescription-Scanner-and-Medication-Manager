import supabase from "../config/supabaseClient.js";

// ─── DASHBOARD ───────────────────────────────────────────────
const getDashboard = async (req, res) => {
  console.log("📥 Dashboard request for clinician:", req.user.id);
  try {
    const clinicianId = req.user.id;

    const { data: accessList, error: accessError } = await supabase
      .from("clinician_access_requests")
      .select("patient_id, status, requested_at")
      .eq("clinician_id", clinicianId);

    if (accessError) return res.status(400).json({ error: accessError.message });

    const approvedIds = accessList.filter((a) => a.status === "approved").map((a) => a.patient_id);
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
        .from("dose_logs")
        .select("status")
        .eq("user_id", p.id);

        const total = doses?.length || 0;
        const taken = doses?.filter((d) => d.status === "Taken").length || 0;
          const adherence_pct = total > 0 ? Math.round((taken / total) * 100) : 0;

       const { data: lastPrescription } = await supabase
        .from("prescriptions")
        .select("visit_date")
        .eq("patient_id", p.id)
        .not("visit_date", "is", null)
        .order("visit_date", { ascending: false })
        .limit(1)
        .single();

          return {
            id: p.id,
            full_name: p.full_name,
            patient_code: p.patient_code,
            adherence_pct,
            last_visit: lastPrescription?.visit_date || null,
          };
        })
      );
    }

    const activeAlerts = recentPatients.filter((p) => p.adherence_pct < 60).length;
    const avgAdherence =
      recentPatients.length > 0
        ? Math.round(recentPatients.reduce((sum, p) => sum + p.adherence_pct, 0) / recentPatients.length)
        : 0;

    console.log("✅ Dashboard loaded");
    res.status(200).json({
      stats: { totalPatients: approvedIds.length, pendingRequests: pendingCount, activeAlerts, avgAdherence },
      recentPatients,
    });
  } catch (err) {
    console.error("❌ Dashboard error:", err.message);
    res.status(500).json({ error: "Server error loading dashboard" });
  }
};

// ─── REQUEST ACCESS ───────────────────────────────────────────
const requestAccess = async (req, res) => {
  console.log("📥 Request access from clinician:", req.user.id);
  try {
    const clinicianId = req.user.id;
    const { patient_code, reason } = req.body;

    if (!patient_code) return res.status(400).json({ error: "Patient code is required" });

    const { data: patient, error: patientError } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("patient_code", patient_code.trim().toUpperCase())
      .single();

    if (patientError || !patient) return res.status(404).json({ error: "No patient found with this ID" });
    if (patient.role !== "patient") return res.status(400).json({ error: "This code does not belong to a patient" });

    const { data: existing } = await supabase
      .from("clinician_access_requests")
      .select("id, status")
      .eq("clinician_id", clinicianId)
      .eq("patient_id", patient.id)
      .single();

    if (existing) {
      if (existing.status === "pending") return res.status(400).json({ error: "You already have a pending request for this patient" });
      if (existing.status === "approved") return res.status(400).json({ error: "You already have approved access to this patient" });

      await supabase
        .from("clinician_access_requests")
        .update({ status: "pending", requested_at: new Date(), responded_at: null, reason: reason || null })
        .eq("id", existing.id);

      return res.status(200).json({ message: "Access re-requested successfully. Waiting for patient approval." });
    }

    const { error: insertError } = await supabase
      .from("clinician_access_requests")
      .insert({ clinician_id: clinicianId, patient_id: patient.id, status: "pending", reason: reason || null });

    if (insertError) return res.status(400).json({ error: insertError.message });

    await supabase.from("audit_logs").insert({
      actor_id: clinicianId,
      action: "request_access",
      target_patient_id: patient.id,
      metadata: { patient_code, reason },
    });

    console.log("✅ Access requested for:", patient.full_name);
    res.status(201).json({ message: `Access request sent to ${patient.full_name}. Waiting for patient approval.` });
  } catch (err) {
    console.error("❌ Request access error:", err.message);
    res.status(500).json({ error: "Server error during access request" });
  }
};

// ─── GET REQUEST HISTORY ──────────────────────────────────────
const getRequestHistory = async (req, res) => {
  console.log("📥 Request history for clinician:", req.user.id);
  try {
    const clinicianId = req.user.id;

    const { data, error } = await supabase
      .from("clinician_access_requests")
      .select("id, status, requested_at, responded_at, patient_id, reason")
      .eq("clinician_id", clinicianId)
      .order("requested_at", { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

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

// Patient Summary patient
const getPatientSummary = async (req, res) => {
  console.log("📥 Patient summary request for:", req.params.patientId);
  try {
    const clinicianId = req.user.id;
    const { patientId } = req.params;

    const { data: access } = await supabase
      .from("clinician_access_requests")
      .select("status")
      .eq("clinician_id", clinicianId)
      .eq("patient_id", patientId)
      .single();

    if (!access || access.status !== "approved")
      return res.status(403).json({ error: "Access denied. Patient has not approved your request." });

    const { data: patient, error: patientError } = await supabase
      .from("profiles")
      .select("id, full_name, patient_code, phone, email, gender, date_of_birth, allergies, conditions")
      .eq("id", patientId)
      .single();

    if (patientError || !patient)
      return res.status(404).json({ error: "Patient not found" });

    // Get prescriptions for this patient
    const { data: prescriptions } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("patient_id", patientId);

    const prescriptionIds = (prescriptions || []).map((p) => p.id);

    // Get extracted medications
    let medications = [];
    if (prescriptionIds.length > 0) {
      const { data: extractedMeds } = await supabase
        .from("extracted_medications")
        .select("id, medication_name, strength_text, dosage_text, frequency_text, timing_text, duration_text, notes_text")
        .in("prescription_id", prescriptionIds);
      medications = extractedMeds || [];
    }

    // Calculate adherence per medication from dose_logs
    const medicationsWithAdherence = await Promise.all(
      medications.map(async (med) => {
        try {
          const { data: doses } = await supabase
            .from("dose_logs")
            .select("status")
            .eq("user_id", patientId)
            .eq("medication_name", med.medication_name);

          const total = doses?.length || 0;
          const taken = doses?.filter((d) => d.status === "Taken").length || 0;

          return {
            id: med.id,
            drug_name: med.medication_name,
            dosage: med.dosage_text || med.strength_text || "—",
            frequency: med.frequency_text || "—",
            instructions: med.notes_text || med.timing_text || null,
            schedule_times: "",
            adherence_pct: total > 0 ? Math.round((taken / total) * 100) : 0,
          };
        } catch {
          return {
            id: med.id,
            drug_name: med.medication_name,
            dosage: med.dosage_text || "—",
            frequency: med.frequency_text || "—",
            instructions: med.notes_text || null,
            schedule_times: "",
            adherence_pct: 0,
          };
        }
      })
    );

    const overallAdherence = medicationsWithAdherence.length > 0
      ? Math.round(medicationsWithAdherence.reduce((sum, m) => sum + m.adherence_pct, 0) / medicationsWithAdherence.length)
      : 0;

    const { data: interactions } = await supabase
      .from("drug_interaction_results")
      .select("drug_a, drug_b, severity, description, recommendation")
      .eq("patient_id", patientId);

    await supabase.from("audit_logs").insert({
      actor_id: clinicianId,
      action: "view_patient_summary",
      target_patient_id: patientId,
    });

    console.log("✅ Patient summary loaded for:", patient.full_name);
    res.status(200).json({
      patient,
      medications: medicationsWithAdherence,
      overallAdherence,
      interactions: interactions || [],
    });
  } catch (err) {
    console.error("❌ Patient summary error:", err.message);
    res.status(500).json({ error: "Server error loading patient summary" });
  }
};

// ─── MY PATIENTS ─────────────────────────────────────────────
const getMyPatients = async (req, res) => {
  console.log("📥 My patients request for clinician:", req.user.id);
  try {
    const clinicianId = req.user.id;

    const { data: accessList } = await supabase
      .from("clinician_access_requests")
      .select("patient_id")
      .eq("clinician_id", clinicianId)
      .eq("status", "approved");

    const patientIds = (accessList || []).map((a) => a.patient_id);
    if (patientIds.length === 0) return res.status(200).json({ patients: [] });

    const { data: patients } = await supabase
      .from("profiles")
      .select("id, full_name, patient_code, phone, gender")
      .in("id", patientIds);

    console.log("✅ My patients loaded");
    res.status(200).json({ patients: patients || [] });
  } catch (err) {
    console.error("❌ My patients error:", err.message);
    res.status(500).json({ error: "Server error loading patients" });
  }
};

// ─── ADHERENCE TRENDS ─────────────────────────────────────────
// GET /api/clinician/adherence/:patientId?days=7
const getAdherenceTrends = async (req, res) => {
  console.log("📥 Adherence trends for:", req.params.patientId);
  try {
    const clinicianId = req.user.id;
    const { patientId } = req.params;
    const days = parseInt(req.query.days) || 7;

    const { data: access } = await supabase
      .from("clinician_access_requests")
      .select("status")
      .eq("clinician_id", clinicianId)
      .eq("patient_id", patientId)
      .single();

    if (!access || access.status !== "approved")
      return res.status(403).json({ error: "Access denied." });

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Use dose_logs instead of dose_events
    const { data: doses } = await supabase
      .from("dose_logs")
      .select("status, logged_at, medication_name")
      .eq("user_id", patientId)
      .gte("logged_at", fromDate.toISOString())
      .order("logged_at", { ascending: true });

    const dailyMap = {};
    (doses || []).forEach((d) => {
      const day = d.logged_at.split("T")[0];
      if (!dailyMap[day]) dailyMap[day] = { date: day, taken: 0, missed: 0, snoozed: 0 };
      if (d.status === "Taken") dailyMap[day].taken++;
      else if (d.status === "Missed") dailyMap[day].missed++;
    });

    const dailyData = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      dailyData.push(dailyMap[dateStr] || { date: dateStr, taken: 0, missed: 0, snoozed: 0 });
    }

    const totalTaken = doses?.filter((d) => d.status === "Taken").length || 0;
    const totalMissed = doses?.filter((d) => d.status === "Missed").length || 0;
    const totalSnoozed = 0;
    const totalDoses = totalTaken + totalMissed;
    const overallPct = totalDoses > 0 ? Math.round((totalTaken / totalDoses) * 100) : 0;

    let currentStreak = 0;
    for (let i = dailyData.length - 1; i >= 0; i--) {
      const day = dailyData[i];
      if (day.taken > 0 && day.missed === 0) currentStreak++;
      else break;
    }

    const daysWithActivity = dailyData.filter((d) => d.taken + d.missed > 0);
    const bestDay = daysWithActivity.reduce((best, d) => {
      const pct = Math.round((d.taken / (d.taken + d.missed)) * 100);
      const bestPct = best ? Math.round((best.taken / (best.taken + best.missed)) * 100) : -1;
      return pct > bestPct ? d : best;
    }, null);
    const needsWorkDay = daysWithActivity.reduce((worst, d) => {
      const pct = Math.round((d.taken / (d.taken + d.missed)) * 100);
      const worstPct = worst ? Math.round((worst.taken / (worst.taken + worst.missed)) * 100) : 101;
      return pct < worstPct ? d : worst;
    }, null);
    const formatDayName = (dateStr) =>
      new Date(dateStr).toLocaleDateString("en-GB", { weekday: "long" });

    // Use extracted_medications instead of medications
    const { data: prescriptions } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("patient_id", patientId);

    const prescriptionIds = (prescriptions || []).map((p) => p.id);
    let extractedMeds = [];
    if (prescriptionIds.length > 0) {
      const { data: meds } = await supabase
        .from("extracted_medications")
        .select("id, medication_name, dosage_text, strength_text")
        .in("prescription_id", prescriptionIds);
      extractedMeds = meds || [];
    }

    const medAdherence = await Promise.all(
      extractedMeds.map(async (med) => {
        const { data: medDoses } = await supabase
          .from("dose_logs")
          .select("status")
          .eq("user_id", patientId)
          .eq("medication_name", med.medication_name)
          .gte("logged_at", fromDate.toISOString());

        const taken = medDoses?.filter((d) => d.status === "Taken").length || 0;
        const missed = medDoses?.filter((d) => d.status === "Missed").length || 0;
        const total = taken + missed;

        return {
          id: med.id,
          drug_name: med.medication_name,
          dosage: med.dosage_text || med.strength_text || "—",
          taken,
          missed,
          adherence_pct: total > 0 ? Math.round((taken / total) * 100) : 0,
        };
      })
    );

    console.log("✅ Adherence trends loaded");
    res.status(200).json({
      dailyData,
      stats: {
        totalTaken, totalMissed, totalSnoozed, overallPct, currentStreak,
        bestDay: bestDay ? formatDayName(bestDay.date) : "—",
        needsWorkDay: needsWorkDay ? formatDayName(needsWorkDay.date) : "—",
      },
      medAdherence,
    });
  } catch (err) {
    console.error("❌ Adherence trends error:", err.message);
    res.status(500).json({ error: "Server error loading adherence trends" });
  }
};

// ─── ADD TREATMENT NOTE ───────────────────────────────────────
// POST /api/clinician/notes
const addTreatmentNote = async (req, res) => {
  console.log("📥 Add treatment note from clinician:", req.user.id);
  try {
    const clinicianId = req.user.id;
    const { patient_id, note_text, note_type } = req.body;

    if (!patient_id || !note_text) {
      return res.status(400).json({ error: "Patient ID and note content are required" });
    }

    // Verify access
    const { data: access } = await supabase
      .from("clinician_access_requests")
      .select("status")
      .eq("clinician_id", clinicianId)
      .eq("patient_id", patient_id)
      .single();

    if (!access || access.status !== "approved")
      return res.status(403).json({ error: "Access denied." });

    // Insert note
    const { error: insertError } = await supabase
      .from("treatment_notes")
      .insert({
        clinician_id: clinicianId,
        patient_id,
        note_text,
        note_type: note_type || "General Observation",
      });

    if (insertError) {
      console.log("❌ Note insert error:", insertError.message);
      return res.status(400).json({ error: insertError.message });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      actor_id: clinicianId,
      action: "add_treatment_note",
      target_patient_id: patient_id,
      metadata: { note_type },
    });

    console.log("✅ Treatment note added");
    res.status(201).json({ message: "Treatment note saved successfully." });
  } catch (err) {
    console.error("❌ Add note error:", err.message);
    res.status(500).json({ error: "Server error adding treatment note" });
  }
};

// ─── GET TREATMENT NOTES ──────────────────────────────────────
// GET /api/clinician/notes/:patientId
const getTreatmentNotes = async (req, res) => {
  console.log("📥 Get treatment notes for:", req.params.patientId);
  try {
    const clinicianId = req.user.id;
    const { patientId } = req.params;

    // Verify access
    const { data: access } = await supabase
      .from("clinician_access_requests")
      .select("status")
      .eq("clinician_id", clinicianId)
      .eq("patient_id", patientId)
      .single();

    if (!access || access.status !== "approved")
      return res.status(403).json({ error: "Access denied." });

    // Fetch notes with clinician name
    const { data: notes, error } = await supabase
      .from("treatment_notes")
      .select("id, note_text, note_type, created_at, clinician_id")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    // Enrich with clinician name
    const enriched = await Promise.all(
      (notes || []).map(async (note) => {
        const { data: clinician } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", note.clinician_id)
          .single();

        return {
          id: note.id,
          note_text: note.note_text,
          note_type: note.note_type || "General Observation",
          created_at: note.created_at,
          clinician_name: clinician?.full_name ? `Dr. ${clinician.full_name}` : "Unknown",
        };
      })
    );

    console.log("✅ Treatment notes loaded");
    res.status(200).json({ notes: enriched });
  } catch (err) {
    console.error("❌ Get notes error:", err.message);
    res.status(500).json({ error: "Server error loading treatment notes" });
  }
};

// ─── DRUG INTERACTIONS ────────────────────────────────────────
// GET /api/clinician/interactions/:patientId
const getDrugInteractions = async (req, res) => {
  console.log("📥 Drug interactions for:", req.params.patientId);
  try {
    const clinicianId = req.user.id;
    const { patientId } = req.params;
 
    // Verify access
    const { data: access } = await supabase
      .from("clinician_access_requests")
      .select("status")
      .eq("clinician_id", clinicianId)
      .eq("patient_id", patientId)
      .single();
 
    if (!access || access.status !== "approved")
      return res.status(403).json({ error: "Access denied." });
 
    // Fetch detected interactions for this patient
      const { data: interactions, error } = await supabase
      .from("drug_interaction_results")
      .select("id, drug_a, drug_b, severity, description, recommendation, source, checked_at")
      .eq("patient_id", patientId)
      .order("checked_at", { ascending: false });
    
    if (error) return res.status(400).json({ error: error.message });
 
    // Get patient's active medications for context
    const { data: prescriptions } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("patient_id", patientId);
 
    const prescriptionIds = (prescriptions || []).map((p) => p.id);
    let medications = [];
    if (prescriptionIds.length > 0) {
      const { data: meds } = await supabase
        .from("extracted_medications")
        .select("medication_name")
        .in("prescription_id", prescriptionIds);
      medications = meds || [];
    }
 
    // Summary counts
    const highCount = (interactions || []).filter((i) => i.severity?.toLowerCase() === "high").length;
    const moderateCount = (interactions || []).filter((i) => i.severity?.toLowerCase() === "moderate").length;
    const lowCount = (interactions || []).filter((i) => i.severity?.toLowerCase() === "low").length;
 
    console.log("✅ Drug interactions loaded");
    res.status(200).json({
      interactions: interactions || [],
      currentMedications: medications.map((m) => m.medication_name),
      summary: {
        total: (interactions || []).length,
        high: highCount,
        moderate: moderateCount,
        low: lowCount,
      },
    });
  } catch (err) {
    console.error("❌ Drug interactions error:", err.message);
    res.status(500).json({ error: "Server error loading drug interactions" });
  }
};
 

export { getDashboard, requestAccess, getRequestHistory, getPatientSummary, getMyPatients, getAdherenceTrends, addTreatmentNote, getTreatmentNotes, getDrugInteractions };