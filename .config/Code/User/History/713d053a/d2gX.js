import { Markup } from 'telegraf';
import { CONFIG, globalMonitoringActive, setMonitoringState } from '../config/index.js';
import { getKeyboardForUser, isAdmin } from '../utils/helpers.js';
import { checkForNewGrades, initializeMonitoring } from '../services/monitoring-service.js';

export const adminHandler = (bot) => {
  // Запуск мониторинга (только для админа)
  bot.hears('🎯 Запустить мониторинг', async (ctx) => {
    const userId = ctx.from.id;
    
    if (!isAdmin(userId)) {
      await ctx.reply('⛔ У вас нет прав для управления мониторингом.');
      return;
    }
    
    if (globalMonitoringActive) {
      await ctx.reply('✅ Мониторинг уже активен!');
      return;
    }
    
    setMonitoringState(true);
    
    await ctx.reply(
      '🎯 Запускаю глобальный мониторинг оценок!\n' +
      '⏰ Проверка каждые 5 минут\n' +
      '📅 Слежу за оценками за последние 2 дня\n\n' +
      '⏳ Инициализация...',
      Markup.keyboard(getKeyboardForUser(userId, true)).resize()
    );
    
    setTimeout(async () => {
      try {
        const initializedCount = await initializeMonitoring(bot);
        
        await ctx.reply(
          ✅ Глобальный мониторинг активен!\n +
          📊 Загружено ${initializedCount} оценок для отслеживания\n +
          🔍 Теперь буду присылать уведомления о НОВЫХ оценках
        );
        
        checkForNewGrades(bot);
        
      } catch (error) {
        await ctx.reply('❌ Ошибка инициализации мониторинга. Проверьте токен авторизации.');
      }
    }, 2000);
  });

  // Остановка мониторинга (только для админа)
  bot.hears('🛑 Остановить мониторинг', async (ctx) => {
    const userId = ctx.from.id;
    
    if (!isAdmin(userId)) {
      await ctx.reply('⛔ У вас нет прав для управления мониторингом.');
      return;
    }
    
    setMonitoringState(false);
    
    await ctx.reply(
      '🛑 Глобальный мониторинг оценок остановлен!\n' +
      'Все пользователи перестанут получать уведомления о новых оценках.',
      Markup.keyboard(getKeyboardForUser(userId, false)).resize()
    );
  });

  // Команда для принудительной остановки (только для админа)
  bot.command('stop', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      await ctx.reply('⛔ У вас нет прав для этой команды.');
      return;
    }
    
    setMonitoringState(false);
    await ctx.reply('🛑 Глобальный мониторинг оценок остановлен!');
  });
};