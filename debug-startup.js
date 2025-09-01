const { createClient } = require('redis');

async function testRedisConnection() {
  console.log('Testing Redis connection...');
  
  const client = createClient({
    url: 'redis://default:redis@172.19.0.3:6379'
  });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  try {
    await client.connect();
    console.log('✅ Redis connected successfully');
    
    await client.ping();
    console.log('✅ Redis ping successful');
    
    await client.disconnect();
    console.log('✅ Redis disconnected successfully');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
  }
}

testRedisConnection();