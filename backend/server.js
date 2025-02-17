require("dotenv").config();

const axios = require("axios");

const express = require("express");
const mongoose = require("mongoose");
const userRoutes = require("./routes/userRoutes");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 5000;

app.use(cors()); // Allow frontend requests

// Middleware
app.use(cors({ origin: "https://lvgroup1.github.io" }));  // (Optional) Allow requests from another origin if needed
app.use(express.json());

// Serve static files from the frontend/views folder
app.use(express.static(path.join(__dirname, "../frontend/views")));

// API Routes (all endpoints here are prefixed with /api)
app.use("/api", userRoutes);

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/yourDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define Client Schema
const clientSchema = new mongoose.Schema({
  userId: String, // To associate clients with a user
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  status: String
});
const Client = mongoose.model("Client", clientSchema);

// Add Client (POST request)
app.post("/api/clients", async (req, res) => {
  try {
    const newClient = new Client(req.body);
    await newClient.save();
    res.status(201).json(newClient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Clients for a User (GET request)
app.get("/api/clients/:userId", async (req, res) => {
  try {
    const clients = await Client.find({ userId: req.params.userId });
    res.status(200).json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WhatsApp OAuth Callback Route
app.get("/whatsapp-callback", async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).send("Authorization failed: No code received");
    }

    try {
        const response = await axios.get("https://graph.facebook.com/v16.0/oauth/access_token", {
            params: {
                client_id: process.env.META_APP_ID, // Ensure this is set in .env
                client_secret: process.env.META_APP_SECRET, // Ensure this is set in .env
                redirect_uri: "http://localhost:5000/whatsapp-callback",
                code: code
            }
        });

        const accessToken = response.data.access_token;
        console.log("WhatsApp Access Token:", accessToken);

        // Store the token securely (Session, DB, or LocalStorage)
        
        res.redirect("/dashboard.html#whatsapp");

    } catch (error) {
        console.error("WhatsApp authentication error:", error.response ? error.response.data : error.message);
        res.status(500).send(`WhatsApp authentication failed: ${JSON.stringify(error.response?.data || error.message)}`);
    }
});

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

app.post("/send-whatsapp", async (req, res) => {
    const { phone, message } = req.body;

    try {
        const response = await axios.post(
            `https://graph.facebook.com/v16.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: phone,
                type: "text",
                text: { body: message }
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("✅ WhatsApp Message Sent:", response.data);
        console.log("📩 Message ID:", response.data.messages[0]?.id || "No message ID");

        res.json({ success: true, data: response.data });

    } catch (error) {
        console.error("❌ WhatsApp API Error:", error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data || error.message });
    }
});




// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.get("/config", (req, res) => {
    if (!process.env.META_APP_ID) {
        return res.status(500).json({ error: "META_APP_ID is not set in the environment variables." });
    }
    res.json({ metaAppId: process.env.META_APP_ID });
});

app.post("/webhook", (req, res) => {
    console.log("📬 Incoming Webhook Event:", req.body);

    const messagingEvent = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (messagingEvent) {
        console.log("📩 Message Sent:", messagingEvent.id);
    }

    res.sendStatus(200);
});
