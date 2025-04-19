require("dotenv").config(); // Load environment variables

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");

const Client = require("./models/clientSchema");
const User = require("./models/User");

// ✅ Import Routes
const whatsappRoutes = require("./routes/whatsappRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ Middleware setup
app.use(cors({
    origin: "https://lvgroup1.github.io", // ✅ Allow your GitHub frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));
app.use(bodyParser.json());
app.use(express.json());

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

// ✅ WhatsApp Authentication Route
app.post("/api/whatsapp-auth", async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            console.error("❌ Missing authorization code.");
            return res.status(400).json({ error: "Missing authorization code." });
        }

        console.log("✅ Received WhatsApp auth code:", code);

        // ✅ Log the API request before sending it
        console.log("🔄 Sending request to Meta API...");
        
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
        const newClient = new Client(req.body);
        await newClient.save();
        res.status(201).json({ message: "Client added successfully!", client: newClient });
    } catch (error) {
        res.status(500).json({ error: "Failed to add client" });
    }
});

app.get("/api/clients", async (req, res) => {
    try {
        const clients = await Client.find();
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

// ✅ User Authentication Routes (Login/Register)
const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);


// ✅ Route to return Meta App ID for WhatsApp authentication
app.get("/config", (req, res) => {
    if (!process.env.META_APP_ID) {
        console.error("❌ META_APP_ID is not set in the environment variables.");
        return res.status(500).json({ error: "META_APP_ID is missing from server." });
    }

    res.json({ META_APP_ID: process.env.META_APP_ID });
});

app.get("/api/whatsapp/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) return res.status(400).send("❌ Missing authorization code.");

  try {
    const tokenResponse = await axios.get("https://graph.facebook.com/v18.0/oauth/access_token", {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: "https://fiew-account.onrender.com/api/whatsapp/callback",
        code: code,
      },
    });

const access_token = tokenResponse.data.access_token;
console.log("✅ Access token received:", access_token);

// Step 1: Get User ID
const meRes = await axios.get("https://graph.facebook.com/v18.0/me", {
  headers: { Authorization: `Bearer ${access_token}` },
  params: { fields: "id" }
});
const userId = meRes.data.id;
console.log("✅ User ID:", userId);

// Step 2: Get Business ID
const bizRes = await axios.get(`https://graph.facebook.com/v18.0/${userId}/businesses`, {
  headers: { Authorization: `Bearer ${access_token}` }
});
const businessId = bizRes.data.data[0]?.id;
if (!businessId) throw new Error("❌ No business ID found.");
console.log("🏢 Business ID:", businessId);

// Step 3: Get WhatsApp Business Account ID
const wabaRes = await axios.get(`https://graph.facebook.com/v18.0/${businessId}/owned_whatsapp_business_accounts`, {
  headers: { Authorization: `Bearer ${access_token}` }
});
const wabaId = wabaRes.data.data[0]?.id;
if (!wabaId) throw new Error("❌ No WhatsApp Business Account found.");
console.log("📱 WABA ID:", wabaId);

// Step 4: Get Phone Number ID and Display Name
const phoneRes = await axios.get(`https://graph.facebook.com/v18.0/${wabaId}/phone_numbers`, {
  headers: { Authorization: `Bearer ${access_token}` }
});
const phone_number_id = phoneRes.data.data[0]?.id;
const display_name = phoneRes.data.data[0]?.display_name;

console.log("📞 Phone Number ID:", phone_number_id);
console.log("🏷️ Display Name:", display_name);

// Step 5: Identify the CRM user (customize based on login/auth)
const userEmail = req.query.email || "test@example.com";

// Step 6: Save credentials to User model
   await User.findOneAndUpdate(
      { email: userEmail },
      {
        whatsapp: {
          access_token,
          phone_number_id,
          display_name,
          connected_at: new Date()
        }
      },
      { new: true, upsert: true }
    );

    res.send("✅ WhatsApp Business account connected successfully! You can close this window.");
  } catch (error) {
    console.error("❌ Token exchange failed:", error.response?.data || error.message);
    res.status(500).send("❌ Failed to retrieve access token from Meta.");
  }
}); // ✅ THIS LINE WAS MISSING

app.post("/send-whatsapp", async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ error: "Missing phone number." });
        }

        const response = await axios.post(
  `https://graph.facebook.com/v16.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
  {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: "hello_world",
      language: {
        code: "en_US"
      },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: "Gabriella"
            }
          ]
        }
      ]
    }
  },
  {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  }
);

        console.log("✅ WhatsApp Template Message Sent Successfully!", response.data);
        res.json({ success: true, message: "Template message sent!", data: response.data });

    } catch (error) {
        console.error("❌ WhatsApp API Error:", error.response?.data || error.message);
        res.status(500).json({
            error: "Failed to send WhatsApp message.",
            details: error.response?.data || error.message
        });
    }
});

async function debugAccessToken(token) {
  try {
    const debugRes = await axios.get(
      `https://graph.facebook.com/debug_token`, {
        params: {
          input_token: token,
          access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
        }
      }
    );
    console.log("🔍 Granted scopes:", debugRes.data.data.scopes);
  } catch (error) {
    console.error("❌ Failed to debug token:", error.response?.data || error.message);
  }
}

// ✅ Then call it
debugAccessToken(access_token);


// Your routes...

// ✅ Start the Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
