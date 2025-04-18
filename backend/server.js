require("dotenv").config(); // Load environment variables

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");

// ✅ Import Models
const Client = require("./models/clientSchema");
const User = require("./models/User"); // ✅ Use user.js instead of userSchema.js

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

// ✅ Start the Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
