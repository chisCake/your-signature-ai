const express = require("express");
const multer = require("multer");
const controller = require("./controller");

const app = express();
const port = process.argv[2] || 3003;

app.use(express.json());

app.post("/register", controller.register);
app.post("/log", controller.log);

const uploadPlot = multer({ storage: controller.storagePlot });
app.post("/plot", uploadPlot.single("file"), controller.plot);

const uploadFile = multer({ storage: controller.storageFile });
app.post("/model", uploadFile.single("file"), controller.model);

app.listen(port, "0.0.0.0", (err) => {
  if (err) console.log(err);
  console.log("Server listening on port ", port);
});
