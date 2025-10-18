import { Telegraf } from 'telegraf';
import { config } from 'dotenv';
import { CONFIG } from './config/index.js';
import { startHandler } from './handlers/start-handler.js';
import { gradeHandler } from './handlers/grade-handler.js';
import { adminHandler } from './handlers/admin-handler.js';
import { commonHandler } from './handlers/common-handler.js';

config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Инициализация обработчиков
startHandler(bot);
gradeHandler(bot);
adminHandler(bot);
commonHandler(bot);

// Обработка ошибок процесса
process.on('unhandledRejection', (error) => {
  console.error('Необработанная ошибка:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Неперехваченное исключение:', error);
});

// Запуск бота
bot.launch().then(() => {
  console.log('🤖 Бот запущен!');
  console.log('👥 Дети для мониторинга:');
  Object.entries(CONFIG.children).forEach(([name, data]) => {
    console.log(`   ${data.emoji} ${name} (ID: ${data.id})`);
  });
  console.log(`👑 Админ бота: ${CONFIG.adminId}`);
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('🛑 Остановка бота...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('🛑 Остановка бота...');
  bot.stop('SIGTERM');
});