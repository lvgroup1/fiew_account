const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  status: { 
    type: String, 
    enum: ["New", "Scheduled", "Completed", "Canceled"], 
    default: "New" 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Client", clientSchema);
