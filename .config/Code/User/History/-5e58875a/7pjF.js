const axios = require('axios');
require('dotenv').config();

const token = process.env.YANDEX_ACCESS_TOKEN;
const baseURL = 'https://cloud-api.yandex.net/v1/disk/resources';

async function testYandex() {
  console.log('🔐 Тестовый токен:', token?.substring(0, 10) + '...');
  
  const headers = {
    'Authorization': `OAuth ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    // Простая проверка доступа
    const response = await axios.get(`${baseURL}?path=/`, { headers });
    console.log('✅ Тест пройден - токен валиден');
  } catch (error) {
    console.log('❌ Тест не пройден:', error.response?.data || error.message);
  }
}

testYandex();