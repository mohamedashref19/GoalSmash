const Sentry = require("@sentry/node");
Sentry.init({
  dsn: "https://0e5b45bad320d1060deada2bdd1fd63d@o4512203777769472.ingest.de.sentry.io/4512203801428048",
});
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
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:8081",
      "http://localhost",
      "capacitor://localhost",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
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

//startKeepAliveJob();
