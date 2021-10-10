const express = require("express");
const router = express.Router();

//Render list of videos page
router.get("/", function (req, res) {
  res.render("index");
});

//Render individual video page
router.post("/file", function (req, res) {
  res.render("index");
});

module.exports = router;
