const express = require("express");
const handbrake = require("handbrake-js");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const fs = require("fs");
var AWS = require("aws-sdk");

AWS.config.update({ region: "ap-southeast-2" });

const router = express.Router();

const allowedExtensions = [".mp4", ".m4v", ".mkv"];
const allowedPresets = {
  "720p": "Fast 720p30",
  "576p": "Fast 576p25",
  "480p": "Fast 480p30",
};

const tempDirectory = "temp/uploads/";

const generateFilePath = (fileName) => `${tempDirectory}${fileName}`;
const getExtensionName = (fileName) => "." + fileName.split(".").pop();
const getFileNameWithoutExtension = (filename) => fileName.split(".")[0];

const dbDocClient = new AWS.DynamoDB.DocumentClient();
const autoscaling = new AWS.AutoScaling({ apiVersion: "2011-01-01" });

// ============== ROUTES ============== //

//Render upload video page
router.get("/", function (req, res) {
  res.render("upload");
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
  const filePath = generateFilePath(fileName);

  const uuid = uuidv4();
  const uuidFileName = uuid + ".mp4";
  const uuidFilePath = generateFilePath(uuidFileName);

  const outputResolution = req.body.resolution;
  const title =
    req.body.title !== undefined
      ? req.body.title
      : getFileNameWithoutExtension(fileName);

  file.mv(filePath, (err) => {
    if (err) {
      console.log(err);
      sendError(res, 500, "Internal Server Error");
      return;
    }

    const fileHash = generateFileHash(filePath);

    doesFileExist(fileHash).then((metadata) => {
      if (metadata && metadata.finalResolution === outputResolution) {
        deleteFilesAsync([filePath]);
        res.status(200).json({ uuid: metadata.vuuid, exists: true });
        return;
      }

      res.status(200).json({ uuid: uuid, exists: false });
      storeFileMetaData(
        uuid,
        title,
        fileHash,
        getExtensionName(fileName),
        outputResolution
      );

      scaleOutQueue();

      processFile(fileName, uuidFileName, outputResolution)
        .then(() => uploadToS3(uuidFileName, uuidFilePath))
        .then(() => markVideoAsComplete(uuid))
        .then(() => deleteFilesAsync([filePath, uuidFilePath]))
        .then(() => scaleInQueue())
        .catch((err) => {
          console.log(err);
        });
    });
  });
});

// ============== ERROR HANDLERS & VALIDATORS ============== //

function sendError(res, status, message) {
  res.status(status).json({ error: true, message: message });
}

function isVideoValid(req, res) {
  if (!req.files) {
    sendError(res, 400, "No files were uploaded");
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

  const resolution = req.body.resolution;
  if (!Object.keys(allowedPresets).includes(resolution)) {
    sendError(
      res,
      400,
      "Invalid resolution selection. Only 720p and 576p and 480p is allowed"
    );
    return false;
  }
  return true;
}

// ============== PROCESSORS & HELPERS ============== //

function processFile(fileName, uuid, resolution) {
  return new Promise((resolve, reject) => {
    handbrake
      .spawn({
        input: generateFilePath(fileName),
        output: generateFilePath(uuid),
        preset: allowedPresets[resolution],
      })
      .on("error", (err) => {
        reject(err);
      })
      .on("progress", (progress) => {
        console.log(
          "Percent complete: %s, ETA: %s",
          progress.percentComplete,
          progress.eta
        );
      })
      .on("end", () => {
        resolve();
      });
  });
}

function deleteFilesAsync(filepaths) {
  filepaths.forEach((filepath) => {
    fs.unlink(filepath, () => console.log("Deleted file: " + filepath));
  });
}

function generateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("SHA512");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

function doesFileExist(hash) {
  var params = {
    TableName: "transcodebox",
    IndexName: "transcodebox-filehash-index",
    KeyConditionExpression: "filehash = :fh",
    ExpressionAttributeValues: {
      ":fh": hash,
    },
  };

  return new Promise((resolve, reject) => {
    dbDocClient.query(params, function (err, data) {
      if (err) {
        console.log("Unable to query. Error:", JSON.stringify(err, null, 2));
        reject(err);
      } else {
        const metadata = data.Items.pop();
        resolve(metadata !== undefined ? metadata : null);
      }
    });
  });
}

function storeFileMetaData(uuid, name, hash, originalCodec, finalResolution) {
  const params = {
    TableName: "transcodebox",
    Item: {
      vuuid: uuid,
      name: name,
      filehash: hash,
      originalCodec: originalCodec,
      finalResolution: finalResolution,
      completed: false,
      date: new Date().toISOString(),
    },
  };

  dbDocClient.put(params, (err, data) => {
    if (err) {
      console.error(
        "Unable to add item. Error JSON:",
        JSON.stringify(err, null, 2)
      );
    } else {
      console.log("Added item:", JSON.stringify(data, null, 2));
    }
  });
}

function markVideoAsComplete(uuid) {
  return new Promise((resolve, reject) => {
    const params = {
      TableName: "transcodebox",
      Key: {
        vuuid: uuid,
      },
      UpdateExpression: "set completed = :c",
      ExpressionAttributeValues: {
        ":c": true,
      },
      ReturnValues: "UPDATED_NEW",
    };

    dbDocClient.update(params, function (err, data) {
      if (err) {
        console.error(
          "Unable to update item. Error JSON:",
          JSON.stringify(err, null, 2)
        );
        reject();
      } else {
        console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
        resolve();
      }
    });
  });
}

function uploadToS3(uuidFileName, currentFilePath) {
  return new Promise((resolve, reject) => {
    const bucketName = `transcodebox`;

    fs.readFile(currentFilePath, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          Bucket: bucketName,
          Key: `${uuidFileName}`,
          Body: data,
        });
      }
    });
  }).then((objectParams) => {
    return new AWS.S3({ apiVersion: "2009-03-01" })
      .putObject(objectParams)
      .promise()
      .then(() => {
        console.log("successfully uploaded to S3");
      });
  });
}

function scaleOutQueue() {
  //Update processing queue and check if scaling out is required
    let queueSize = 0;
    fetchQueue()
        .then((currentLength) => {
            queueSize = currentLength + 1;
            increaseQueue(currentLength);
        })
        .then(() => desiredCapacity())
        .then((capacity) => {
            if (
                capacity.DesiredCapacity <= queueSize &&
                capacity.DesiredCapacity !== capacity.MaxSize
            ) {
                increaseCapacity(capacity.DesiredCapacity);
            }
        })
        .catch((err) => {
            console.error(err);
        });
}

function scaleInQueue() {
    //Update processing queue and check if scaling in is required
    let queueSize = 0;
    fetchQueue()
        .then((currentLength) => {
            console.log(currentLength);
            if (currentLength > 0) {
                queueSize = currentLength - 1;
                decreaseQueue(currentLength);
            }
        })
        .then(() => desiredCapacity())
        .then((capacity) => {
            if (
                capacity.DesiredCapacity >= queueSize + 2 &&
                capacity.DesiredCapacity !== capacity.MinSize
            ) {
                decreaseCapacity(capacity.DesiredCapacity);
            } else {
            }
        })
        .catch((err) => {
            console.error(err);
        });
}

function fetchQueue() {
    // Fetch processing queue length from dynamo
    const params = {
        TableName: "transcodebox-queue",
        KeyConditionExpression: "queue_id = :qId",
        ExpressionAttributeValues: {
            ":qId": "0"
        }
    };

    return new Promise((resolve, reject) => {
        dbDocClient.query(params, (err, data) => {
            if (err) {
                console.error(
                    "Unable to read data. Error JSON:",
                    JSON.stringify(err, null, 2)
                );
                reject("Unable to read data.");
            } else if (data.Items.length === 0) {
                console.error(
                    "Video metadata not found. Error JSON:",
                    JSON.stringify(err, null, 2)
                );
                reject("Video metadata not found.");
            } else {
                resolve(data.Items[0].queue_length);
            }
        });
    });
}

function decreaseQueue(currentQueue) {
    // Decrease processing queue length
    const params = {
        TableName: "transcodebox-queue",
        Key: {
            queue_id: "0"
        },
        UpdateExpression: "set queue_length = :c",
        ExpressionAttributeValues: {
            ":c": currentQueue - 1
        },
        ReturnValues: "UPDATED_NEW"
    };

    return new Promise((resolve, reject) => {
        dbDocClient.update(params, (err, data) => {
            if (err) {
                console.error(
                    "Unable to read data. Error JSON:",
                    JSON.stringify(err, null, 2)
                );
                reject("Unable to update");
            } else {
                resolve(data);
            }
        });
    });
}

function increaseQueue(currentQueue) {
    // Increase processing queue length
    const params = {
        TableName: "transcodebox-queue",
        Key: {
            queue_id: "0"
        },
        UpdateExpression: "set queue_length = :c",
        ExpressionAttributeValues: {
            ":c": currentQueue + 1
        },
        ReturnValues: "UPDATED_NEW"
    };

    return new Promise((resolve, reject) => {
        dbDocClient.update(params, (err, data) => {
            if (err) {
                console.error(
                    "Unable to read data. Error JSON:",
                    JSON.stringify(err, null, 2)
                );
                reject("Unable to update");
            } else {
                resolve(data);
            }
        });
    });
}

function desiredCapacity() {
    // Fetch current ASG desired capacity
    const params = {
        AutoScalingGroupNames: ["n10470140-TranscodeBox-dev"]
    };
    return new Promise((resolve, reject) => {
        autoscaling.describeAutoScalingGroups(params, function (err, data) {
            if (err) {
                console.error(
                    "Unable to read capcity",
                    JSON.stringify(err, null, 2)
                );
                reject("Unable to read data.");
            } else if (data.AutoScalingGroups.length === 0) {
                console.error(
                    "ASG not found. Error JSON:",
                    JSON.stringify(err, null, 2)
                );
                reject("Unable to read data.");
            } else {
                resolve({
                    MinSize: data.AutoScalingGroups[0].MinSize,
                    MaxSize: data.AutoScalingGroups[0].MaxSize,
                    DesiredCapacity: data.AutoScalingGroups[0].DesiredCapacity
                });
            }
        });
    });
}

function decreaseCapacity(currentCapacity) {
    // Decrease ASG desired capacity by one
    const params = {
        AutoScalingGroupName: "n10470140-TranscodeBox-dev",
        DesiredCapacity: currentCapacity - 1,
        HonorCooldown: false
    };
    return new Promise((resolve, reject) => {
        autoscaling.setDesiredCapacity(params, function (err, data) {
            if (err) {
                console.error(
                    "Unable to update capcity",
                    JSON.stringify(err, null, 2)
                );
                reject("Unable to update capacity");
            } else {
                resolve();
            }
        });
    });
}

function increaseCapacity(currentCapacity) {
    // Increase ASG desirec capacity by one
    const params = {
        AutoScalingGroupName: "n10470140-TranscodeBox-dev",
        DesiredCapacity: currentCapacity + 1,
        HonorCooldown: false
    };
    return new Promise((resolve, reject) => {
        autoscaling.setDesiredCapacity(params, function (err, data) {
            if (err) {
                console.error(
                    "Unable to update capcity",
                    JSON.stringify(err, null, 2)
                );
                reject("Unable to update capacity");
            } else {
                resolve();
            }
        });
    });
}

module.exports = router;
