const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const fileUpload = require("express-fileupload");
var AWS = require("aws-sdk");

const indexRouter = require("./routes/index");
const uploadRouter = require("./routes/upload");
const browseRouter = require("./routes/browse");

const app = express();

// Set up Pug view engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
// Set up file upload handling and enforce 50MB limit
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  })
);

app.use("/", indexRouter);
app.use("/upload", uploadRouter);
app.use("/browse", browseRouter);

AWS.config.update({ region: "ap-southeast-2" });

// Catch 404 page not found instances
app.use(function (req, res, next) {
  next(createError(404, "Error! Page not found."));
});

// Handle errors from the http-errors function
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // Render the error page
  res.status(err.status || 500);
  res.render("error", {
    code: err.status || 500,
    message: err.message || "Unknown internal server error.",
  });
});

module.exports = app;
