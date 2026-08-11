const express = require("express");

const {
  ticketController
} = require("../container/container");

const router = express.Router();

router.post(
  "/buy",
  (req, res, next) =>
    ticketController.buy(req, res, next)
);

module.exports = router;