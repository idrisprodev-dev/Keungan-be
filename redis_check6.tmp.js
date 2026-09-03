const Redis = require('ioredis');
const fs = require('fs');
(async () => {
  let url = fs.readFileSync('.env','utf8').split('\n').find(l => l.startsWith('REDIS_URL='));
  url = url.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
  const redis = new Redis(url, { tls: { rejectUnauthorized: false }, lazyConnect: true, connectTimeout: 12000, maxRetriesPerRequest: 1, retryStrategy: () => null });
  await redis.connect();
  const wait = await redis.lrange('bull:subscription-reminder:wait', 0, -1);
  const delayed = await redis.zrange('bull:subscription-reminder:delayed', 0, -1);
  const active = await redis.lrange('bull:subscription-reminder:active', 0, -1);
  console.log('WAIT jobs:', wait.length, JSON.stringify(wait));
  console.log('DELAYED jobs:', delayed.length, delayed.map(x => 'id='+x+':'+(JSON.parse(x).next??JSON.parse(x).delay)));
  console.log('ACTIVE jobs:', active.length);
  await redis.quit();
})().catch(e => console.log('ERR', e.message));
