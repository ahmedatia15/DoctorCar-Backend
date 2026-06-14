const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Test
app.get("/", (req, res) => {
  res.send("API شغال 🔥");
});

// مثال
app.get("/test", (req, res) => {
  res.json({message: "تمام 👍"});
});

exports.api = functions.https.onRequest(app);
