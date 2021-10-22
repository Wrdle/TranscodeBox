const express = require("express");
const router = express.Router();
var AWS = require("aws-sdk");
AWS.config.update({ region: "ap-southeast-2" });

const dbDocClient = new AWS.DynamoDB.DocumentClient();


//Render list of videos page
router.get("/", function (req, res) {
  res.render("browse");
});

//Render individual video page
router.get("/video/:uuid", function (req, res) {
  const uuid = req.params.uuid;
  fetchMetadata(uuid)
    .then(metadata => {
      res.render("video", metadata)
      console.log()
    })
    .catch(() => {
      res.render("error", { code: 404, message: "Error! Page not found." });
    })
});

function fetchMetadata(uuid) {
  const s3url =
    "https://transcodebox.s3.ap-southeast-2.amazonaws.com/" + uuid + ".mp4";

  // fetch metadata from dynamo
  const params = {
    TableName : "transcodebox",
    KeyConditionExpression: "vuuid = :vidId",
    ExpressionAttributeValues: {
        ":vidId": uuid
    }
  };

  let metadata = { 
    error: true,
    url: s3url
  }
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
