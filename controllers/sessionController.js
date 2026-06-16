// PATH: backend/controllers/sessionController.js
import Session from "../models/sessionModel.js";

const shape = (s, currentJti) => ({
  id: s._id,
  device: s.device,
  platform: s.platform,
  ip: s.ip,
  location: s.location,
  success: s.success,
  status: s.status,
  current: !!s.jti && s.jti === currentJti,
  createdAt: s.createdAt,
  lastActiveAt: s.lastActiveAt,
});

// GET /api/account/sessions  -> active devices (Connected Devices)
export const getSessions = async (req, res) => {
  try {
    const sessions = await Session.find({
      user: req.user._id,
      success: true,
      status: "active",
    })
      .sort({ lastActiveAt: -1 })
      .lean();

    return res.json({
      success: true,
      sessions: sessions.map((s) => shape(s, req.tokenJti)),
    });
  } catch (err) {
    console.error("❌ getSessions:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// GET /api/account/login-history  -> all login activity (success + failed)
export const getLoginHistory = async (req, res) => {
  try {
    const items = await Session.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({
      success: true,
      history: items.map((s) => shape(s, req.tokenJti)),
    });
  } catch (err) {
    console.error("❌ getLoginHistory:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// DELETE /api/account/sessions/:id  -> revoke a single device/session
export const revokeSession = async (req, res) => {
  try {
    const updated = await Session.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { status: "revoked" },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "غير موجود" });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("❌ revokeSession:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// POST /api/account/sessions/revoke-all  -> log out of all OTHER devices
export const revokeAllSessions = async (req, res) => {
  try {
    await Session.updateMany(
      {
        user: req.user._id,
        status: "active",
        jti: { $ne: req.tokenJti || "__none__" },
      },
      { status: "revoked" }
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("❌ revokeAllSessions:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};
