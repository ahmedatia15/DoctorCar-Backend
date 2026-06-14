import axios from "axios";

const API_KEY = "YOUR_PAYMOB_API_KEY";

const INTEGRATION_CARD = "CARD_INTEGRATION_ID";
const INTEGRATION_WALLET = "WALLET_INTEGRATION_ID";
const INTEGRATION_KIOSK = "KIOSK_INTEGRATION_ID";

export async function paymobAuth() {
  const res = await axios.post(
    "https://accept.paymob.com/api/auth/tokens",
    { api_key: API_KEY }
  );
  return res.data.token;
}

// ============================
// CREATE ORDER
// ============================
export async function createPaymobOrder(authToken, amount) {
  const res = await axios.post(
    "https://accept.paymob.com/api/ecommerce/orders",
    {
      auth_token: authToken,
      amount_cents: amount * 100,
      currency: "EGP",
      items: [],
    }
  );
  return res.data.id;
}

// ============================
// CARD PAYMENT (Visa / Mastercard)
// ============================
export async function getCardPaymentKey(authToken, orderId, amount, billing) {
  const res = await axios.post(
    "https://accept.paymob.com/api/acceptance/payment_keys",
    {
      auth_token: authToken,
      amount_cents: amount * 100,
      order_id: orderId,
      currency: "EGP",
      integration_id: INTEGRATION_CARD,
      billing_data: billing,
    }
  );

  return res.data.token;
}

// ============================
// WALLET PAYMENT (Orange, Vodafone, Etisalat, WE)
// ============================
export async function getWalletPaymentLink(authToken, orderId, amount, phone) {
  const billing = {
    apartment: "NA",
    email: "test@test.com",
    floor: "NA",
    first_name: "user",
    last_name: "client",
    street: "NA",
    building: "NA",
    phone_number: phone,
    city: "NA",
    country: "EG",
    state: "NA",
  };

  const res = await axios.post(
    "https://accept.paymob.com/api/acceptance/payment_keys",
    {
      auth_token: authToken,
      amount_cents: amount * 100,
      expiration: 3600,
      order_id: orderId,
      currency: "EGP",
      integration_id: INTEGRATION_WALLET,
      billing_data: billing,
    }
  );

  const token = res.data.token;

  // Redirect URL
  return `https://accept.paymob.com/api/acceptance/transactions/pay?payment_token=${token}`;
}

// ============================
// KIOSK PAYMENT (Fawry style)
// ============================
export async function getKioskRef(authToken, orderId, amount, billing) {
  const res = await axios.post(
    "https://accept.paymob.com/api/acceptance/payments/pay",
    {
      source: { identifier: "AGGREGATOR", subtype: "AGGREGATOR" },
      payment_token: await getCardPaymentKey(authToken, orderId, amount, billing),
    }
  );

  return res.data.data.bill_reference;
}
