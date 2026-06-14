// PATH: backend/models/centerModel.js
import mongoose from "mongoose";

const centerSchema = new mongoose.Schema(
  {
    // ✅ Optional: Google Place ID
    // - Optional so manual import works without Google/Billing
    // - Uniqueness enforced via partial index below (NOT index: true here)
    placeId: {
      type: String,
      default: null,
      trim: true,
    },

    name: {
      type: String,
      required: [true, "Center name is required"],
      trim: true,
      minlength: [2, "Center name is too short"],
      maxlength: [200, "Center name is too long"],
    },

    address: { type: String, default: "", trim: true, maxlength: 500 },

    phone: { type: String, default: "", trim: true, maxlength: 50 },

    governorate: { type: String, default: "", trim: true, maxlength: 100 }, // دمياط.. إلخ
    city: { type: String, default: "", trim: true, maxlength: 100 }, // دمياط الجديدة.. إلخ

    rating: { type: Number, default: 0, min: 0, max: 5 },
    userRatingsTotal: { type: Number, default: 0, min: 0 },

    imageUrl: { type: String, default: "", trim: true, maxlength: 2000 },

    // types (manual or google)
    types: { type: [String], default: [] },

    // data source: manual | google
    source: {
      type: String,
      default: "manual",
      trim: true,
      enum: ["manual", "google"],
    },

    lastSyncedAt: { type: Date, default: Date.now },

    // ✅ GeoJSON Location [lng, lat]
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: [true, "location.coordinates is required"],
        validate: {
          validator: function (arr) {
            if (!Array.isArray(arr) || arr.length !== 2) return false;
            const [lng, lat] = arr;
            return (
              Number.isFinite(lat) &&
              Number.isFinite(lng) &&
              lat >= -90 &&
              lat <= 90 &&
              lng >= -180 &&
              lng <= 180
            );
          },
          message: "location.coordinates must be [lng, lat] valid numbers",
        },
      },
    },
  },
  { timestamps: true, minimize: true }
);

/* ---------------------------- Normalization ---------------------------- */
centerSchema.pre("save", function (next) {
  // normalize empty strings
  if (this.placeId === "") this.placeId = null;
  if (this.governorate) this.governorate = this.governorate.trim();
  if (this.city) this.city = this.city.trim();
  if (this.name) this.name = this.name.trim();
  next();
});

/* ------------------------------- Indexes -------------------------------- */
// ✅ Required for $geoNear
centerSchema.index({ location: "2dsphere" });

// ✅ Unique placeId ONLY when it exists (prevents dup key on null)
centerSchema.index(
  { placeId: 1 },
  { unique: true, partialFilterExpression: { placeId: { $type: "string" } } }
);

// ✅ Useful filters
centerSchema.index({ source: 1 });
centerSchema.index({ governorate: 1, city: 1 });

const Center = mongoose.model("Center", centerSchema);
export default Center;
