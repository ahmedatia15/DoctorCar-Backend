// PATH: backend/utils/ensureTechnicianProfile.js
//
// Idempotently link a User (role=technician) to a Technician profile document.
// Returns the Technician doc (existing or newly created). Never throws on
// duplicates — falls back to fetching the existing row.
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

export async function ensureTechnicianProfile(user) {
  if (!user || !user._id) return null;
  if (user.role !== "technician") return null;

  let tech = await Technician.findOne({ user: user._id });
  if (tech) return tech;

  if (user.phone) {
    const byPhone = await Technician.findOne({ phone: user.phone });
    if (byPhone) {
      byPhone.user = user._id;
      if (!byPhone.name) byPhone.name = user.name;
      await byPhone.save();
      return byPhone;
    }
  }

  try {
    tech = await Technician.create({
      user: user._id,
      name: user.name || "Technician",
      phone: user.phone || `u_${String(user._id)}`,
      serviceType: mapSpecialty(user.specialty),
      governorate: user.governorate || "",
      specialty: user.specialty || "",
      location: {
        type: "Point",
        coordinates: [0, 0],
      },
      isAvailable: false,
      isOnline: false,
    });
    return tech;
  } catch (err) {
    if (err && err.code === 11000) {
      return await Technician.findOne({ user: user._id });
    }
    throw err;
  }
}

export default ensureTechnicianProfile;
