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



// Функция для получения оценок за период
async function getGrades(dateFrom, dateTo) {
  try {
    console.log(`📅 Получаем оценки с ${dateFrom} по ${dateTo}...\n`);
    
    const params = {
      'p_education[]': '741052',
      'p_date_from': dateFrom,
      'p_date_to': dateTo,
      'p_limit': 100,
      'p_page': 1
    };

    const response = await api.get('/api/journal/estimate/table', { params });
    
    if (response.data && response.data.data && response.data.data.items) {
      const items = response.data.data.items;
      console.log(`✅ Получено ${items.length} оценок:\n`);
      
      // Группируем оценки по дате
      const gradesByDate = {};
      
      items.forEach(item => {
        const date = item.date;
        if (!gradesByDate[date]) {
          gradesByDate[date] = [];
        }
        
        gradesByDate[date].push({
          subject: item.subject_name,
          grade: item.estimate_value_name,
          type: item.estimate_type_name,
          comment: item.estimate_comment
        });
      });
      
      // Выводим оценки по датам
      Object.keys(gradesByDate).sort().forEach(date => {
        console.log(`📅 ${date}:`);
        gradesByDate[date].forEach(grade => {
          console.log(`   📚 ${grade.subject}: ${grade.grade} (${grade.type})`);
        });
        console.log('');
      });
      
      // Статистика
      console.log('📊 Статистика:');
      console.log(`   Всего оценок: ${items.length}`);
      console.log(`   Период: ${dateFrom} - ${dateTo}`);
      
    } else {
      console.log('📝 Оценок за указанный период нет');
    }
    
    return response.data;
    
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status || error.message);
    return null;
  }
}

// Функция для получения сегодняшних оценок
async function getTodayGrades() {
  const today = new Date().toLocaleDateString('ru-RU');
  return await getGrades(today, today);
}

// Функция для получения оценок за неделю
async function getWeekGrades() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  
  const dateFrom = weekAgo.toLocaleDateString('ru-RU');
  const dateTo = today.toLocaleDateString('ru-RU');
  
  return await getGrades(dateFrom, dateTo);
}

// Функция для получения оценок за текущую четверть
async function getQuarterGrades() {
  // Даты из вашего оригинального запроса
  const dateFrom = '01.09.2025';
  const dateTo = '24.10.2025';
  
  return await getGrades(dateFrom, dateTo);
}

// Функция для поиска всех предметов
async function getSubjects() {
  try {
    const today = new Date().toLocaleDateString('ru-RU');
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 30); // За последний месяц
    
    const params = {
      'p_education[]': '741052',
      'p_date_from': weekAgo.toLocaleDateString('ru-RU'),
      'p_date_to': today,
      'p_limit': 200,
      'p_page': 1
    };

    const response = await api.get('/api/journal/estimate/table', { params });
    
    if (response.data && response.data.data && response.data.data.items) {
      const subjects = new Set();
      
      response.data.data.items.forEach(item => {
        subjects.add(item.subject_name);
      });
      
      console.log('📚 Все предметы:');
      Array.from(subjects).sort().forEach((subject, index) => {
        console.log(`   ${index + 1}. ${subject}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Ошибка:', error.message);
  }
}
// Основное меню
async function main() {
  console.log('🎓 ЭЛЕКТРОННЫЙ ДНЕВНИК - СИСТЕМА ОЦЕНОК\n');
  
  // 1. Сегодняшние оценки
  console.log('1. 📅 СЕГОДНЯШНИЕ ОЦЕНКИ');
  await getTodayGrades();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 2. Оценки за неделю
  console.log('2. 📅 ОЦЕНКИ ЗА НЕДЕЛЮ');
  await getWeekGrades();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 3. Все предметы
  console.log('3. 📚 ВСЕ ПРЕДМЕТЫ');
  await getSubjects();
}

// Запуск
main();