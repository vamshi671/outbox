import IORedis from 'ioredis';
import { config } from './index';

export const redisConnection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
});
