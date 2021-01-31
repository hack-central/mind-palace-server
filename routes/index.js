const express = require("express");
const nlpRoute = require("./nlp.js");

const router = express.Router();

router.use("/nlp", nlpRoute);

module.exports = router;
