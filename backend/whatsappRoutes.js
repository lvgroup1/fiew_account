const express = require("express");
// const axios = require("axios");
// require("dotenv").config();

const router = express.Router();

router.post("/api/whatsapp-auth", async (req, res) => {
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

module.exports = router;

