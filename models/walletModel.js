import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balance: { type: Number, default: 0 },
    transactions: [
      {
        amount: Number,
        type: { type: String, enum: ["credit", "debit"] }, // credit = إضافة, debit = خصم
        description: String,
        date: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

const Wallet = mongoose.model("Wallet", walletSchema);
export default Wallet;
