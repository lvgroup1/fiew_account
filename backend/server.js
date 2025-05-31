require("dotenv").config(); // Load environment variables

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");

const Client = require("./models/clientSchema");
const User = require("./models/User");

const app = express();

// ✅ CORS Configuration - allow GitHub Pages frontend
const corsOptions = {
  origin: "https://lvgroup1.github.io",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Import Routes
const whatsappRoutes = require("./routes/whatsappRoutes");
app.use("/whatsapp", whatsappRoutes);

const PORT = process.env.PORT || 5000;

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ Serve static frontend files
app.use(express.static(path.join(__dirname, "../frontend/views")));

// ✅ Use WhatsApp API routes
app.use("/api/whatsapp", whatsappRoutes);

// ✅ Default Route (Basic Status Check)
app.get("/", (req, res) => {
    res.send("✅ Server is running successfully!");
});

// ✅ API Health Check Route
app.get("/api/status", (req, res) => {
    res.json({ status: "ok" });
});

app.get("/api/whatsapp-credentials", async (req, res) => {
  const userEmail = req.query.email || req.user?.email; // Depending on your auth setup

  if (!userEmail) {
    return res.status(400).json({ error: "Missing user email." });
  }

  const user = await User.findOne({ email: userEmail });
  if (!user || !user.whatsapp || !user.whatsapp.access_token) {
    return res.status(404).json({ error: "No WhatsApp credentials" });
  }

  res.json({
    accessToken: user.whatsapp.access_token,
    phoneNumberId: user.whatsapp.phone_number_id,
    wabaId: user.whatsapp.waba_id || null
  });
});

// ✅ WhatsApp Authentication Route
app.post("/api/whatsapp-auth", async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            console.error("❌ Missing authorization code.");
            return res.status(400).json({ error: "Missing authorization code." });
        }

        console.log("✅ Received WhatsApp auth code:", code);

        const response = await axios.post("https://graph.facebook.com/v16.0/oauth/access_token", null, {
            params: {
                client_id: process.env.META_APP_ID,
                client_secret: process.env.META_APP_SECRET,
                redirect_uri: process.env.WHATSAPP_REDIRECT_URI,
                code: code,
            },
        });

        console.log("✅ Meta API Response:", response.data);

        if (!response.data.access_token) {
            console.error("❌ Meta API Error (No access token returned):", response.data);
            return res.status(400).json({ error: "Failed to get access token from Meta API" });
        }

        const accessToken = response.data.access_token;
        console.log("✅ WhatsApp Auth Successful! Access Token:", accessToken);

        res.json({ success: true, message: "WhatsApp connected successfully!", accessToken });

    } catch (error) {
        console.error("❌ WhatsApp Auth Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to authenticate WhatsApp.", details: error.response?.data || error.message });
    }
});

// ✅ CRUD Routes for Clients
app.post("/api/clients", async (req, res) => {
  try {
    const { firstName, lastName, email, phone, status, ownerEmail } = req.body;
    const user = await User.findOne({ email: ownerEmail });
    if (!user) return res.status(404).json({ error: "User not found." });

    const newClient = new Client({
      firstName,
      lastName,
      email,
      phone,
      status,
      owner: user._id
    });

    await newClient.save();
    res.status(201).json({ message: "Client added successfully!", client: newClient });

  } catch (error) {
    res.status(500).json({ error: "Failed to add client" });
  }
});

app.get("/api/clients", async (req, res) => {
  try {
    const ownerEmail = req.query.email;
    const owner = await User.findOne({ email: ownerEmail });

    if (!owner) return res.status(404).json({ error: "User not found" });

    const clients = await Client.find({ owner: owner._id });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

app.put("/api/clients/:id", async (req, res) => {
    try {
        const updatedClient = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ message: "Client updated!", client: updatedClient });
    } catch (error) {
        res.status(500).json({ error: "Failed to update client" });
    }
});

app.delete("/api/clients/:id", async (req, res) => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.json({ message: "Client deleted!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete client" });
  }
});

const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);

app.get("/config", (req, res) => {
    if (!process.env.META_APP_ID) {
        console.error("❌ META_APP_ID is not set in the environment variables.");
        return res.status(500).json({ error: "META_APP_ID is missing from server." });
    }
    res.json({ META_APP_ID: process.env.META_APP_ID });
});

app.get("/api/whatsapp/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send("❌ Missing authorization code.");
  }

  let access_token;
  try {
    // 1. Exchange code for access token
    const tokenResponse = await axios.get("https://graph.facebook.com/v18.0/oauth/access_token", {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: "https://fiew-account.onrender.com/api/whatsapp/callback",
        code
      }
    });
    access_token = tokenResponse.data.access_token;
    if (!access_token) throw new Error("Access token not found in response.");
  } catch (error) {
    console.error("❌ Token exchange failed:", error.response?.data || error.message);
    return res.status(500).send("❌ Failed to retrieve access token from Meta.");
  }

  try {
    // 2. Debug access token (optional but helpful for dev)
    const debugRes = await axios.get("https://graph.facebook.com/debug_token", {
      params: {
        input_token: access_token,
        access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
      }
    });
    console.log("🔍 Granted scopes:", debugRes.data.data.scopes);
  } catch (err) {
    console.error("❌ Failed to debug token:", err.response?.data || err.message);
  }

  try {
    // 3. Get user ID
    const meRes = await axios.get("https://graph.facebook.com/v18.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
      params: { fields: "id" }
    });
    const userId = meRes.data.id;

    // 4. Get business ID
    const bizRes = await axios.get(`https://graph.facebook.com/v18.0/${userId}/businesses`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const businessId = bizRes.data.data[0]?.id;
    if (!businessId) throw new Error("No business ID found.");

    // 5. Get WABA ID
    const wabaRes = await axios.get(`https://graph.facebook.com/v18.0/${businessId}/owned_whatsapp_business_accounts`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const wabaId = wabaRes.data.data[0]?.id;
    if (!wabaId) throw new Error("No WhatsApp Business Account found.");

    // 6. Get phone number ID and display name
    const phoneRes = await axios.get(`https://graph.facebook.com/v18.0/${wabaId}/phone_numbers`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const phoneData = phoneRes.data.data[0];
    if (!phoneData) throw new Error("No phone number found.");

    const phone_number_id = phoneData.id;
    const display_name = phoneData.display_name;

    // 7. Save credentials to database
    const userEmail = decodeURIComponent(state || "test@example.com");

    await User.findOneAndUpdate(
      { email: userEmail },
      {
        whatsapp: {
          access_token,
          phone_number_id,
          display_name,
          waba_id: wabaId,
          connected_at: new Date()
        }
      },
      { new: true, upsert: true }
    );

    res.send("✅ WhatsApp Business account connected successfully! You can close this window.");
  } catch (error) {
    console.error("❌ Failed to complete WhatsApp integration:", error.response?.data || error.message);
    res.status(500).send("❌ Failed to retrieve WhatsApp Business details.");
  }
});

app.post("/send-whatsapp", async (req, res) => {
  try {
    const { phone, email } = req.body;
    if (!phone || !email) return res.status(400).json({ error: "Missing phone number or email." });

    const user = await User.findOne({ email });
    if (!user || !user.whatsapp || !user.whatsapp.access_token) {
      return res.status(403).json({ error: "WhatsApp not connected for this user." });
    }

    const token = user.whatsapp.access_token;
    const phone_number_id = user.whatsapp.phone_number_id;

    const response = await axios.post(
      `https://graph.facebook.com/v16.0/${phone_number_id}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: "hello_world",
          language: { code: "en_US" }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ success: true, message: "hello_world sent!", data: response.data });
  } catch (error) {
    res.status(500).json({
      error: "Failed to send WhatsApp message.",
      details: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
