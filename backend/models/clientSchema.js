const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  status: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true } // 👈 Link to user
});

module.exports = mongoose.model("Client", clientSchema);
