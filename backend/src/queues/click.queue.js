const { Queue } = require('bullmq');
const redisClient = require('../config/redis');

// Initialize BullMQ click queue
const clickQueue = new Queue('click-events', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  }
});

module.exports = clickQueue;
