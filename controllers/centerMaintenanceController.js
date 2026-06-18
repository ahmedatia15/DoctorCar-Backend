// PATH: backend/controllers/centerMaintenanceController.js
// DB-backed maintenance centers (with per-center services) + center reviews.
import Center from "../models/centerModel.js";
import CenterReview from "../models/centerReviewModel.js";

// The three real centers. Each offers a slightly different (partially
// overlapping) set of services so "filter centers by service" is meaningful.
const MAINTENANCE_CENTERS = [
  {
    name: "DR Car Nile Center",
    rating: 5,
    lat: 31.07115507,
    lng: 31.41496068,
    address: "بجوار NILE Academy For Science",
    governorate: "دمياط",
    imageUrl: "assets/images/DR_Car_Nile_Center.png",
    services: [
      "تغيير الزيت والفلتر",
      "الفرامل",
      "البطارية",
      "الكشف بالكمبيوتر",
      "غيار الفلاتر",
      "فحص شامل دوري",
    ],
  },
  {
    name: "DR Car Sandub Center",
    rating: 5,
    lat: 31.0239666,
    lng: 31.39404454,
    address: "سندوب - دمياط",
    governorate: "دمياط",
    imageUrl: "assets/images/DR_Car_Sandub_Center.png",
    services: [
      "تغيير الزيت والفلتر",
      "التكييف",
      "الكاوتش والإطارات",
      "العفشة",
      "دورة التبريد",
      "البوجيهات",
    ],
  },
  {
    name: "DR Car Elgamaa Center",
    rating: 5,
    lat: 31.04012205,
    lng: 31.3504002,
    address: "الجامعة - دمياط",
    governorate: "دمياط",
    imageUrl: "assets/images/DR_Car_Elgamaa_Center.png",
    services: [
      "تغيير الزيت والفلتر",
      "الفرامل",
      "السيور",
      "التكييف",
      "الكشف بالكمبيوتر",
      "فحص شامل دوري",
    ],
  },
];

// Idempotently make sure the three centers exist in the DB.
export const seedMaintenanceCenters = async () => {
  for (const c of MAINTENANCE_CENTERS) {
    await Center.updateOne(
      { name: c.name },
      {
        $set: {
          name: c.name,
          rating: c.rating,
          address: c.address,
          governorate: c.governorate,
          services: c.services,
          imageUrl: c.imageUrl || "",
          source: "manual",
          location: { type: "Point", coordinates: [c.lng, c.lat] },
        },
      },
      { upsert: true }
    );
  }
};

const shapeCenter = (doc) => ({
  id: doc._id,
  name: doc.name,
  rating: doc.rating,
  userRatingsTotal: doc.userRatingsTotal || 0,
  address: doc.address || "",
  governorate: doc.governorate || "",
  services: doc.services || [],
  imageUrl: doc.imageUrl || "",
  lat: doc.location?.coordinates?.[1],
  lng: doc.location?.coordinates?.[0],
});

// GET /api/centers/maintenance?service=...
// Only returns centers that offer the requested service (when provided).
export const getMaintenanceCenters = async (req, res) => {
  try {
    await seedMaintenanceCenters();

    const service = String(req.query.service || "").trim();
    const query = {
      name: { $in: MAINTENANCE_CENTERS.map((c) => c.name) },
    };
    if (service) query.services = service;

    const centers = await Center.find(query).lean();
    return res.json({ success: true, centers: centers.map(shapeCenter) });
  } catch (err) {
    console.error("❌ getMaintenanceCenters:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// GET /api/centers/:id
export const getCenterById = async (req, res) => {
  try {
    const center = await Center.findById(req.params.id).lean();
    if (!center) {
      return res.status(404).json({ success: false, message: "المركز غير موجود" });
    }
    return res.json({ success: true, center: shapeCenter(center) });
  } catch (err) {
    console.error("❌ getCenterById:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// GET /api/centers/:id/reviews
export const getCenterReviews = async (req, res) => {
  try {
    const reviews = await CenterReview.find({ center: req.params.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({
      success: true,
      reviews: reviews.map((r) => ({
        id: r._id,
        userName: r.userName,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error("❌ getCenterReviews:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// POST /api/centers/:id/reviews   { rating, comment }   (protected)
export const addCenterReview = async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "التقييم يجب أن يكون بين 1 و 5" });
    }

    const center = await Center.findById(req.params.id);
    if (!center) {
      return res.status(404).json({ success: false, message: "المركز غير موجود" });
    }

    await CenterReview.create({
      center: center._id,
      user: req.user._id,
      userName: req.user.name || "مستخدم",
      rating,
      comment,
    });

    // Recompute the center's average rating + total from real reviews.
    const stats = await CenterReview.aggregate([
      { $match: { center: center._id } },
      { $group: { _id: "$center", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    if (stats.length) {
      center.rating = Math.round(stats[0].avg * 10) / 10;
      center.userRatingsTotal = stats[0].count;
      await center.save();
    }

    return res.status(201).json({
      success: true,
      rating: center.rating,
      userRatingsTotal: center.userRatingsTotal,
    });
  } catch (err) {
    console.error("❌ addCenterReview:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};
