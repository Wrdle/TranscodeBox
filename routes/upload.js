const express = require("express");
const router = express.Router();

const allowedExtensions = ["mp4", "m4v", "mkv"];

//Render upload video page
router.get("/", function (req, res) {
  res.render("index");
});

//Accept a video file upload and transcoding options
router.post("/submit", function (req, res) {
  if (req.files) {
    const file = req.files.file;
    const fileName = file.name;
    const extensionName = fileName.split(".").pop();

    console.log(extensionName);

    if (req.files.file.truncated) {
      res.render("error", { message: "File is too large. Max upload is 50MB" });
      return;
    }

    if (!allowedExtensions.includes(extensionName)) {
      res.send("Invalid file type");
      return;
    }

    file.mv(`temp/uploads/${fileName}`, (err) => {
      if (err) {
        console.log(err);
        res.send("There is error");
      } else {
        res.send("uploaded successfully");
      }
    });
  } else {
    res.send("There are no files");
  }
});

module.exports = router;
