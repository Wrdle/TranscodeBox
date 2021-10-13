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

// ============== ROUTES ============== //

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

//Accept a video file upload and transcoding options
router.post("/submit", function (req, res) {
  console.log("Video submitted");
  if (!isVideoValid(req, res)) {
    return;
  }
  console.log("Video valid");

  const file = req.files.file;
  const fileName = file.name;

  const uuid = uuidv4();
  const uuidFileName = uuid + getExtensionName(fileName);
  const uuidFilePath = generateFilePath(uuidFileName);

  file.mv(uuidFilePath, (err) => {
    if (err) {
      console.log(err);
      sendError(res, 500, "Internal Server Error");
      return;
    }

    const existingUUID = doesFileExist(uuidFilePath);
    if (existingUUID) {
      // delete files
      res.status(200).json({ uuid: existingUUID });
      return;
    }

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
  });
});

// ============== HELPERS ============== //

function sendError(res, status, message) {
  res.status(status).json({ error: true, message: message });
}

function isVideoValid(req, res) {
  console.log("are we here?");
  if (!req.files) {
    console.log("error thrown");
    sendError(res, 400, "No files were uploaded");
    console.log("error thrown 2");
    return false;
  }

  console.log("file uploaded");

  const fileName = req.files.file.name;
  const extensionName = getExtensionName(fileName);

  if (req.files.file.truncated) {
    sendError(res, 413, "File is too large. Max upload is 50MB");
    return false;
  }

  console.log("file small enough");

  console.log(extensionName);
  if (!allowedExtensions.includes(extensionName)) {
    sendError(
      res,
      415,
      "Invalid file type. Only .mp4, .m4v and .mkv is allowed"
    );
    return false;
  }

  console.log("file type not allowed");

  const codec = req.body.codec;
  if (!allowedCodecs.includes(codec)) {
    sendError(
      res,
      400,
      "Invalid codec selection. Only .mp4 and .m4v is allowed"
    );
    return false;
  }
  return true;
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

function generateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("md5");
  hashSum.update(fileBuffer);

  return hashSum.digest("hex");
}

function doesFileExist(filepath) {
  const fileHash = generateFileHash(filepath);
  // TODO: check dynamodb if file exists and if it does, return the UUID
  return null;
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

module.exports = router;
