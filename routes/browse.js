const express = require("express");
const router = express.Router();

//Render list of videos page
router.get("/", function (req, res) {
  res.render("browse");
});

//Render individual video page
router.get("/video/:uuid", function (req, res) {
  const uuid = req.params.uuid;
  console.log(uuid)
  const videoUrl = `https://transcodebox.s3.ap-southeast-2.amazonaws.com/${uuid}.mp4`

  res.render("video", { videoUrl })
});

module.exports = router;
