// PATH: backend/models/centerReviewModel.js
// Per-center user reviews (rating + comment), persisted to the database.
import mongoose from "mongoose";

const centerReviewSchema = new mongoose.Schema(
  {
    center: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Center",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: { type: String, default: "مستخدم", trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

centerReviewSchema.index({ center: 1, createdAt: -1 });

const CenterReview =
  mongoose.models.CenterReview ||
  mongoose.model("CenterReview", centerReviewSchema);

export default CenterReview;
