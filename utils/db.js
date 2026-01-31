const mongoose = require('mongoose');

let isConnected = false;

module.exports = async () => {
  if (isConnected) return;

  await mongoose.connect(process.env.MONGO_URI);
  isConnected = true;
};
