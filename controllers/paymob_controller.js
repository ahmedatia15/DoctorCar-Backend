import {
  paymobAuth,
  createPaymobOrder,
  getCardPaymentKey,
  getWalletPaymentLink,
  getKioskRef
} from "../services/paymob.js";

export const payWithWallet = async (req, res) => {
  try {
    const { amount, phone } = req.body;

    const auth = await paymobAuth();
    const orderId = await createPaymobOrder(auth, amount);

    const url = await getWalletPaymentLink(auth, orderId, amount, phone);

    res.json({ success: true, url, orderId });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const payWithCard = async (req, res) => {
  try {
    const { amount } = req.body;

    const auth = await paymobAuth();
    const orderId = await createPaymobOrder(auth, amount);

    const billing = {
      apartment: "NA",
      email: "user@test.com",
      floor: "NA",
      first_name: "user",
      last_name: "client",
      street: "NA",
      building: "NA",
      phone_number: "0100000000",
      city: "Cairo",
      country: "EG",
      state: "NA",
    };

    const token = await getCardPaymentKey(auth, orderId, amount, billing);

    res.json({
      success: true,
      iframeUrl: `https://accept.paymob.com/api/acceptance/iframes/981672?payment_token=${token}`,
      orderId,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
