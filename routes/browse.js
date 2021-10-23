const express = require("express");
const router = express.Router();
var AWS = require("aws-sdk");
AWS.config.update({ region: "ap-southeast-2" });

const dbDocClient = new AWS.DynamoDB.DocumentClient();


//Render list of videos page
router.get("/", function (req, res) {
  fetchAllMetadata()
    .then(data => {
      res.render("browse", data)
    })
    .catch(data => {
      res.render("browse", data)
    })
});

//Render individual video page
router.get("/video/:uuid", function (req, res) {
  const uuid = req.params.uuid;
  fetchSingleMetadata(uuid)
    .then(metadata => {
      res.render("video", metadata)
    })
    .catch(() => {
      res.render("error", { code: 404, message: "Error! Page not found." });
    })
});

function fetchAllMetadata() {
  let fetchedData = {
    videos: []
  }

  // Fetch metadata of all videos from Dynamo
  const params = {
    TableName : "transcodebox"
  };

  return new Promise((resolve, reject) => {
    dbDocClient.scan(params, (err, data) => {
      if (err) {
        console.error(
          "Unable to read data. Error JSON:",
          JSON.stringify(err, null, 2)
        );
        reject(fetchedData);
      } else if (data.Items.length === 0) {
        console.error(
          "Video metadata not found. Error JSON:",
          JSON.stringify(err, null, 2)
        );  
        reject(fetchedData);
      } else {
        fetchedData.videos = data.Items
        resolve(fetchedData);
      }
    })
  })
}

function fetchSingleMetadata(uuid) {
  const s3url =
    "https://transcodebox.s3.ap-southeast-2.amazonaws.com/" + uuid + ".mp4";
  let metadata = { 
    error: true,
    url: s3url
  }

  // Fetch individual video metadata from Dynamo
  const params = {
    TableName : "transcodebox",
    KeyConditionExpression: "vuuid = :vidId",
    ExpressionAttributeValues: {
        ":vidId": uuid
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
        resolve(metadata = { ...metadata, error: false, ...data.Items.pop() });
      }
    })
  })  
}

module.exports = router;
