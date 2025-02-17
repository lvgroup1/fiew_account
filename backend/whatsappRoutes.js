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
        // Exchange code for access token
        const response = await axios.post("https://graph.facebook.com/v16.0/oauth/access_token", null, {
            params: {
                client_id: process.env.META_APP_ID,
                client_secret: process.env.META_APP_SECRET,
                redirect_uri: "https://fiew-account.onrender.com/whatsapp-callback",
                code: code
            }
        });

        const { access_token } = response.data;
        console.log("Received WhatsApp Access Token:", access_token);

        res.json({ message: "WhatsApp connected successfully!", access_token });
    } catch (error) {
        console.error("WhatsApp authentication failed:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to authenticate WhatsApp." });
    }
});

module.exports = router;
