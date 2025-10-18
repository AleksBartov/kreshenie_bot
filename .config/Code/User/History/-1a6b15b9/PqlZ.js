import { Markup } from 'telegraf';
import { CONFIG, globalMonitoringActive, authError, addUser, getUserCount } from '../config/index.js';
import { getKeyboardForUser, isAdmin } from '../utils/helpers.js';

export const startHandler = (bot) => {
  bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const userName = ctx.from.first_name || 'Пользователь';
    
    addUser(userId);
    
    let statusMessage = '';
    if (authError) {
      statusMessage = '🔐 *Извините, мониторинг оценок пока невозможен.*\nОбновите токен авторизации.';
    } else if (globalMonitoringActive) {
      statusMessage = '✅ *Мониторинг оценок активен!*\nБот проверяет новые оценки каждые 5 минут.\nВы будете получать уведомления о новых оценках.';
    } else {
      statusMessage = '⏸ *Мониторинг оценок остановлен.*\nИспользуйте ручную проверку оценок.';
    }
    
    const keyboardButtons = getKeyboardForUser(userId, globalMonitoringActive);
    const totalUsers = getUserCount();
    
    await ctx.reply(
      `👋 Привет, ${userName}!\n\n` +
      `🎓 *Бот для отслеживания оценок детей*\n\n${statusMessage}\n\n` +
      `*Доступные действия:*\n` +
      `• Проверить оценки вручную\n` +
      `• Получать уведомления о новых оценках\n\n` +
      `*Дети:*\n` +
      `👧 Варя | 👦 Ваня | 👶 Боря\n\n` +
      `👥 Всего пользователей: ${totalUsers}`,
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard(keyboardButtons).resize()
      }
    );
  });

  bot.command('myid', async (ctx) => {
    const userId = ctx.from.id;
    
    await ctx.reply(
      `🆔 Ваш ID: ${userId}\n` +
      `👑 ID админа: ${CONFIG.adminId}\n` +
      `👥 Всего пользователей: ${getUserCount()}\n\n` +
      `Используйте этот ID в переменной ADMIN_ID`
    );
  });

  bot.command('stats', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      await ctx.reply('⛔ У вас нет прав для этой команды.');
      return;
    }
    
    await ctx.reply(
      `📊 *Статистика бота:*\n\n` +
      `👥 Пользователей: ${getUserCount()}\n` +
      `🔍 Мониторинг: ${globalMonitoringActive ? 'активен ✅' : 'остановлен ⏸'}\n` +
      `🔐 Авторизация: ${authError ? 'ошибка ❌' : 'в норме ✅'}\n` +
      `👑 Админ: ${CONFIG.adminId}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('unsubscribe', async (ctx) => {
    const userId = ctx.from.id;
    const { removeUser, getUserCount } = await import('../config/index.js');
    
    removeUser(userId);
    
    await ctx.reply(
      `🔕 Вы отписались от уведомлений о новых оценках.\n\n` +
      `Чтобы снова подписаться, просто отправьте /start\n\n` +
      `👥 Осталось пользователей: ${getUserCount()}`,
      Markup.removeKeyboard()
    );
  });
};
