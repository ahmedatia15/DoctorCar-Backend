// controllers/paymentController.js
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// ================================
// 🔐 متغيرات من ملف .env
// ================================
const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const INTEGRATION_CARD = process.env.PAYMOB_INT_CARD;
const INTEGRATION_WALLET = process.env.PAYMOB_INT_WALLET;
const INTEGRATION_KIOSK = process.env.PAYMOB_INT_KIOSK;
const IFRAME_ID = process.env.IFRAME_ID;

// ================================
// 1) 🔓 Get Auth Token
// ================================
export const getAuthToken = async () => {
  const res = await axios.post(
    "https://accept.paymob.com/api/auth/tokens",
    { api_key: PAYMOB_API_KEY }
  );
  return res.data.token;
};

// ================================
// 2) 🧾 Create Order
// ================================
export const createPaymobOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    const token = await getAuthToken();

    const order = await axios.post(
      "https://accept.paymob.com/api/ecommerce/orders",
      {
        auth_token: token,
        delivery_needed: false,
        amount_cents: amount * 100,
        currency: "EGP",
        items: []
      }
    );

    return res.json({
      success: true,
      orderId: order.data.id,
    });

  } catch (err) {
    console.error("🚨 Error (Create Order):", err.response?.data || err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ================================
// 3) 💳 Generate Payment Key
// ================================
export const generatePaymentKey = async (req, res) => {
  try {
    const { amount, orderId, billingData, method } = req.body;

    const token = await getAuthToken();

    const integrationId =
      method === "wallet"
        ? INTEGRATION_WALLET
        : method === "kiosk"
        ? INTEGRATION_KIOSK
        : INTEGRATION_CARD;

    const paymentKey = await axios.post(
      "https://accept.paymob.com/api/acceptance/payment_keys",
      {
        auth_token: token,
        amount_cents: amount * 100,
        expiration: 3600,
        order_id: orderId,
        billing_data: billingData,
        currency: "EGP",
        integration_id: integrationId
      }
    );

    return res.json({
      success: true,
      paymentKey: paymentKey.data.token,
      iframe: `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${paymentKey.data.token}`,
    });

  } catch (err) {
    console.error("🚨 Error (Payment Key):", err.response?.data || err);
    res.status(500).json({ success: false, error: err.message });
  }
};
