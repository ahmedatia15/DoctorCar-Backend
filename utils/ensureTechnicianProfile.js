// PATH: backend/utils/ensureTechnicianProfile.js
//
// Idempotently link a User (role=technician) to a Technician profile document.
// Returns the Technician doc (existing or newly created). Resilient to phone
// collisions and concurrent calls — falls back to a per-user-unique phone token
// so a valid technician user always ends up with a profile.
import Technician from "../models/technicianModel.js";

const VALID_SPECIALTIES = ["tow", "battery", "fuel", "tire", "ride"];

const mapSpecialty = (raw) => {
  const s = String(raw || "").trim().toLowerCase();
  if (VALID_SPECIALTIES.includes(s)) return s;
  if (s.includes("سحب") || s.includes("ونش")) return "tow";
  if (s.includes("بطار") || s.includes("battery")) return "battery";
  if (s.includes("بنزين") || s.includes("ديزل") || s.includes("وقود")) return "fuel";
  if (s.includes("كاوتش") || s.includes("إطار") || s.includes("tire")) return "tire";
  return "tow";
};

const basePayload = (user) => ({
  user: user._id,
  name: user.name || "Technician",
  serviceType: mapSpecialty(user.specialty),
  governorate: user.governorate || "",
  specialty: user.specialty || "",
  location: { type: "Point", coordinates: [0, 0] },
  isAvailable: false,
  isOnline: false,
});

export async function ensureTechnicianProfile(user) {
  if (!user || !user._id) return null;
  if (user.role !== "technician") return null;

  // 1) Already linked? Return it.
  const existing = await Technician.findOne({ user: user._id });
  if (existing) return existing;

  // 2) An orphan / legacy doc with this phone? Try to link it. If the doc is
  //    stale (missing now-required fields), swallow the error and fall through
  //    to the create path instead of bubbling a validation 500.
  if (user.phone) {
    try {
      const byPhone = await Technician.findOne({ phone: user.phone });
      if (byPhone) {
        byPhone.user = user._id;
        if (!byPhone.name) byPhone.name = user.name || "Technician";
        if (!byPhone.serviceType) byPhone.serviceType = mapSpecialty(user.specialty);
        if (!byPhone.location || !Array.isArray(byPhone.location.coordinates)) {
          byPhone.location = { type: "Point", coordinates: [0, 0] };
        }
        await byPhone.save();
        return byPhone;
      }
    } catch (err) {
      console.warn("⚠️ ensureTechnicianProfile (link by phone):", err?.message);
    }
  }

  // 3) Create fresh. On any failure re-fetch by user (handles concurrent
  //    creators) and, for phone-collision 11000s, retry with a per-user-unique
  //    phone token so a valid technician is never left without a profile.
  const userPhoneFallback = `u_${String(user._id)}`;

  try {
    return await Technician.create({
      ...basePayload(user),
      phone: user.phone || userPhoneFallback,
    });
  } catch (err) {
    const linked = await Technician.findOne({ user: user._id });
    if (linked) return linked;

    if (err && err.code === 11000) {
      try {
        return await Technician.create({
          ...basePayload(user),
          phone: userPhoneFallback,
        });
      } catch (err2) {
        const linked2 = await Technician.findOne({ user: user._id });
        if (linked2) return linked2;
        console.error(
          "❌ ensureTechnicianProfile (fallback create):",
          err2?.message
        );
      }
    } else {
      console.error("❌ ensureTechnicianProfile (create):", err?.message);
    }
    return null;
  }
}

export default ensureTechnicianProfile;
