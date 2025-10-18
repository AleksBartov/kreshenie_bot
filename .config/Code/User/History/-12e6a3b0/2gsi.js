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

// 1. САМЫЙ ПРОСТОЙ ЗАПРОС - точная копия из браузера
async function exactBrowserRequest() {
  console.log('1. 🎯 ТОЧНАЯ КОПИЯ ЗАПРОСА ИЗ БРАУЗЕРА\n');
  
  try {
    // Тот URL который точно работал
    const exactUrl = 'https://dnevnik2.petersburgedu.ru/api/journal/estimate/table?p_educations%5B%5D=741052&p_date_from=01.09.2025&p_date_to=24.10.2025&p_limit=100&p_page=1';
    
    const response = await api.get(exactUrl);
    console.log('✅ УСПЕХ! Статус:', response.status);
    
    if (response.data && response.data.data && response.data.data.items) {
      const items = response.data.data.items;
      console.log(`📊 Получено ${items.length} оценок`);
      
      // Покажем несколько последних оценок
      console.log('\n📅 Последние 5 оценок:');
      items.slice(-5).forEach((item, index) => {
        console.log(`   ${item.date} - ${item.subject_name}: ${item.estimate_value_name} (${item.estimate_type_name})`);
      });
    }
    
    return true;
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status);
    return false;
  }
}

// 2. ПРОСТОЙ ЗАПРОС С МИНИМАЛЬНЫМИ ПАРАМЕТРАМИ
async function simpleRequest() {
  console.log('\n2. 🎯 ПРОСТОЙ ЗАПРОС С МИНИМУМОМ ПАРАМЕТРОВ\n');
  
  try {
    const params = {
      'p_education[]': '741052',
      'p_date_from': '01.09.2025',
      'p_date_to': '24.10.2025'
      // Без limit и page
    };

    const response = await api.get('/api/journal/estimate/table', { params });
    console.log('✅ УСПЕХ! Статус:', response.status);
    
    if (response.data && response.data.data) {
      console.log('📊 Данные получены');
    }
    
    return true;
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status);
    return false;
  }
}

// 3. ЗАПРОС С РАЗНЫМИ ФОРМАТАМИ ПАРАМЕТРОВ
async function differentParamFormats() {
  console.log('\n3. 🎯 ТЕСТИРУЕМ РАЗНЫЕ ФОРМАТЫ ПАРАМЕТРОВ\n');
  
  const testCases = [
    {
      name: 'Формат как в браузере',
      params: { 'p_education[]': '741052', 'p_date_from': '01.09.2025', 'p_date_to': '13.10.2025' }
    },
    {
      name: 'Без квадратных скобок',
      params: { 'p_education': '741052', 'p_date_from': '01.09.2025', 'p_date_to': '13.10.2025' }
    },
    {
      name: 'Только education',
      params: { 'p_education[]': '741052' }
    },
    {
      name: 'Только даты',
      params: { 'p_date_from': '01.09.2025', 'p_date_to': '13.10.2025' }
    }
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`🧪 Тест: ${testCase.name}...`);
      const response = await api.get('/api/journal/estimate/table', { 
        params: testCase.params 
      });
      
      console.log(`✅ Успех! Статус: ${response.status}`);
      
    } catch (error) {
      console.log(`❌ Ошибка: ${error.response?.status}`);
    }
  }
}

// 4. ПОЛУЧЕНИЕ ДАННЫХ ПО ЧАСТЯМ
async function getDataStepByStep() {
  console.log('\n4. 🎯 ПОЛУЧАЕМ ДАННЫЕ ПОЭТАПНО\n');
  
  // Этап 1: Получаем ВСЕ данные которые есть
  try {
    const allDataParams = {
      'p_education[]': '741052',
      'p_date_from': '01.01.2025',
      'p_date_to': '31.12.2025',
      'p_limit': 500
    };

    console.log('📥 Получаем все оценки за год...');
    const response = await api.get('/api/journal/estimate/table', { 
      params: allDataParams 
    });
    
    if (response.data && response.data.data && response.data.data.items) {
      const items = response.data.data.items;
      console.log(`✅ Получено ${items.length} оценок за год`);
      // Группируем по месяцам
      const byMonth = {};
      items.forEach(item => {
        const month = item.date.split('.')[1]; // Получаем месяц
        if (!byMonth[month]) byMonth[month] = [];
        byMonth[month].push(item);
      });
      
      console.log('\n📅 Распределение по месяцам:');
      Object.keys(byMonth).sort().forEach(month => {
        console.log(`   Месяц ${month}: ${byMonth[month].length} оценок`);
      });
      
      // Покажем последние 10 оценок
      console.log('\n📚 Последние 10 оценок:');
      items.slice(-10).forEach(item => {
        console.log(`   ${item.date} - ${item.subject_name}: ${item.estimate_value_name}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Ошибка на этапе 1:', error.response?.status);
  }
}

// 5. ПОИСК ДРУГИХ API ENDPOINTS
async function findOtherEndpoints() {
  console.log('\n5. 🎯 ИЩЕМ ДРУГИЕ ПОЛЕЗНЫЕ ENDPOINTS\n');
  
  const endpoints = [
    '/api/user/info',
    '/api/student/info',
    '/api/journal/info',
    '/api/schedule',
    '/api/progress'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await api.get(endpoint);
      console.log(`✅ ${endpoint} - Статус: ${response.status}`);
      
      if (response.data) {
        console.log('   Данные:', JSON.stringify(response.data).substring(0, 100));
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - ${error.response?.status || 'Нет ответа'}`);
    }
  }
}

// ОСНОВНАЯ ФУНКЦИЯ
async function main() {
  console.log('🚀 ПОСТЕПЕННОЕ ПОЛУЧЕНИЕ ДАННЫХ ИЗ ДНЕВНИКА\n');
  
  // Запускаем по порядку
  await exactBrowserRequest();
  await simpleRequest(); 
  await differentParamFormats();
  await getDataStepByStep();
  await findOtherEndpoints();
  
  console.log('\n🎉 ДИАГНОСТИКА ЗАВЕРШЕНА!');
  console.log('💡 Теперь видно какие запросы работают, а какие нет');
}

main();