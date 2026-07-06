const { Queue } = require('bullmq');
const redisClient = require('../config/redis');

// Initialize BullMQ click queue
const clickQueue = new Queue('click-events', {
  connection: redisClient
});

module.exports = clickQueue;
