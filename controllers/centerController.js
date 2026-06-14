// PATH: backend/controllers/centerController.js
import Center from "../models/centerModel.js";

const DAMIETTA_CENTER = { lat: 31.4165, lng: 31.8133 }; // Damietta city center

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n) && !Number.isNaN(n);
}

function normalizeSource(v) {
  const s = String(v || "manual").trim().toLowerCase();
  return s === "google" ? "google" : "manual";
}

// ✅ Safe fetch helper
async function googleGET(url) {
  if (typeof globalThis.fetch !== "function") {
    throw new Error(
      "fetch is not available. Please use Node 18+ or install node-fetch."
    );
  }

  const res = await fetch(url);

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error(`Google response is not valid JSON. HTTP ${res.status}`);
  }

  if (!res.ok) {
    throw new Error(
      `Google request failed. HTTP ${res.status}. Body: ${JSON.stringify(data)}`
    );
  }

  return data;
}

// =========================
// ✅ GET /api/centers/nearby
// =========================
export const getNearbyCenters = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);

    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
      return res
        .status(400)
        .json({ message: "lat and lng are required numbers" });
    }

    // ✅ maxDistance in meters (1km..200km safety)
    const maxDistanceRaw = Number(req.query.maxDistance || 50000);
    const maxDistance = Math.min(Math.max(maxDistanceRaw, 1000), 200000);

    // ✅ Optional filters
    const governorate = String(req.query.governorate || "").trim();
    const city = String(req.query.city || "").trim();

    const matchStage = {};
    if (governorate) matchStage.governorate = governorate;
    if (city) matchStage.city = city;

    const pipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          key: "location",
          distanceField: "distanceMeters",
          spherical: true,
          maxDistance,
          ...(Object.keys(matchStage).length ? { query: matchStage } : {}),
        },
      },
      { $limit: limit },
      {
        $addFields: {
          distanceKm: { $round: [{ $divide: ["$distanceMeters", 1000] }, 1] },
          distanceText: {
            $concat: [
              {
                $toString: {
                  $round: [{ $divide: ["$distanceMeters", 1000] }, 1],
                },
              },
              " كم",
            ],
          },
        },
      },
      {
        $project: {
          _id: 1,
          placeId: 1,
          name: 1,
          rating: 1,
          imageUrl: 1,
          address: 1,
          phone: 1,
          userRatingsTotal: 1,
          types: 1,
          source: 1,
          governorate: 1,
          city: 1,
          distanceMeters: 1,
          distanceKm: 1,
          distanceText: 1,
          lat: { $arrayElemAt: ["$location.coordinates", 1] },
          lng: { $arrayElemAt: ["$location.coordinates", 0] },
        },
      },
    ];

    const centers = await Center.aggregate(pipeline);
    return res.json(centers);
  } catch (e) {
    console.error("nearby centers error:", e);
    return res.status(500).json({
      message: "server error",
      error: e.message,
    });
  }
};

// ========================================
// ✅ POST /api/centers/import/manual
// Body: [{ name, lat, lng, address, phone, rating, types, governorate, city, imageUrl, placeId? }]
// ========================================
export const importCentersManual = async (req, res) => {
  try {
    const items = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Body must be a non-empty array of centers",
      });
    }

    const docs = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const c = items[i] || {};
      const name = String(c.name || "").trim();
      const lat = Number(c.lat);
      const lng = Number(c.lng);

      if (!name) {
        errors.push({ index: i, reason: "Missing name" });
        continue;
      }

      if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
        errors.push({ index: i, reason: "Missing/invalid lat/lng" });
        continue;
      }

      const placeId =
        c.placeId && String(c.placeId).trim()
          ? String(c.placeId).trim()
          : null;

      docs.push({
        placeId,
        name,
        address: String(c.address || "").trim(),
        phone: String(c.phone || "").trim(),
        rating: Number(c.rating || 0),
        userRatingsTotal: Number(c.userRatingsTotal || 0),
        imageUrl: String(c.imageUrl || "").trim(),
        types: Array.isArray(c.types) ? c.types.map(String) : [],
        source: normalizeSource(c.source),
        governorate: String(c.governorate || "دمياط").trim(),
        city: String(c.city || "").trim(),
        lastSyncedAt: new Date(),
        location: { type: "Point", coordinates: [lng, lat] }, // ✅ [lng, lat]
      });
    }

    if (docs.length === 0) {
      return res.status(400).json({
        message: "No valid centers to import",
        errors,
      });
    }

    const ops = docs.map((doc) => {
      const filter = doc.placeId
        ? { placeId: doc.placeId }
        : { name: doc.name, "location.coordinates": doc.location.coordinates };

      return {
        updateOne: {
          filter,
          update: { $set: doc },
          upsert: true,
        },
      };
    });

    let result;
    try {
      result = await Center.bulkWrite(ops, { ordered: false });
    } catch (e) {
      const isDupKey = e?.code === 11000;
      return res.status(isDupKey ? 409 : 500).json({
        message: isDupKey ? "Duplicate key error" : "server error",
        error: e?.message || String(e),
      });
    }

    const inserted = result?.upsertedCount || 0;
    const updated = result?.modifiedCount || 0;

    return res.json({
      ok: true,
      imported: docs.length,
      inserted,
      updated,
      errors,
    });
  } catch (e) {
    console.error("importCentersManual error:", e);
    return res.status(500).json({
      message: "server error",
      error: e.message,
    });
  }
};

// ====================================================
// ✅ OPTIONAL: import Damietta centers from Google Places
// POST /api/centers/import/damietta
// ====================================================
export const importDamiettaCenters = async (req, res) => {
  try {
    const key = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();

    if (!key) {
      return res.status(400).json({
        message: "Missing GOOGLE_MAPS_API_KEY in backend .env",
      });
    }

    const query = "car repair";
    const radius = 25000;

    let nextPageToken = null;
    let allResults = [];
    let pages = 0;

    while (pages < 3) {
      let url =
        `https://maps.googleapis.com/maps/api/place/textsearch/json?` +
        `query=${encodeURIComponent(query)}` +
        `&location=${DAMIETTA_CENTER.lat},${DAMIETTA_CENTER.lng}` +
        `&radius=${radius}` +
        `&key=${key}` +
        `&language=ar`;

      if (nextPageToken) {
        url += `&pagetoken=${nextPageToken}`;
      }

      const data = await googleGET(url);

      if (data.status === "INVALID_REQUEST" && nextPageToken) {
        await sleep(2000);
        continue;
      }

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        return res.status(500).json({
          message: "Google Places error",
          status: data.status,
          data,
        });
      }

      allResults.push(...(data.results || []));
      nextPageToken = data.next_page_token || null;
      pages += 1;

      if (!nextPageToken) break;
      await sleep(2000);
    }

    const unique = new Map();
    for (const r of allResults) {
      if (r.place_id) unique.set(r.place_id, r);
    }
    const places = Array.from(unique.values());

    let inserted = 0;
    let updated = 0;

    for (const p of places) {
      const placeId = p.place_id;
      if (!placeId) continue;

      const detailsUrl =
        `https://maps.googleapis.com/maps/api/place/details/json?` +
        `place_id=${placeId}` +
        `&fields=place_id,name,formatted_address,formatted_phone_number,rating,user_ratings_total,geometry,types,photos` +
        `&key=${key}` +
        `&language=ar`;

      const det = await googleGET(detailsUrl);
      if (det.status !== "OK") continue;

      const d = det.result;
      const lat = d?.geometry?.location?.lat;
      const lng = d?.geometry?.location?.lng;

      if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) continue;

      let imageUrl = "";
      if (Array.isArray(d.photos) && d.photos.length > 0) {
        const ref = d.photos[0]?.photo_reference;
        if (ref) {
          imageUrl =
            `https://maps.googleapis.com/maps/api/place/photo?` +
            `maxwidth=800&photo_reference=${ref}&key=${key}`;
        }
      }

      const doc = {
        placeId: d.place_id,
        name: d.name || "",
        address: d.formatted_address || "",
        phone: d.formatted_phone_number || "",
        rating: Number(d.rating || 0),
        userRatingsTotal: Number(d.user_ratings_total || 0),
        imageUrl,
        types: Array.isArray(d.types) ? d.types : [],
        source: "google",
        governorate: "دمياط",
        lastSyncedAt: new Date(),
        location: { type: "Point", coordinates: [lng, lat] },
      };

      const existing = await Center.findOneAndUpdate(
        { placeId: doc.placeId },
        { $set: doc },
        { upsert: true, new: false }
      );

      if (existing) updated += 1;
      else inserted += 1;

      await sleep(80);
    }

    return res.json({
      ok: true,
      city: "Damietta",
      fetched: places.length,
      inserted,
      updated,
    });
  } catch (e) {
    console.error("importDamiettaCenters error:", e);
    return res.status(500).json({
      message: "server error",
      error: e.message,
    });
  }
};