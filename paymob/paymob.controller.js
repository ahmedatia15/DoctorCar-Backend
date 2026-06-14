import axios from "axios";

const PAYMOB_API_KEY = "YOUR_PAYMOB_API_KEY";
const INTEGRATION_ID = "YOUR_INTEGRATION_ID"; // Card Integration ID
const IFRAME_ID = "YOUR_IFRAME_ID";

export const createPaymentLink = async (req, res) => {
  try {
    const { amount, customer } = req.body;

    // Step 1: Authentication Request
    const auth = await axios.post(
      "https://accept.paymob.com/api/auth/tokens",
      {
        api_key: PAYMOB_API_KEY,
      }
    );

    const token = auth.data.token;

    // Step 2: Order Registration API
    const order = await axios.post(
      "https://accept.paymob.com/api/ecommerce/orders",
      {
        auth_token: token,
        delivery_needed: false,
        amount_cents: amount * 100,
        currency: "EGP",
        items: [],
      }
    );

    const orderId = order.data.id;

    // Step 3: Payment Key Request
    const paymentKey = await axios.post(
      "https://accept.paymob.com/api/acceptance/payment_keys",
      {
        auth_token: token,
        amount_cents: amount * 100,
        order_id: orderId,
        billing_data: {
          first_name: customer.name,
          phone_number: customer.phone,
          email: customer.email ?? "test@test.com",
        },
        currency: "EGP",
        integration_id: INTEGRATION_ID,
      }
    );

    return res.json({
      iframe_url: `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${paymentKey.data.token}`,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "payment initialization failed" });
  }
};
