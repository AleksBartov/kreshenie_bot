const axios = require('axios');

// Ваши авторизационные данные
const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI5ZDg1MWJiZC05YzljLTQ4NTctYjI0OC0xNDBkNTYzMmFmODQiLCJleHAiOjE3NjAzODgxNzEsImlhdCI6MTc2MDM4NzY5MSwiZXNrIjoiZGIzYzJjZjUtMmUwZi00M2E2LThhMzMtY2RhNTgzOTFkOGI3IiwiZXNhaWQiOiI3NDk3NTYxODg1IiwiZWlkIjoiMTA4NzM3OTg4MyJ9.IArB4TASqE5l8vrLWc2b5AihvH_771UPyh8sqLxAEv0";
const ssoKey = "db3c2cf5-2e0f-43a6-8a33-cda58391d8b7";

// Куки как объект
const cookies = {
  '_ga': 'GA1.2.899629649.1760383314',
  '_gid': 'GA1.2.1649209595.1760383314', 
  '_ym_uid': '1760383318884942455',
  '_ym_d': '1760383318',
  '_ym_isad': '1',
  'sso-key': ssoKey,
  'X-JWT-Token': token
};

// Преобразуем объект куки в строку
const cookieString = Object.entries(cookies)
  .map(([key, value]) => `${key}=${value}`)
  .join('; ');

// Настройка axios
const api = axios.create({
  baseURL: 'https://dnevnik2.petersburgedu.ru',
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cookie': cookieString
  }
});



// Функция для тестирования разных параметров
async function testWithDifferentParams() {
  console.log('🔍 Тестируем разные параметры...\n');
  
  const testCases = [
    {
      name: 'Без параметров',
      params: {}
    },
    {
      name: 'Только даты',
      params: {
        'p_date_from': '13.10.2025',
        'p_date_to': '13.10.2025'
      }
    },
    {
      name: 'С лимитом',
      params: {
        'p_date_from': '13.10.2025',
        'p_date_to': '13.10.2025',
        'p_limit': 50
      }
    },
    {
      name: 'Без education',
      params: {
        'p_date_from': '13.10.2025',
        'p_date_to': '13.10.2025',
        'p_limit': 50,
        'p_page': 1
      }
    }
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`🧪 Тест: ${testCase.name}...`);
      const response = await api.get('/api/journal/estimate/table', { 
        params: testCase.params 
      });
      
      console.log(`✅ Успех! Статус: ${response.status}`);
      
      if (response.data && Object.keys(response.data).length > 0) {
        console.log('📊 Данные получены!');
        console.log('Ключи:', Object.keys(response.data));
      }
      
    } catch (error) {
      console.log(`❌ Ошибка: ${error.response?.status || error.message}`);
      
      if (error.response?.data) {
        console.log('Детали ошибки:', JSON.stringify(error.response.data));
      }
    }
    console.log('---');
  }
}

// Функция чтобы посмотреть реальный запрос из браузера
async function replicateBrowserRequest() {
  console.log('📋 Копируем точный запрос из браузера...\n');
  
  try {
    // Этот URL из вашего скриншота - попробуем его точную копию
    const exactUrl = 'https://dnevnik2.petersburgedu.ru/api/journal/estimate/table?p_educations%5B%5D=741052&p_date_from=01.09.2025&p_date_to=24.10.2025&p_limit=100&p_page=1';
    
    const response = await api.get(exactUrl);
    console.log('✅ Успех! Статус:', response.status);
    
    if (response.data) {
      console.log('📊 Структура данных:');
      console.log(JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status);
    console.log('💡 Попробуем найти правильный ID образования...');
    
    // Давайте найдем какой education ID используется сейчас
    await findCurrentEducationId();
  }
}

// Функция для поиска текущего education ID
async function findCurrentEducationId() {
  console.log('\n🔎 Ищем текущий education ID...');
  
  // Попробуем разные возможные endpoints для получения информации о пользователе
  const userEndpoints = [
    '/api/user/profile',
    '/api/student/profile', 
    '/api/current/user',
    '/api/me'
  ];
  
  for (const endpoint of userEndpoints) {
    try {
      const response = await api.get(endpoint);
      console.log(`✅ ${endpoint} - Статус: ${response.status}`);
      console.log('Данные:', JSON.stringify(response.data).substring(0, 200));
    } catch (error) {
      console.log(`❌ ${endpoint} - ${error.response?.status || error.message}`);
    }
  }
}

// Запуск
async function main() {
  console.log('🚀 Запуск диагностики...\n');
  
  // 1. Сначала попробуем точную копию URL из браузера
  await replicateBrowserRequest();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 2. Если не сработает - тестируем разные параметры
  await testWithDifferentParams();
}

main();