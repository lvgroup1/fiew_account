const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  whatsapp: {
    access_token: String,
    phone_number_id: String,
    display_name: String,
    connected_at: { type: Date, default: Date.now }
  }
});

// ✅ Only compile if not already done
module.exports = mongoose.models.User || mongoose.model("User", userSchema);
