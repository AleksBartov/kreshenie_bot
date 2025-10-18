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



// Функция для создания точного URL (как в браузере)
function createExactUrl(educationId, dateFrom, dateTo, limit = 100, page = 1) {
  // Кодируем параметры точно как в браузере
  const params = new URLSearchParams();
  params.append('p_educations[]', educationId);  // ← ИСПРАВЛЕНО: p_educations[] вместо p_education[]
  params.append('p_date_from', dateFrom);
  params.append('p_date_to', dateTo);
  params.append('p_limit', limit.toString());
  params.append('p_page', page.toString());
  
  return `/api/journal/estimate/table?${params.toString()}`;
}

// Основная функция для получения оценок
async function getGrades(periodName, dateFrom, dateTo) {
  try {
    console.log(`\n📅 ${periodName} (${dateFrom} - ${dateTo})`);
    console.log('='.repeat(50));
    
    const url = createExactUrl('614996', dateFrom, dateTo, 200, 1);
    const response = await api.get(url);
    
    if (response.data && response.data.data && response.data.data.items) {
      const items = response.data.data.items;
      
      if (items.length === 0) {
        console.log('📝 Оценок нет');
        return;
      }
      
      // Фильтруем только нужный период
      const periodItems = items.filter(item => {
        const itemDate = new Date(item.date.split('.').reverse().join('-'));
        const fromDate = new Date(dateFrom.split('.').reverse().join('-'));
        const toDate = new Date(dateTo.split('.').reverse().join('-'));
        return itemDate >= fromDate && itemDate <= toDate;
      });
      
      console.log(`📊 Найдено ${periodItems.length} оценок:\n`);
      
      // Группируем по датам
      const byDate = {};
      periodItems.forEach(item => {
        if (!byDate[item.date]) byDate[item.date] = [];
        byDate[item.date].push(item);
      });
      
      // Выводим по датам (сортировка по убыванию - свежие сначала)
      Object.keys(byDate)
        .sort((a, b) => new Date(b.split('.').reverse().join('-')) - new Date(a.split('.').reverse().join('-')))
        .forEach(date => {
          console.log(`🗓️  ${date}:`);
          byDate[date].forEach(grade => {
            const subject = grade.subject_name.padEnd(25, ' ');
            const type = grade.estimate_type_name.padEnd(20, ' ');
            console.log(`   📚 ${subject} ${grade.estimate_value_name} (${type})`);
          });
          console.log('');
        });
      
      // Статистика по предметам
      const bySubject = {};
      periodItems.forEach(item => {
        if (!bySubject[item.subject_name]) bySubject[item.subject_name] = [];
        bySubject[item.subject_name].push(item.estimate_value_name);
      });
      
      console.log('📈 Статистика по предметам:');
      Object.keys(bySubject).sort().forEach(subject => {
        const grades = bySubject[subject];
        const avg = grades.reduce((sum, grade) => sum + parseInt(grade), 0) / grades.length;
        console.log(`   ${subject.padEnd(25)}: ${grades.join(', ')} | Средняя: ${avg.toFixed(2)}`);
      });
      
    } else {
      console.log('📝 Оценок не найдено');
    }
    
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status || error.message);
  }
}

// Функции для разных периодов
async function getCurrentWeekGrades() {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1); // Понедельник текущей недели
  
  const dateFrom = weekStart.toLocaleDateString('ru-RU');
  const dateTo = today.toLocaleDateString('ru-RU');
  await getGrades('ТЕКУЩАЯ НЕДЕЛЯ', dateFrom, dateTo);
}

async function getOctoberGrades() {
  await getGrades('ОКТЯБРЬ 2025', '01.10.2025', '31.10.2025');
}

async function getSeptemberGrades() {
  await getGrades('СЕНТЯБРЬ 2025', '01.09.2025', '30.09.2025');
}

async function getCurrentQuarterGrades() {
  await getGrades('1 ЧЕТВЕРТЬ', '01.09.2025', '24.10.2025');
}

// Функция для получения сегодняшних оценок
async function getTodayGrades() {
  const today = new Date().toLocaleDateString('ru-RU');
  await getGrades('СЕГОДНЯ', today, today);
}

// Главная функция
async function main() {
  console.log('🎓 ЭЛЕКТРОННЫЙ ДНЕВНИК - ОБЗОР ОЦЕНОК');
  console.log('='.repeat(50));
  
  // Получаем оценки за разные периоды
  await getTodayGrades();
  await getCurrentWeekGrades();
  await getOctoberGrades();
  await getSeptemberGrades();
  await getCurrentQuarterGrades();
}

// Запуск
main().catch(console.error);