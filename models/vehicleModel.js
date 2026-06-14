import mongoose from "mongoose";

const maintenanceSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // مثال: تغيير زيت – فرامل – اطارات
    date: { type: Date, required: true },
    km: { type: Number, required: true },   // الكيلومترات وقت الصيانة
    cost: { type: Number, default: 0 },     // تكلفة الصيانة
    notes: { type: String, default: "" },   // ملاحظات
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ============================
    //  بيانات أساسية
    // ============================
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },

    fuel: {
      type: String,
      required: true,
      enum: ["بنزين", "ديزل", "كهرباء", "هايبرد", "غير محدد"],
      default: "غير محدد",
    },

    condition: {
      type: String,
      required: true,
      enum: ["ممتازة", "جيدة جدًا", "جيدة", "تحتاج صيانة"],
      default: "جيدة",
    },

    plateNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    chassisNumber: {
      type: String,
      default: "",
    },

    color: { type: String, default: "غير محدد" },

    year: { type: String, default: "غير معروف" },

    // ============================
    //  بيانات Dashboard
    // ============================
    odometer: { type: Number, default: 0 }, // عداد الكيلومترات

    carStatus: { type: String, default: "جيدة" },

    nextServiceKm: { type: Number, default: 5000 },

    oilChangeDate: { type: Date, default: null },

    batteryChangeDate: { type: Date, default: null },

    tireChangeDate: { type: Date, default: null },

    // ============================
    //  سجل الصيانة
    // ============================
    maintenanceHistory: [maintenanceSchema],
  },
  { timestamps: true }
);

// 🧼 تطبيع plateNumber
vehicleSchema.pre("save", function (next) {
  if (this.plateNumber) {
    this.plateNumber = this.plateNumber.toUpperCase().trim();
  }
  next();
});

// حل OverwriteModelError
const Vehicle =
  mongoose.models.Vehicle || mongoose.model("Vehicle", vehicleSchema);

export default Vehicle;
