// PATH: backend/controllers/productController.js
import Product from "../models/productModel.js";

// Bundled catalog (images ship with the Flutter app under assets/images/products).
const CATALOG = [
  { legacyId: 1, name: "فلتر زيت تويوتا كورولا", category: "فلاتر", price: 120, oemNumber: "90915-10003", inStock: true, image: "assets/images/products/toyota_corolla_oil_filter.png", description: "فلتر زيت مخصص لتويوتا كورولا، يحمي المحرك ويحسّن كفاءة التشغيل." },
  { legacyId: 2, name: "فلتر هواء تويوتا كورولا", category: "فلاتر", price: 145, oemNumber: "17801-21050", inStock: true, image: "assets/images/products/toyota_corolla_air_filter.png", description: "فلتر هواء عالي الجودة يوفر تدفق هواء أنظف للمحرك." },
  { legacyId: 3, name: "فحمات فرامل أمامية تويوتا كورولا", category: "فرامل", price: 260, oemNumber: "04465-02220", inStock: true, image: "assets/images/products/toyota_corolla_brake_pads_front.png", description: "فحمات فرامل أمامية تمنح ثباتًا أفضل واستجابة آمنة." },
  { legacyId: 4, name: "شموع احتراق تويوتا كورولا", category: "بواجي", price: 190, oemNumber: "90919-01253", inStock: true, image: "assets/images/products/toyota_corolla_spark_plugs.png", description: "بواجي بجودة ممتازة لتحسين كفاءة الاشتعال واستهلاك الوقود." },
  { legacyId: 5, name: "فلتر هواء أودي A3", category: "فلاتر", price: 180, oemNumber: "1K0129620", inStock: true, image: "assets/images/products/audi_a3_engine_air_filter.png", description: "فلتر هواء لمحركات أودي A3 للحفاظ على نظافة الهواء الداخل." },
  { legacyId: 6, name: "فلتر مكيف أودي A3", category: "فلاتر", price: 160, oemNumber: "1K0819644B", inStock: true, image: "assets/images/products/audi_a3_cabin_filter.png", description: "فلتر مكيف داخلي يقلل الغبار ويوفر هواء أنظف داخل المقصورة." },
  { legacyId: 7, name: "طنابير أمامية أودي A3", category: "فرامل", price: 620, oemNumber: "1K0615301AA", inStock: false, image: "assets/images/products/audi_a3_front_brake_disc.png", description: "طنابير فرامل أمامية تتحمل الحرارة وتوفر أداء فرملة ثابت." },
  { legacyId: 8, name: "مساعد أمامي أودي A3", category: "تعليق", price: 780, oemNumber: "1K0413031BM", inStock: true, image: "assets/images/products/audi_a3_front_shock_absorber.png", description: "مساعد أمامي يحسّن الثبات والراحة ويقلل الاهتزازات." },
  { legacyId: 9, name: "طرمبة زيت BMW", category: "زيوت", price: 900, oemNumber: "11417501566", inStock: true, image: "assets/images/products/bmw_oil_pump.png", description: "طرمبة زيت عالية الكفاءة للحفاظ على ضغط الزيت المناسب." },
  { legacyId: 10, name: "فلتر زيت BMW", category: "فلاتر", price: 170, oemNumber: "11427512300", inStock: true, image: "assets/images/products/bmw_oil_filter.png", description: "فلتر زيت يوفر حماية أفضل للمحرك من الشوائب والرواسب." },
  { legacyId: 11, name: "فحمات فرامل BMW", category: "فرامل", price: 340, oemNumber: "34116794917", inStock: true, image: "assets/images/products/bmw_brake_pads.png", description: "فحمات فرامل توفر أداء كبح قوي وثابت للاستخدام اليومي." },
  { legacyId: 12, name: "مقص أمامي BMW", category: "تعليق", price: 850, oemNumber: "31126775959", inStock: false, image: "assets/images/products/bmw_front_control_arm.png", description: "مقص أمامي عالي التحمل يحسّن أداء نظام التعليق." },
];

// Idempotently ensure the catalog exists in the DB.
export const seedProducts = async () => {
  const count = await Product.estimatedDocumentCount();
  if (count > 0) return;
  for (const p of CATALOG) {
    await Product.updateOne(
      { legacyId: p.legacyId },
      { $set: p },
      { upsert: true }
    );
  }
};

const shape = (p) => ({
  id: p._id,
  name: p.name,
  description: p.description,
  price: p.price,
  image: p.image,
  category: p.category,
  oemNumber: p.oemNumber,
  inStock: p.inStock,
});

// GET /api/products?category=&search=
export const getProducts = async (req, res) => {
  try {
    await seedProducts();

    const query = {};
    const category = String(req.query.category || "").trim();
    const search = String(req.query.search || "").trim();
    if (category) query.category = category;
    if (search) query.name = { $regex: search, $options: "i" };

    const products = await Product.find(query).sort({ createdAt: 1 }).lean();
    return res.json({ success: true, products: products.map(shape) });
  } catch (err) {
    console.error("❌ getProducts:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// GET /api/products/categories
export const getCategories = async (req, res) => {
  try {
    await seedProducts();
    const cats = await Product.distinct("category");
    return res.json({
      success: true,
      categories: cats.filter((c) => c && c.trim()),
    });
  } catch (err) {
    console.error("❌ getCategories:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// GET /api/products/:id
export const getProductById = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id).lean();
    if (!p) {
      return res.status(404).json({ success: false, message: "المنتج غير موجود" });
    }
    return res.json({ success: true, product: shape(p) });
  } catch (err) {
    console.error("❌ getProductById:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};
