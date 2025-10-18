import { config } from 'dotenv';
import axios from 'axios';
import { Telegraf, Markup } from 'telegraf';

config();

// Конфигурация
const CONFIG = {
  token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI5ZDg1MWJiZC05YzljLTQ4NTctYjI0OC0xNDBkNTYzMmFmODQiLCJleHAiOjE3NjA0Nzc1MjMsImlhdCI6MTc2MDQ3NzA0MywiZXNrIjoiZGIzYzJjZjUtMmUwZi00M2E2LThhMzMtY2RhNTgzOTFkOGI3IiwiZXNhaWQiOiI3NDk3NTYxODg1IiwiZWlkIjoiMTA4NzM3OTg4MyJ9.-gQqjpUWVQ8pRR5JgiXNoXMoXPugchU2ianIKqa4Zv4",
  ssoKey: "db3c2cf5-2e0f-43a6-8a33-cda58391d8b7",
  checkInterval: 300000, // 5 минут
  adminId: process.env.ADMIN_ID || 123456789, // ID админа из переменных окружения
  children: {
    "Varvara": { id: 614996, emoji: "👧" },
    "Ivan": { id: 647827, emoji: "👦" },
    "Boris": { id: 741052, emoji: "👶" }
  }
};

// Глобальное состояние мониторинга
let globalMonitoringActive = false;
let lastCheckedGrades = new Map();
let authError = false;

// Настройка axios с улучшенной обработкой ошибок
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

// Проверка является ли пользователь админом
const isAdmin = (userId) => {
  return userId === CONFIG.adminId;
};

// Функция для форматирования даты в красивый вид
const formatDate = (dateString) => {
  const date = new Date(dateString.split('.').reverse().join('-'));
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Сегодня';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Вчера';
  } else {
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  }
};

// Функция для получения смайлика оценки
const getGradeEmoji = (grade) => {
  const gradeValue = parseInt(grade);
  if (isNaN(gradeValue)) {
    if (grade.includes('5')) return '🎉';
    if (grade.includes('4')) return '👍';
    if (grade.includes('3')) return '😐';
    if (grade.includes('2')) return '😞';
    if (grade.toLowerCase().includes('зач') || grade.toLowerCase().includes('уч')) return '✅';
    return '❓';
  }
  
  if (gradeValue >= 4) return '🎉';
  if (gradeValue === 3) return '😐';
  if (gradeValue === 2) return '😞';
  return '💀';
};

// Форматирование одной оценки для красивого вывода
const formatGrade = (grade) => {
  const emoji = getGradeEmoji(grade.estimate_value_name);
  const date = formatDate(grade.date);
  return `${grade.subject_name} - ${grade.estimate_value_name} ${emoji} (${date})`;
};

// Получение оценок за последние 2 дня
async function getRecentGrades(childId) {
  try {
    const api = createApiClient();
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);
    
    const dateTo = today.toLocaleDateString('ru-RU');
    const dateFrom = twoDaysAgo.toLocaleDateString('ru-RU');
    
    const url = /api/journal/estimate/table?p_educations[]=${childId}&p_date_from=${dateFrom}&p_date_to=${dateTo}&p_limit=50&p_page=1;
    
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
      authError = true;
      throw new Error('AUTH_ERROR');
    }
    console.error('Ошибка при получении оценок:', error.message);
    throw error;
  }
}

// Сравнение оценок и поиск новых
function findNewGrades(oldGrades, newGrades) {
  if (!oldGrades || oldGrades.length === 0) return [];
  
  const oldIds = new Set(oldGrades.map(g => g.uniqueId));
  return newGrades.filter(grade => !oldIds.has(grade.uniqueId));
}

// Форматирование сообщения для отправки
function formatGradesMessage(childName, grades) {
  if (grades.length === 0) {
    return `📝 У ${childName} ${CONFIG.children[childName].emoji} нет новых оценок`;
  }
  
  const header = `🎓 Новые оценки для ${childName} ${CONFIG.children[childName].emoji}:\n\n`;
  const gradesList = grades.map(grade => `• ${formatGrade(grade)}`).join('\n');
  
  return header + gradesList;
}

// Основная функция мониторинга
async function checkForNewGrades(bot) {
  if (!globalMonitoringActive) return;
  
  try {
    let anyNewGrades = false;
    authError = false;
    
    for (const [childName, childData] of Object.entries(CONFIG.children)) {
      try {
        const currentGrades = await getRecentGrades(childData.id);
        const lastGrades = lastCheckedGrades.get(childName) || [];
        const newGrades = findNewGrades(lastGrades, currentGrades);
        
        if (newGrades.length > 0) {
          const message = formatGradesMessage(childName, newGrades);
          // Отправляем всем пользователям, кто запустил бота
          // В реальном боте здесь нужно хранить список чатов/пользователей
          await bot.telegram.sendMessage(CONFIG.adminId, message);
          console.log(`📨 Новые оценки для ${childName}: ${newGrades.length} шт.`);
          anyNewGrades = true;
        }
        
        lastCheckedGrades.set(childName, currentGrades);
        
      } catch (error) {
        if (error.message === 'AUTH_ERROR') {
          console.error(`Ошибка авторизации для ${childName}`);
          // Уведомляем админа об ошибке авторизации
          if (isAdmin(CONFIG.adminId)) {
            await bot.telegram.sendMessage(CONFIG.adminId, 
              '🔐 Ошибка авторизации! Токен устарел. Необходимо обновить токен в настройках бота.'
            );
          }
        } else {
          console.error(`Ошибка для ${childName}:`, error.message);
        }
      }
      
      // Небольшая пауза между запросами для разных детей
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (!anyNewGrades && !authError) {
      console.log('✅ Новых оценок нет у всех детей');
    }
    
  } catch (error) {
    console.error('Общая ошибка мониторинга:', error.message);
  } finally {
    // Планируем следующую проверку, если мониторинг еще активен
    if (globalMonitoringActive) {
      setTimeout(() => checkForNewGrades(bot), CONFIG.checkInterval);
    }
  }
}

// Функция для ручной проверки оценок
async function getManualGrades(childId, childName) {
  try {
    const grades = await getRecentGrades(childId);
    if (grades.length === 0) {
      return `📝 У ${childName} ${CONFIG.children[childName].emoji} нет оценок за последние 2 дня`;
    }
    
    // Группируем оценки по дате
    const gradesByDate = {};
    grades.forEach(grade => {
      if (!gradesByDate[grade.date]) {
        gradesByDate[grade.date] = [];
      }
      gradesByDate[grade.date].push(grade);
    });
    
    let message = `📊 Последние оценки ${childName} ${CONFIG.children[childName].emoji}:\n\n`;
    
    // Сортируем даты по убыванию (свежие сначала)
    const sortedDates = Object.keys(gradesByDate).sort((a, b) => 
      new Date(b.split('.').reverse().join('-')) - new Date(a.split('.').reverse().join('-'))
    );
    
    sortedDates.forEach(date => {
      const formattedDate = formatDate(date);
      message += `📅 ${formattedDate}:\n`;
      gradesByDate[date].forEach(grade => {
        const emoji = getGradeEmoji(grade.estimate_value_name);
        message += `• ${grade.subject_name} - ${grade.estimate_value_name} ${emoji}\n`;
      });
      message += '\n';
    });
    
    return message.trim();
    } catch (error) {
    if (error.message === 'AUTH_ERROR') {
      return `🔐 Извините, мониторинг оценок пока невозможен. Ошибка авторизации.`;
    }
    return `❌ Ошибка при получении оценок для ${childName}: ${error.message}`;
  }
}

// Создание клавиатуры в зависимости от роли пользователя
function getKeyboardForUser(userId) {
  const baseButtons = [
    ['👧 Проверить Варю', '👦 Проверить Ваню', '👶 Проверить Борю']
  ];
  
  // Только админ видит кнопку управления мониторингом
  if (isAdmin(userId)) {
    if (globalMonitoringActive) {
      baseButtons.unshift(['🛑 Остановить мониторинг']);
    } else {
      baseButtons.unshift(['🎯 Запустить мониторинг']);
    }
  }
  
  return Markup.keyboard(baseButtons).resize();
}

// Инициализация бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Команда /start - информация о статусе мониторинга
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
  
  await ctx.reply(
    `🎓 *Бот для отслеживания оценок детей*\n\n${statusMessage}\n\n +
    *Доступные действия:*\n +
    • Проверить оценки вручную\n +
    • Получать уведомления о новых оценках\n\n +
    *Дети:*\n +
    👧 Варя | 👦 Ваня | 👶 Боря`,
    {
      parse_mode: 'Markdown',
      ...getKeyboardForUser(userId)
    }
  );
});

// Ручная проверка конкретного ребенка
bot.hears(/Проверить (Варю|Ваню|Борю)/, async (ctx) => {
  const childMap = {
    'Варю': 'Varvara',
    'Ваню': 'Ivan', 
    'Борю': 'Boris'
  };
  
  const childKey = childMap[ctx.match[1]];
  const childData = CONFIG.children[childKey];
  
  try {
    await ctx.reply(`🔍 Проверяю оценки для ${childKey}...`);
    const message = await getManualGrades(childData.id, childKey);
    await ctx.reply(message);
  } catch (error) {
    await ctx.reply(`❌ Ошибка при проверке ${childKey}: ${error.message}`);
  }
});

// Запуск мониторинга (только для админа)
bot.hears('🎯 Запустить мониторинг', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply('⛔ У вас нет прав для управления мониторингом.');
    return;
  }
  
  if (globalMonitoringActive) {
    await ctx.reply('✅ Мониторинг уже активен!');
    return;
  }
  
  globalMonitoringActive = true;
  authError = false;
  
  await ctx.reply(
    '🎯 Запускаю глобальный мониторинг оценок!\n' +
    '⏰ Проверка каждые 5 минут\n' +
    '📅 Слежу за оценками за последние 2 дня\n\n' +
    '⏳ Инициализация...',
    getKeyboardForUser(ctx.from.id)
  );
  
  // Инициализация базы оценок
  setTimeout(async () => {
    try {
      let initializedCount = 0;
      
      for (const [childName, childData] of Object.entries(CONFIG.children)) {
        const currentGrades = await getRecentGrades(childData.id);
        lastCheckedGrades.set(childName, currentGrades);
        console.log(`📊 Инициализирована база для ${childName}: ${currentGrades.length} оценок`);
        initializedCount += currentGrades.length;
        
        // Пауза между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      await ctx.reply(
        `✅ Глобальный мониторинг активен!\n +
        📊 Загружено ${initializedCount} оценок для отслеживания\n +
        🔍 Теперь буду присылать уведомления о НОВЫХ оценках`
      );
      
      // Запускаем регулярную проверку
      checkForNewGrades(bot);
      
    } catch (error) {
      await ctx.reply('❌ Ошибка инициализации мониторинга. Проверьте токен авторизации.');
      globalMonitoringActive = false;
      authError = true;
    }
  }, 2000);
});

// Остановка мониторинга (только для админа)
bot.hears('🛑 Остановить мониторинг', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply('⛔ У вас нет прав для управления мониторингом.');
    return;
  }
  globalMonitoringActive = false;
  
  await ctx.reply(
    '🛑 Глобальный мониторинг оценок остановлен!\n' +
    'Все пользователи перестанут получать уведомления о новых оценках.',
    getKeyboardForUser(ctx.from.id)
  );
  
  console.log('🛑 Админ остановил глобальный мониторинг');
});

// Команда для принудительной остановки (только для админа)
bot.command('stop', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply('⛔ У вас нет прав для этой команды.');
    return;
  }
  
  globalMonitoringActive = false;
  
  await ctx.reply(
    '🛑 Глобальный мониторинг оценок остановлен!',
    getKeyboardForUser(ctx.from.id)
  );
});

// Базовые команды
bot.help(ctx => ctx.reply(`
📚 *Команды бота:*

/start - показать статус мониторинга
/help - показать справку

*Для всех пользователей:*
• Проверить оценки вручную
• Видеть статус мониторинга

*Только для администратора:*
• Запуск/остановка мониторинга
• Получение уведомлений об ошибках

*Как работает:*
- Мониторинг глобальный для всех пользователей
- Проверяет оценки за последние 2 дня
- Присылает уведомления о НОВЫХ оценках
- Работает автоматически каждые 5 минут
`, { parse_mode: 'Markdown' }));

// Обработка неожиданных ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, err);
});

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