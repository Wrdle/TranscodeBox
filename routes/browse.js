const express = require("express");
const router = express.Router();

//Render list of videos page
router.get("/", function (req, res) {
  res.render("browse");
});

//Render individual video page
router.post("/video/:uuid", function (req, res) {
  const uuid = req.uuid;
  console.log(uuid);

  // check if video has completed
  //    if completed == false
  //      render not compelted
  //    else
  //      get url for S3
  //      render completed

  res.render("index");
});

module.exports = router;
