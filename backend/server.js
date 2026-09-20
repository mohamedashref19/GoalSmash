const mongoose = require("mongoose");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config({ path: "./.env" });

const startExpirationJob = require("./services/expirationService");
const startKeepAliveJob = require("./services/keepAliveService");

const app = require("./app");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
app.set("io", io);
// const socketManager = require("./sockets/socketManager");
// socketManager(io);

const DB = process.env.DATABASE;
mongoose
  .connect(DB)
  .then(() => {
    console.log("DB connection successful!");
    startExpirationJob();
  })
  .catch((err) => console.log("DB connection error:", err));

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`App running on port ${port}... `);
});

startKeepAliveJob();
