const express = require("express");
const router = express.Router();

//Render home/documentation page
router.get("/", function (req, res) {
  res.render("index");
});

module.exports = router;
