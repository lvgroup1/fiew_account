const express = require("express");
const axios = require("axios");
require("dotenv").config();

const router = express.Router();

router.post("/whatsapp-auth", async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: "Missing authorization code." });
    }

    try {
        const response = await axios.post("https://graph.facebook.com/v16.0/oauth/access_token", null, {
            params: {
                client_id: process.env.META_APP_ID, // Your App ID from .env
                client_secret: process.env.META_APP_SECRET, // Your App Secret from .env
                redirect_uri: "https://fiew-account.onrender.com/whatsapp-callback", // Ensure this matches the one in Meta App
                code: code
            }
        });

        const { access_token } = response.data;
        console.log("✅ WhatsApp Access Token Received:", access_token);

        res.json({ message: "WhatsApp Connected Successfully!", access_token });
    } catch (error) {
        console.error("❌ WhatsApp Authentication Failed:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to authenticate WhatsApp." });
    }
});

module.exports = router;


module.exports = router;
