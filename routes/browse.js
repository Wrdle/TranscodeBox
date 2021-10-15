const express = require("express");
const router = express.Router();

//Render list of videos page
router.get("/", function (req, res) {
  res.render("browse");
});

//Render individual video page
router.get("/video/:uuid", function (req, res) {
  const uuid = req.params.uuid;

  const metadata = fetchMetadata(uuid);

  // check if video has completed
  //    if completed == false
  //      render not compelted
  //    else
  //      get url for S3
  //      render completed

  metadata.s3url =
    "https://transcodebox.s3.ap-southeast-2.amazonaws.com/" + uuid + ".mp4";

  res.render("video", metadata);
});

function fetchMetadata(uuid) {
  // fetch metadata from dynamo
  return {};
}

module.exports = router;
