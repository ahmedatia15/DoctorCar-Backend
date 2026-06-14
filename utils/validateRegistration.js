// PATH: backend/utils/validateRegistration.js
// ============================================================
// Shared registration validation + normalization.
// Single source of truth used by BOTH /api/auth/register and
// /api/users/register so we never duplicate the rules.
// ============================================================

// ---- Allowed value lists (kept in English to match the API contract) ----
export const EGYPT_GOVERNORATES = [
  "Cairo",
  "Giza",
  "Alexandria",
  "Dakahlia",
  "Red Sea",
  "Beheira",
  "Fayoum",
  "Gharbia",
  "Ismailia",
  "Menofia",
  "Minya",
  "Qalyubia",
  "New Valley",
  "Suez",
  "Aswan",
  "Assiut",
  "Beni Suef",
  "Port Said",
  "Damietta",
  "Sharqia",
  "South Sinai",
  "Kafr El Sheikh",
  "Matrouh",
  "Luxor",
  "Qena",
  "North Sinai",
  "Sohag",
];

export const TECHNICIAN_SPECIALTIES = [
  "Mechanical Repair",
  "Electrical Repair",
  "Tire Service",
  "Battery Service",
  "Towing",
  "Emergency Assistance",
  "AC Repair",
  "Other",
];

export const ALLOWED_ROLES = ["customer", "technician"];

// ---- Regexes ----
// Letters (Latin + Arabic) and spaces only, 3..50 chars.
const NAME_REGEX = /^[A-Za-z؀-ۿ\s]{3,50}$/;
// Egyptian mobile: starts 010 / 011 / 012 / 015 then 8 digits = 11 total.
const EGYPT_PHONE_REGEX = /^01[0125]\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Min 8 chars, at least one lowercase, one uppercase, one digit.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// ---- Normalizers ----
export function normalizePhone(phone) {
  let p = String(phone || "").trim().replace(/[\s\-()]/g, "");

  // Convert common country-code forms to the local 0-prefixed format.
  if (p.startsWith("+20")) p = "0" + p.slice(3);
  else if (p.startsWith("0020")) p = "0" + p.slice(4);
  else if (p.startsWith("20") && p.length === 12) p = "0" + p.slice(2);

  return p.replace(/\D/g, "");
}

export function mapRole(role) {
  const r = String(role || "").trim().toLowerCase();

  if (["customer", "rider", "passenger", "user", "client"].includes(r)) {
    return "customer";
  }
  if (["technician", "driver", "mechanic", "tech", "service_provider"].includes(r)) {
    return "technician";
  }

  // Unknown / "admin" stays as-is so the validator rejects it.
  return r;
}

export function normalizeRegistration(body = {}) {
  return {
    name: String(body.name || "").trim().replace(/\s+/g, " "),
    email: String(body.email || "").trim().toLowerCase(),
    phone: normalizePhone(body.phone),
    governorate: String(body.governorate || "").trim(),
    password: String(body.password || ""),
    role: mapRole(body.role),
    vehicleType: String(body.vehicleType || "").trim(),
    specialty: String(body.specialty || "").trim(),
  };
}

// ---- Validator ----
// Returns an array of { field, message }. Empty array === valid.
export function validateRegistration(data = {}) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });

  // Name
  if (!data.name) {
    add("name", "Name is required");
  } else if (data.name.length < 3) {
    add("name", "Name must be at least 3 characters");
  } else if (data.name.length > 50) {
    add("name", "Name must be at most 50 characters");
  } else if (!NAME_REGEX.test(data.name)) {
    add("name", "Name must contain letters only");
  }

  // Phone
  if (!data.phone) {
    add("phone", "Phone number is required");
  } else if (!EGYPT_PHONE_REGEX.test(data.phone)) {
    add("phone", "Enter a valid Egyptian phone number");
  }

  // Email
  if (!data.email) {
    add("email", "Email is required");
  } else if (!EMAIL_REGEX.test(data.email)) {
    add("email", "Enter a valid email address");
  }

  // Governorate
  if (!data.governorate) {
    add("governorate", "Governorate is required");
  } else if (!EGYPT_GOVERNORATES.includes(data.governorate)) {
    add("governorate", "Please select a valid governorate");
  }

  // Password
  if (!data.password) {
    add("password", "Password is required");
  } else if (!PASSWORD_REGEX.test(data.password)) {
    add(
      "password",
      "Password must contain uppercase, lowercase letters and numbers"
    );
  }

  // Role
  if (!data.role) {
    add("role", "Role is required");
  } else if (!ALLOWED_ROLES.includes(data.role)) {
    add("role", "Invalid role");
  }

  // Role-specific
  if (data.role === "customer") {
    if (data.vehicleType) {
      if (data.vehicleType.length < 2 || data.vehicleType.length > 50) {
        add("vehicleType", "Vehicle type must be between 2 and 50 characters");
      }
    }
  }

  if (data.role === "technician") {
    if (!data.specialty) {
      add("specialty", "Please select your specialty");
    } else if (!TECHNICIAN_SPECIALTIES.includes(data.specialty)) {
      add("specialty", "Please select a valid specialty");
    }
  }

  return errors;
}
