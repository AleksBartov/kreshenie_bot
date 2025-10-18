import {axios} from 'axios'

const token = "eyJ0eXAiOiJKV1QiLCJhBGciOiJUzi1NiJ9.eyJhdWQiOiJDg1MWJiZC05YzjtLTQ4NTctYjI0OCOxNDBkNTYzMmFmODQiLCJleHAiOjE3NjAzODUzODEsimlhdc16MTc2MDM4NDkwMSwiZXNrjoiZGizyzJjZjUtMmUwZi00M2E2LThhMzMtY2RhNTgzOTFKOGi3liwiZXNhaWQiOii3NDk3NTYxODg1liwiZWikijoiMTAMzM3OTg4MyJ9.gZE8EOHemBnJjG7sv1p8ww52gQU-O_i_VjP7u9UId9s";
const ssoKey = "db3c2cf5-2e0f-43a6-8a33-cda58391d8b7";

const cookieString = _ga=GA1.2.899629649.1760383314; _gid=GA1.2.1649209595.1760383314; _ym_uid=1760383318884942455; _ym_d=1760383318; _ym_isad=1; sso-key=${ssoKey}; X-JWT-Token=${token};

axios.get('https://dnevnik2.petersburgedu.ru/estimate', {
  headers: {
    'Cookie': cookieString,
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
  }
})
.then(response => {
  console.log('✅ Успех! Статус:', response.status);
})
.catch(error => {
  console.log('❌ Ошибка:', error.response?.status);
});