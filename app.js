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

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  })
);

app.use("/", indexRouter);
app.use("/upload", uploadRouter);
app.use("/browse", browseRouter);

AWS.config.update({ region: "ap-southeast-2" });

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404, "Error! Page not found."));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error", {
    code: err.status || 500,
    message: err.message || "Unknown internal server error.",
  });
});

module.exports = app;
