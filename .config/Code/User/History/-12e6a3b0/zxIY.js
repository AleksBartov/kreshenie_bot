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

// Функция для проверки авторизации
async function testAuth() {
  try {
    console.log('🔍 Проверяем авторизацию...');
    
    const response = await api.get('/estimate');
    
    console.log('✅ УСПЕХ! Авторизация работает');
    console.log('Статус:', response.status);
    
    if (response.data && response.data.includes('app-root')) {
      console.log('✅ Получена страница дневника');
    } else {
      console.log('⚠️ Получен ответ, но возможно не та страница');
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ ОШИБКА авторизации');
    
    if (error.response) {
      console.log('Статус ошибки:', error.response.status);
      
      if (error.response.status === 401) {
        console.log('💡 Токен невалидный или просроченный');
      } else if (error.response.status === 403) {
        console.log('💡 Доступ запрещен');
      }
    } else {
      console.log('Ошибка сети:', error.message);
    }
    
    return false;
  }
}

// Запуск проверки
testAuth().then(success => {
  if (success) {
    console.log('\n🎉 Отлично! Теперь можно делать API запросы к дневнику');
  } else {
    console.log('\n💡 Нужно обновить токен или проверить авторизационные данные');
  }
});