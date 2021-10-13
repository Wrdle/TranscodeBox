const express = require("express");
const handbrake = require("handbrake-js");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const fs = require("fs");
const router = express.Router();

const allowedExtensions = [".mp4", ".m4v", ".mkv"];
const allowedCodecs = [".mp4", ".mkv"];

const tempDirectory = "temp/uploads/";

const generateFilePath = (fileName) => `${tempDirectory}${fileName}`;
const getExtensionName = (fileName) => "." + fileName.split(".").pop();
const getFileNameWithoutExtension = (fileName) => fileName.split(".")[0];
const changeFileExtension = (fileName, fileExtension) =>
  getFileNameWithoutExtension(fileName) + fileExtension;

//Render upload video page
router.get("/", function (req, res) {
  res.render("upload");
});

router.get("/submitted/:uuid", function (req, res) {
  console.log(req.params);
  const uuid = req.params.uuid;
  if (uuid) {
    res.render("submitted", { uuid });
  } else {
    res.render("404");
  }
});

function generateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("md5");
  hashSum.update(fileBuffer);

  return hashSum.digest("hex");
}

function processFile(fileName, selectedCodec) {
  return handbrake
    .spawn({
      input: generateFilePath(fileName),
      output: generateFilePath(changeFileExtension(fileName, selectedCodec)),
    })
    .on("error", (err) => {
      console.log(err);
    })
    .on("progress", (progress) => {
      console.log(
        "Percent complete: %s, ETA: %s",
        progress.percentComplete,
        progress.eta
      );
    });
}

function storeFileMetaData(uuid, name, hash, originalCodec, newCodec) {
  // TODO: store in dynamo and mark as not complete
}

function markVideoAsComplete() {
  // TODO mark video as complete in dynamo db
}

function uploadToS3(currentFilePath) {
  // TODO: Upload file to S3
}

//Accept a video file upload and transcoding options
router.post("/submit", function (req, res) {
  if (req.files) {
    const file = req.files.file;
    const fileName = file.name;
    const extensionName = getExtensionName(fileName);

    console.log(extensionName);

    if (req.files.file.truncated) {
      res.render("error", { message: "File is too large. Max upload is 50MB" });
      return;
    }

    if (!allowedExtensions.includes(extensionName)) {
      res.render("error", {
        message: "Invalid file type. Only .mp4, .m4v and .mkv is allowed",
      });
      return;
    }

    const codec = req.body.codec;
    if (!allowedCodecs.includes(codec)) {
      res.render("error", {
        message: "Invalid codec selection. Only .mp4 and .m4v is allowed",
      });
      return;
    }

    const uuid = uuidv4();
    const uuidFileName = uuid + getExtensionName(fileName);
    const uuidFilePath = generateFilePath(uuidFileName);
    file.mv(uuidFilePath, (err) => {
      const fileHash = generateFileHash(uuidFilePath);
      // TODO: Perform DB check to ensure file does not already exist

      if (err) {
        console.log(err);
        res.render("error", { message: "Internal server error." });
      } else {
        res.status(200).json({ uuid: uuid });
        storeFileMetaData(
          uuid,
          "My Video",
          fileHash,
          getExtensionName(fileName),
          codec
        ); // TODO: Take video name input in pug
        processFile(uuidFileName, codec).on("complete", () => { 
          uploadToS3(uuidFilePath);
          markVideoAsComplete(uuid);
          // TODO: delete files
        });
      }
    });
  } else {
    res.render("error", { message: "No files were uploaded" });
  }
});

module.exports = router;
