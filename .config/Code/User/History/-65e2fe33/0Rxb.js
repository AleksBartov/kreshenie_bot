import { CONFIG, globalMonitoringActive, lastCheckedGrades, setMonitoringState } from '../config/index.js';
import { getRecentGrades } from './dnevnik-api.js';
import { findNewGrades } from '../utils/helpers.js';
import { formatGradesMessage } from '../utils/formatters.js';

// Основная функция мониторинга
export const checkForNewGrades = async (bot) => {
  if (!globalMonitoringActive) return;
  
  try {
    let anyNewGrades = false;
    setMonitoringState(true, false);
    
    for (const [childName, childData] of Object.entries(CONFIG.children)) {
      try {
        const currentGrades = await getRecentGrades(childData.id);
        const lastGrades = lastCheckedGrades.get(childName) || [];
        const newGrades = findNewGrades(lastGrades, currentGrades);
        
        if (newGrades.length > 0) {
          const message = formatGradesMessage(childName, newGrades);
          await bot.telegram.sendMessage(CONFIG.adminId, message);
          console.log(`📨 Новые оценки для ${childName}: ${newGrades.length} шт.`);
          anyNewGrades = true;
        }
        
        lastCheckedGrades.set(childName, currentGrades);
        
      } catch (error) {
        if (error.message === 'AUTH_ERROR') {
          console.error(`Ошибка авторизации для ${childName}`);
          await bot.telegram.sendMessage(CONFIG.adminId, 
            '🔐 Ошибка авторизации! Токен устарел. Необходимо обновить токен в настройках бота.'
          );
        } else {
          console.error(`Ошибка для ${childName}:`, error.message);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (!anyNewGrades) {
      console.log('✅ Новых оценок нет у всех детей');
    }
    
  } catch (error) {
    console.error('Общая ошибка мониторинга:', error.message);
  } finally {
    if (globalMonitoringActive) {
      setTimeout(() => checkForNewGrades(bot), CONFIG.checkInterval);
    }
  }
};

// Инициализация базы оценок
export const initializeMonitoring = async (bot) => {
  try {
    let initializedCount = 0;
    
    for (const [childName, childData] of Object.entries(CONFIG.children)) {
      const currentGrades = await getRecentGrades(childData.id);
      lastCheckedGrades.set(childName, currentGrades);
      console.log(`📊 Инициализирована база для ${childName}: ${currentGrades.length} оценок`);
      initializedCount += currentGrades.length;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return initializedCount;
    
  } catch (error) {
    setMonitoringState(false, true);
    throw error;
  }
};