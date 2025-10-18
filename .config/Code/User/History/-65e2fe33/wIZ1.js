
import { CONFIG, globalMonitoringActive, lastCheckedGrades, setMonitoringState, allUsers } from '../config/index.js';
import { getRecentGrades } from './dnevnik-api.js';
import { findNewGrades } from '../utils/helpers.js';
import { formatGradesMessage } from '../utils/formatters.js';

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
          await sendToAllUsers(bot, message);
          console.log(`📨 Новые оценки для ${childName}: ${newGrades.length} шт. Отправлено ${allUsers.size} пользователям`);
          anyNewGrades = true;
        }
        
        lastCheckedGrades.set(childName, currentGrades);
        
      } catch (error) {
        if (error.message === 'AUTH_ERROR') {
          console.error(`Ошибка авторизации для ${childName}`);
          try {
            await bot.telegram.sendMessage(CONFIG.adminId, 
              '🔐 Ошибка авторизации! Токен устарел. Необходимо обновить токен в настройках бота.'
            );
          } catch (adminError) {
            console.error('Не удалось уведомить админа об ошибке:', adminError.message);
          }
        } else if (error.message === 'SERVER_ERROR') {
          console.error(`Ошибка сервера для ${childName}`);
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

const sendToAllUsers = async (bot, message) => {
  const failedUsers = [];
  
  const sendPromises = Array.from(allUsers).map(async (userId) => {
    try {
      await bot.telegram.sendMessage(userId, message);
      console.log(`✅ Уведомление отправлено пользователю ${userId}`);
      return { userId, success: true };
    } catch (error) {
      console.error(`❌ Не удалось отправить уведомление пользователю ${userId}:`, error.message);
      
      if (error.description && (
        error.description.includes('bot was blocked') || 
        error.description.includes('chat not found') ||
        error.description.includes('user is deactivated')
      )) {
        failedUsers.push(userId);
      }
      
      return { userId, success: false, error };
    }
  });
  
  const results = await Promise.all(sendPromises);
  
  if (failedUsers.length > 0) {
    failedUsers.forEach(userId => {
      allUsers.delete(userId);
    });
    console.log(`🗑 Удалены неактивные пользователи: ${failedUsers.join(', ')}`);
  }
  
  const successfulSends = results.filter(result => result.success).length;
  const failedSends = results.length - successfulSends;
  
  console.log(`📊 Статистика отправки: ${successfulSends} успешно, ${failedSends} с ошибками`);
  
  return {
    total: results.length,
    successful: successfulSends,
    failed: failedSends,
    failedUsers: failedUsers
  };
};

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
    
    if (allUsers.size > 0) {
      const welcomeMessage = '🎯 Мониторинг оценок запущен! Буду присылать уведомления о новых оценках.';
      await sendToAllUsers(bot, welcomeMessage);
    }
    
    return initializedCount;
    
  } catch (error) {
    setMonitoringState(false, true);
    throw error;
  }
};

export const sendSystemMessageToAll = async (bot, message) => {
  return await sendToAllUsers(bot, `ℹ️ ${message}`);
};

export const sendToAdmin = async (bot, message) => {
  try {
    await bot.telegram.sendMessage(CONFIG.adminId, message);
    return true;
  } catch (error) {
    console.error('Не удалось отправить сообщение админу:', error.message);
    return false;
  }
};
