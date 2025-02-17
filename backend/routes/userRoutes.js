const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const router = express.Router();

// POST /api/register - Register a new user
router.post("/register", async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({ message: "User registered successfully. You can now log in." });
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).json({ error: "An error occurred while registering the user." });
  }
});

// POST /api/login - Authenticate a user
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "User not found." });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ error: "Invalid password." });
    }

    res.status(200).json({ message: "Login successful!" });
  } catch (err) {
    console.error("Error logging in user:", err);
    res.status(500).json({ error: "An error occurred while logging in." });
  }
});

module.exports = router;
