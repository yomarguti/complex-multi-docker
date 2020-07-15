const keys = require('./keys');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const redis = require('redis');

const app = express();
app.use(cors());
app.use(bodyParser.json());

//Pg client setup
const { Pool } = require('pg');
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
});

pgClient.on('connect', () => {
  pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)').catch((e) => {
    console.log(e);
  });
});

//redis client setup
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});

const redisPublisher = redisClient.duplicate();

//expres route handler
app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  try {
    const values = await pgClient.query('SELECT * from values');
    console.log('values.rows:', values.rows);
    res.send(values.rows);
  } catch (error) {
    console.log('error:', error);
    res.status(402).send(error);
  }
});

app.get('/values/current', (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }

  redisClient.hset('values', index, 'Nothing yet!');
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  res.send({ working: true });
});

app.listen(5000, (err) => {
  console.log('listenning');
});
