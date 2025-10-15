import axios from 'axios';
import { CONFIG, setMonitoringState } from '../config/index.js';

// Создание API клиента
const createApiClient = () => {
  const cookies = {
    'sso-key': CONFIG.ssoKey,
    'X-JWT-Token': CONFIG.token
  };

  const cookieString = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');

  return axios.create({
    baseURL: 'https://dnevnik2.petersburgedu.ru',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Cookie': cookieString
    },
    timeout: 10000
  });
};

// Получение оценок за последние 2 дня
export const getRecentGrades = async (childId) => {
  try {
    const api = createApiClient();
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);
    
    const dateTo = today.toLocaleDateString('ru-RU');
    const dateFrom = twoDaysAgo.toLocaleDateString('ru-RU');
    
    const url = `/api/journal/estimate/table?p_educations[]=${childId}&p_date_from=${dateFrom}&p_date_to=${dateTo}&p_limit=50&p_page=1`;
    
    const response = await api.get(url);
    
    if (response.data?.data?.items) {
      return response.data.data.items
        .filter(item => {
          const itemDate = new Date(item.date.split('.').reverse().join('-'));
          const fromDate = new Date(twoDaysAgo);
          return itemDate >= fromDate;
        })
        .map(item => ({
          ...item,
          uniqueId: `${item.date}_${item.subject_id}_${item.estimate_value_name}_${item.estimate_type_name}`
        }));
    }
    
    return [];
    
  } catch (error) {
    if (error.response?.status === 401) {
      setMonitoringState(false, true);
      throw new Error('AUTH_ERROR');
    }
    console.error('Ошибка при получении оценок:', error.message);
    throw error;
  }
};