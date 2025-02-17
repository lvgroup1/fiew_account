require("dotenv").config();

const express = require("express");
const router = express.Router();

const axios = require("axios");
const whatsappRoutes = require("./routes/whatsappRoutes");

const mongoose = require("mongoose");
const userRoutes = require("./routes/userRoutes");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); // Allow frontend requests
app.use(express.json());

// Middleware
app.use(cors({ origin: "https://lvgroup1.github.io" }));  // (Optional) Allow requests from another origin if needed

// Serve static files from the frontend/views folder
app.use(express.static(path.join(__dirname, "../frontend/views")));

// API Routes (all endpoints here are prefixed with /api)
app.use("/api", userRoutes);

// Add the WhatsApp Authentication Routes
app.use("/api", whatsappRoutes);

// Default route
app.get("/", (req, res) => {
    res.send("Server is running...");
});

// ✅ API health check
app.get("/api/status", (req, res) => {
    res.json({ status: "ok" });
});

// Connect to MongoDB
async function testMongoDBConnection() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
  }
}

testMongoDBConnection();


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
                redirect_uri: "https://fiew-account.onrender.com/whatsapp-callback",
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

// Handle WhatsApp OAuth callback
router.post("/whatsapp-auth", async (req, res) => {
    try {
        const { code } = req.body;  // Get the OAuth code from the frontend

        if (!code) {
            return res.status(400).json({ error: "Missing OAuth code" });
        }

        // Exchange the code for an access token
        const tokenResponse = await axios.post(
            `https://graph.facebook.com/v16.0/oauth/access_token`,
            null,
            {
                params: {
                    client_id: process.env.META_APP_ID, // Your Meta App ID
                    client_secret: process.env.META_APP_SECRET, // Your Meta App Secret
                    redirect_uri: process.env.WHATSAPP_REDIRECT_URI,
                    code: code,
                },
            }
        );

        const accessToken = tokenResponse.data.access_token;
        if (!accessToken) {
            return res.status(400).json({ error: "Failed to get access token" });
        }

        // Store accessToken in database (user-specific)
        // Here, you would save it in MongoDB or IndexedDB

        res.json({ success: true, message: "WhatsApp connected successfully!" });

    } catch (error) {
        console.error("WhatsApp authentication error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to authenticate WhatsApp." });
    }
});


// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// API route to return the Meta App ID
app.get("/config", (req, res) => {
    const metaAppId = process.env.META_APP_ID;
    if (!metaAppId) {
        return res.status(500).json({ error: "Meta App ID is missing in environment variables" });
    }
    res.json({ clientId: metaAppId });
});


app.post("/webhook", (req, res) => {
    console.log("📬 Incoming Webhook Event:", req.body);

    const messagingEvent = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (messagingEvent) {
        console.log("📩 Message Sent:", messagingEvent.id);
    }

    res.sendStatus(200);
});

app.post("/api/whatsapp-auth", async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: "Missing authorization code." });
        }

        console.log("Received WhatsApp auth code:", code);
        res.json({ message: "WhatsApp authentication successful", code });
    } catch (error) {
        console.error("Error processing WhatsApp authentication:", error);
        res.status(500).json({ error: "Failed to authenticate WhatsApp." });
    }
});
