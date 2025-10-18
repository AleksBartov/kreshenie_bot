const axios = require('axios');

// Ваши авторизационные данные
const token = "eyJ0eXAiOiJKV1QiLCJhBGciOiJUzi1NiJ9.eyJhdWQiOiJDg1MWJiZC05YzjtLTQ4NTctYjI0OCOxNDBkNTYzMmFmODQiLCJleHAiOjE3NjAzODUzODEsimlhdc16MTc2MDM4NDkwMSwiZXNrjoiZGizyzJjZjUtMmUwZi00M2E2LThhMzMtY2RhNTgzOTFKOGi3liwiZXNhaWQiOii3NDk3NTYxODg1liwiZWikijoiMTAMzM3OTg4MyJ9.gZE8EOHemBnJjG7sv1p8ww52gQU-O_i_VjP7u9UId9s";
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


// Функция для получения оценок
async function getGrades() {
  try {
    // Параметры из найденного URL
    const params = {
      'p_education[]': '741052', // ID образования (скорее всего студента/класса)
      'p_date_from': '01.09.2025', // Начальная дата
      'p_date_to': '24.10.2025',   // Конечная дата  
      'p_limit': 100,              // Лимит записей
      'p_page': 1                  // Страница
    };

    console.log('📊 Получаем оценки...');
    
    const response = await api.get('/api/journal/estimate/table', { params });
    
    console.log('✅ Успешно! Данные получены');
    console.log('Статус:', response.status);
    
    // Выводим структуру данных
    console.log('\n📋 Структура данных:');
    console.log('Ключи в ответе:', Object.keys(response.data));
    
    // Если есть данные - покажем их
    if (response.data.data) {
      console.log('\n🎯 Оценки:');
      console.log(JSON.stringify(response.data.data, null, 2));
    } else {
      console.log('\n📄 Полные данные:');
      console.log(JSON.stringify(response.data, null, 2));
    }
    
    return response.data;
    
  } catch (error) {
    console.log('❌ Ошибка получения оценок:');
    if (error.response) {
      console.log('Статус:', error.response.status);
      console.log('Данные ошибки:', error.response.data);
    } else {
      console.log('Сообщение:', error.message);
    }
  }
}

// Функция для получения сегодняшних оценок
async function getTodayGrades() {
  try {
    const today = new Date();
    const todayStr = today.toLocaleDateString('ru-RU'); // Формат DD.MM.YYYY
    
    const params = {
      'p_education[]': '741052',
      'p_date_from': todayStr,
      'p_date_to': todayStr,  
      'p_limit': 50,
      'p_page': 1
    };

    console.log(`📅 Получаем оценки за ${todayStr}...`);
    
    const response = await api.get('/api/journal/estimate/table', { params });
    
    console.log('✅ Сегодняшние оценки получены');
    
    // Упрощенный вывод
    if (response.data.data && response.data.data.length > 0) {
      console.log('\n📚 Сегодняшние оценки:');
      response.data.data.forEach((item, index) => {
        console.log(`${index + 1}. ${item.subject}  'Предмет': ${item.grade}  'нет оценки'`);
      });
    } else {
      console.log('📝 На сегодня оценок нет');
    }
    
    return response.data;
    
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status || error.message);
  }
}

// Функция для получения оценок за период
async function getGradesByPeriod(dateFrom, dateTo) {
  try {
    const params = {
      'p_education[]': '741052',
      'p_date_from': dateFrom,
      'p_date_to': dateTo,  
      'p_limit': 200,
      'p_page': 1
    };

    console.log(`📅 Оценки с ${dateFrom} по ${dateTo}...`);
    
    const response = await api.get('/api/journal/estimate/table', { params });
    
    console.log(`✅ Получено ${response.data.data?.length || 0} записей`);
    
    return response.data;
    
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status || error.message);
  }
}

// Запускаем
async function main() {
  console.log('🚀 Запуск получения оценок...\n');
  
  // 1. Получим сегодняшние оценки
  await getTodayGrades();
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 2. Получим оценки за текущую неделю
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  
  const dateFrom = weekAgo.toLocaleDateString('ru-RU');
  const dateTo = today.toLocaleDateString('ru-RU');
  
  await getGradesByPeriod(dateFrom, dateTo);
}

// Запуск
main();