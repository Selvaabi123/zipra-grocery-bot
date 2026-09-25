const serverless = require("serverless-http");
process.chdir(__dirname + "/../..");
const { app } = require("../../src/server");
module.exports.handler = serverless(app);
