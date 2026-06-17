// PATH: backend/models/productModel.js
// Store/marketplace catalog products (DB-backed).
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    // Stable id used for idempotent seeding of the bundled catalog.
    legacyId: { type: Number, index: true, default: null },

    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },

    // Price in EGP (Egyptian Pounds).
    price: { type: Number, required: true, min: 0 },

    // Asset path (assets/...) or a remote URL.
    image: { type: String, default: "" },

    category: { type: String, default: "", trim: true, index: true },
    oemNumber: { type: String, default: "", trim: true },

    inStock: { type: Boolean, default: true },
    stock: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;
