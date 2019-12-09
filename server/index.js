const keys = require("./keys");
const express = require("express");
const app = express();
const cors = require("cors");
require("body-parser");
app.use(cors());
app.use(express.json());
const Pool = require("pg").Pool;
const redis = require("redis");
const redisClient = redis.createClient({
  host: keys.REDIS_HOST,
  port: keys.REDIS_PORT,
  retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate();

const pgClient = new Pool({
  port: keys.PG_PORT,
  user: keys.PG_USER,
  password: keys.PG_PASSWORD,
  database: keys.PG_DATABASE,
  host: keys.PG_HOST
});

pgClient
  .query("CREATE TABLE IF NOT EXISTS values (Number Int)")
  .then(() => {
    console.log(`Table Created Successfully`);
  })
  .catch(err => {
    console.log(err);
  });

pgClient.on("error", function() {
  console.log(`Lost PG Connection`);
});

app.get("/", function(req, res) {
  res.send("Main Route");
});

app.get("/values/all", async function(req, res) {
  const values = await pgClient.query("SELECT * FROM values");
  res.send(values.rows);
});

app.get("/values/current", async function(req, res) {
  redisClient.hgetall("values", (err, values) => {
    res.send(values);
  });
});

app.post("/values/", async function(req, res) {
  const { index } = req.body;
  if (parseInt(index) > 40) {
    return res.status(422).send("Index High");
  }
  redisClient.hset("values", index, "nothing yet");
  redisPublisher.publish("insert", index);
  await pgClient.query("INSERT INTO values (Number) VALUES ($1)", [index]);
  res.send("WORK TRUE");
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`App Connected At port ${port}`);
});
