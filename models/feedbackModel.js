import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "يجب إدخال رقم الطلب"],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "يجب إدخال المستخدم"],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: [true, "يجب إدخال التقييم بين 1 و 5"],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Feedback = mongoose.model("Feedback", feedbackSchema);
export default Feedback;
