import { Markup } from 'telegraf';
import { CONFIG, globalMonitoringActive, authError } from '../config/index.js';
import { getKeyboardForUser, isAdmin } from '../utils/helpers.js';

export const startHandler = (bot) => {
  bot.start(async (ctx) => {
    const userId = ctx.from.id;
    
    let statusMessage = '';
    if (authError) {
      statusMessage = '🔐 *Извините, мониторинг оценок пока невозможен.*\nОбновите токен авторизации.';
    } else if (globalMonitoringActive) {
      statusMessage = '✅ *Мониторинг оценок активен!*\nБот проверяет новые оценки каждые 5 минут.';
    } else {
      statusMessage = '⏸ *Мониторинг оценок остановлен.*\nИспользуйте ручную проверку оценок.';
    }
    
    const keyboardButtons = getKeyboardForUser(userId, globalMonitoringActive);
    
    await ctx.reply(
      `🎓 *Бот для отслеживания оценок детей*\n\n${statusMessage}\n\n +
      *Доступные действия:*\n +
      • Проверить оценки вручную\n +
      • Получать уведомления о новых оценках\n\n +
      *Дети:*\n +
      👧 Варя | 👦 Ваня | 👶 Боря`,
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard(keyboardButtons).resize()
      }
    );
  });

  // Команда для отладки - покажет ID пользователя
  bot.command('myid', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.reply(`🆔 Ваш ID: ${userId}\n👑 ID админа: ${CONFIG.adminId}\n\nИспользуйте этот ID в переменной ADMIN_ID`);
  });
};