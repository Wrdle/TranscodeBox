const express = require("express");
const router = express.Router();
const handbrake = require('handbrake-js')
const hash = require('object-hash');
const AWS = require('aws-sdk');
const fs = require('fs');
require('dotenv').config();

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
    let fileHash;

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
        fileHash = hash(file);
        const options = {
          input: `temp/uploads/${fileName}`,
          output: `temp/uploads/conversion.m4v`,
          preset: `Very Fast 1080p30`
        }

        handbrake.spawn(options)
          .on('error', err => {
            console.log(err);
          })
          .on('progress', progress => {
            console.log(
              'Percent complete: %s, ETA: %s',
              progress.percentComplete,
              progress.eta
            )
          })
          .on('end', () => {
            fs.readFile(`temp/uploads/conversion.m4v`, (err, data) => {
              const bucketName = `transcodebox`
              const objectParams = {Bucket: bucketName, Key: `${fileHash}`, Body: data};
              const uploadPromise = new AWS.S3({apiVersion: '2009-03-01'}).putObject(objectParams).promise();
              uploadPromise
                .then(() => {
                  console.log("successfully uploaded to S3")
                })
                .catch(err => {
                  console.log(err);
                }) 
              console.log('Conversion complete.');
            })
          })
        res.send("uploaded successfully");
      }
    });
  } else {
    res.send("There are no files");
  }
});

module.exports = router;
