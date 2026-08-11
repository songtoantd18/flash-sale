const express = require("express");

const ticketRoutes =
  require("./routes/ticket.routes");

const app = express();

app.use(express.json());

app.use("/api/tickets", ticketRoutes);

module.exports = app;