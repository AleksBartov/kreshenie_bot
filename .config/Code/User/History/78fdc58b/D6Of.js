const { Telegraf, Markup, session } = require('telegraf');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const YandexDisk = require('./yandexDisk');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

// Инициализация Яндекс.Диска
const yandexDisk = new YandexDisk(process.env.YANDEX_ACCESS_TOKEN);

// Создаем локальные папки если их нет
fs.ensureDirSync('./data/candidates');
fs.ensureDirSync('./temp_voices');

// Загружаем блоки собеседования
let interviewBlocks = [];
try {
  interviewBlocks = require('./data/blocks.json');
} catch (error) {
  console.error('Ошибка загрузки blocks.json:', error);
  interviewBlocks = [
    {
      type: "technical",
      text: "❌ Ошибка загрузки блоков. Администратор уведомлен."
    }
  ];
}

// Переменная для статуса Яндекс.Диска
let yandexDiskEnabled = false;

// Проверка токена Яндекс.Диска при запуске
async function initializeYandexDisk() {
  try {
    const tokenCheck = await yandexDisk.checkToken();
    if (tokenCheck.success) {
      yandexDiskEnabled = true;
      console.log('✅ Яндекс.Диск: Токен валиден');
    } else {
      yandexDiskEnabled = false;
      console.log('❌ Яндекс.Диск: Токен невалиден, используем только локальное сохранение');
    }
  } catch (error) {
    yandexDiskEnabled = false;
    console.log('❌ Яндекс.Диск: Ошибка проверки токена, используем только локальное сохранение');
  }
}

// Сессии для хранения состояния
bot.use(session({ 
  defaultSession: () => ({ 
    currentBlock: 0,
    currentMessageNumber: 1,
    hasAnswered: false,
    username: 'unknown',
    userId: null,
    isCompleted: false,
    userFolderPath: '',
    yandexFolderPath: '',
    yandexFolderCreated: false
  })
}));

// Функции для работы с файлами
function getUserFolderInfo(userId, username) {
  const cleanUsername = (username || 'unknown').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const folderName = `${cleanUsername}_${getCurrentDate()}`;
  const localFolderPath = path.join('./data/candidates', `${cleanUsername}_${userId}`);
  const yandexFolderPath = `/interview_bot/${folderName}`;
  
  return { localFolderPath, yandexFolderPath, folderName };
}

function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

async function downloadAndSaveVoice(ctx, localFolderPath, fileName) {
  await fs.ensureDir(localFolderPath);
  
  const voice = ctx.message.voice;
  const file = await ctx.telegram.getFile(voice.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
  
  // Скачиваем файл
  const response = await axios({
    method: 'GET',
    url: fileUrl,
    responseType: 'stream'
  });

  const localFilePath = path.join(localFolderPath, fileName);
  const writer = fs.createWriteStream(localFilePath);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(localFilePath));
    writer.on('error', reject);
  });
}

async function saveVoiceMessage(ctx, userFolderInfo, fileName) {
  const { localFolderPath, yandexFolderPath } = userFolderInfo;
  
  try {
    // Скачиваем файл локально
    const localFilePath = await downloadAndSaveVoice(ctx, localFolderPath, fileName);
    
    // Пытаемся загрузить на Яндекс.Диск если доступен
    let uploadedToYandex = false;
    if (yandexDiskEnabled && ctx.session.yandexFolderCreated) {
      try {
        const remoteFilePath = `${yandexFolderPath}/${fileName}`;
        const uploadResult = await yandexDisk.uploadFile(localFilePath, remoteFilePath);
        uploadedToYandex = uploadResult.success;
      } catch (error) {
        console.error('Ошибка загрузки на Яндекс.Диск:', error);
        uploadedToYandex = false;
      }
    }
    
    // Сохраняем метаданные
    const metaData = {
      fileName,
      localPath: localFilePath,
      yandexPath: yandexDiskEnabled ? `${yandexFolderPath}/${fileName}` : null,
      timestamp: new Date().toISOString(),
      block: ctx.session.currentBlock,
      messageNumber: ctx.session.currentMessageNumber,
      uploadedToYandex: uploadedToYandex,
      fileSize: ctx.message.voice.file_size,
      duration: ctx.message.voice.duration
    };
    
    await fs.writeJson(path.join(localFolderPath, `${fileName}.json`), metaData);
    
    return metaData;
  } catch (error) {
    console.error('Ошибка сохранения голосового сообщения:', error);
    throw error;
  }
}

// Функции для админ-панели
function getCandidatesStats() {
  try {
    const candidates = fs.readdirSync('./data/candidates');
    const completed = candidates.filter(folder => {
      const metaPath = path.join('./data/candidates', folder, 'completed.json');
      return fs.existsSync(metaPath);
    });
    
    const active = candidates.filter(folder => {
      const metaPath = path.join('./data/candidates', folder, 'completed.json');
      return !fs.existsSync(metaPath);
    });
    
    return { total: candidates.length, completed: completed.length, active: active.length };
  } catch (error) {
    return { total: 0, completed: 0, active: 0 };
  }
}

// Показ текущего блока
async function showCurrentBlock(ctx) {
  const session = ctx.session;
  
  if (session.currentBlock >= interviewBlocks.length) {
    await completeInterview(ctx);
    return;
  }

  const currentBlock = interviewBlocks[session.currentBlock];
  
  if (!currentBlock) {
    await completeInterview(ctx);
    return;
  }

  if (currentBlock.type === 'technical') {
    await ctx.reply(currentBlock.text, 
      Markup.keyboard([['Следующий блок']]).resize()
    );
  } else {
    const keyboard = session.hasAnswered 
      ? Markup.keyboard([['Следующий блок']]).resize()
      : Markup.removeKeyboard();
    
    await ctx.reply(currentBlock.text, keyboard);
  }
}

// Завершение собеседования
async function completeInterview(ctx) {
  const session = ctx.session;
  session.isCompleted = true;
  
  // Сохраняем метаданные о завершении
  const userFolder = session.userFolderPath;
  await fs.writeJson(path.join(userFolder, 'completed.json'), {
    completedAt: new Date().toISOString(),
    totalBlocks: interviewBlocks.length,
    username: session.username,
    userId: session.userId,
    totalAnswers: session.currentMessageNumber - 1
  });

  let folderUrl = session.userFolderPath;
  
  // Пытаемся получить публичную ссылку если Яндекс.Диск доступен
  if (yandexDiskEnabled && session.yandexFolderCreated) {
    try {
      const publishResult = await yandexDisk.publishFolder(session.yandexFolderPath);
      if (publishResult.success) {
        folderUrl = publishResult.publicUrl;
      }
    } catch (error) {
      console.error('Ошибка публикации папки:', error);
    }
  }
  
  await ctx.reply(
    '✅ Собеседование завершено! Спасибо за ваши ответы.', 
    Markup.removeKeyboard()
  );
  
  // Уведомляем админа
  await notifyAdmin(ctx, folderUrl);
}

// Уведомление админа
async function notifyAdmin(ctx, folderUrl) {
  const session = ctx.session;
  const stats = getCandidatesStats();
  
  const storageStatus = yandexDiskEnabled ? 'Яндекс.Диск ✅' : 'Локальное хранилище 💾';
  
  const message = `📊 Новое завершенное собеседование!\n` +
                 `👤 Кандидат: @${session.username} (ID: ${session.userId})\n` +
                 `📁 Папка с ответами: ${folderUrl}\n` +
                 `📈 Статистика: ${stats.completed} завершено, ${stats.active} активно\n` +
                 `💾 Хранилище: ${storageStatus}`;
  
  await bot.telegram.sendMessage(ADMIN_ID, message);
}

// ==================== ОБРАБОТЧИКИ ====================

// Команда /start
bot.start(async (ctx) => {
  // Проверяем админа
  if (ctx.from.id === ADMIN_ID) {
    await showAdminPanel(ctx);
    return;
  }
  
  // Инициализация сессии для кандидата
  const userFolderInfo = getUserFolderInfo(ctx.from.id, ctx.from.username || 'unknown');
  
  ctx.session.currentBlock = 0;
  ctx.session.currentMessageNumber = 1;
  ctx.session.hasAnswered = false;
  ctx.session.username = ctx.from.username || 'unknown';
  ctx.session.userId = ctx.from.id;
  ctx.session.isCompleted = false;
  ctx.session.userFolderPath = userFolderInfo.localFolderPath;
  ctx.session.yandexFolderPath = userFolderInfo.yandexFolderPath;
  ctx.session.yandexFolderCreated = false;
  
  // Создаем папку на Яндекс.Диске если доступен
  if (yandexDiskEnabled) {
    try {
      await yandexDisk.createFolder(userFolderInfo.yandexFolderPath);
      ctx.session.yandexFolderCreated = true;
    } catch (error) {
      console.error('Ошибка создания папки на Яндекс.Диске:', error);
      ctx.session.yandexFolderCreated = false;
    }
  }
  
  await ctx.reply('🚀 Начинаем собеседование!');
  await showCurrentBlock(ctx);
});

// Админ-панель
async function showAdminPanel(ctx) {
  const stats = getCandidatesStats();
  const totalBlocks = interviewBlocks.length;
  const technicalBlocks = interviewBlocks.filter(b => b.type === 'technical').length;
  const questionBlocks = interviewBlocks.filter(b => b.type === 'question').length;
  
  const storageStatus = yandexDiskEnabled ? 'Яндекс.Диск ✅' : 'Локальное хранилище 💾';
  
  const message = `👑 Панель администратора\n\n` +
                 `📊 Статистика:\n` +
                 `• Всего кандидатов: ${stats.total}\n` +
                 `• Завершили: ${stats.completed}\n` +
                 `• Активных: ${stats.active}\n\n` +
                 `📝 Блоков в собеседовании: ${totalBlocks}\n` +
                 `• Технических: ${technicalBlocks}\n` +
                 `• Вопросов: ${questionBlocks}\n\n` +
                 `💾 Хранилище: ${storageStatus}`;

  await ctx.reply(message, 
    Markup.keyboard([
      ['📊 Статистика', '👀 Просмотреть блоки'],
      ['✏️ Редактировать блоки', '🆕 Добавить блок']
    ]).resize()
  );
}

// Обработчики для админа
bot.hears('📊 Статистика', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  await showAdminPanel(ctx);
});

bot.hears('👀 Просмотреть блоки', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  
  let message = '📋 Текущие блоки собеседования:\n\n';
  interviewBlocks.forEach((block, index) => {
    const typeIcon = block.type === 'technical' ? '🎯 ТЕХНИЧЕСКИЙ' : '❓ ВОПРОС';
    const shortText = block.text.length > 80 ? block.text.substring(0, 80) + '...' : block.text;
    message += `${index + 1}. ${typeIcon}\n${shortText}\n\n`;
  });
  
  await ctx.reply(message);
});

// Заглушки для админских функций
bot.hears('✏️ Редактировать блоки', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  await ctx.reply('✏️ Функция редактирования блоков в разработке...');
});

bot.hears('🆕 Добавить блок', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  await ctx.reply('🆕 Функция добавления блоков в разработке...');
});

// Голосовые сообщения от кандидатов
bot.on('voice', async (ctx) => {
  if (ctx.from.id === ADMIN_ID) return;
  
  const session = ctx.session;
  if (!session || session.isCompleted) {
    return ctx.reply('❌ Собеседование еще не начато или уже завершено. Используйте /start');
  }

  // Защита от выхода за пределы массива
  if (session.currentBlock >= interviewBlocks.length) {
    await completeInterview(ctx);
    return;
  }

  const currentBlock = interviewBlocks[session.currentBlock];
  if (!currentBlock || currentBlock.type !== 'question') {
    return ctx.reply('❌ Сейчас не время для ответа. Перейдите к вопросу.');
  }

  try {
    // Сохраняем голосовое сообщение
    const userFolderInfo = {
      localFolderPath: session.userFolderPath,
      yandexFolderPath: session.yandexFolderPath
    };
    
    const fileName = `${session.currentBlock}.${session.currentMessageNumber}.ogg`;
    await saveVoiceMessage(ctx, userFolderInfo, fileName);
    
    session.currentMessageNumber++;
    
    // Если первый ответ - показываем кнопку
    if (!session.hasAnswered) {
      session.hasAnswered = true;
      await ctx.reply(
        `✅ Ответ сохранен (${fileName})! Вы можете отправить еще сообщений или перейти к следующему вопросу.`,
        Markup.keyboard([['Следующий блок']]).resize()
      );
    } else {
      await ctx.reply(`✅ Дополнительный ответ сохранен (${fileName})!`);
    }
  } catch (error) {
    console.error('Ошибка обработки голосового сообщения:', error);
    await ctx.reply('❌ Произошла ошибка при сохранении ответа. Попробуйте еще раз.');
  }
});

// Кнопка "Следующий блок"
bot.hears('Следующий блок', async (ctx) => {
  if (ctx.from.id === ADMIN_ID) return;
  
  const session = ctx.session;
  if (!session) return ctx.reply('❌ Используйте /start для начала собеседования');

  // ✅ Защита от повторных нажатий после завершения
  if (session.isCompleted) {
    return ctx.reply('✅ Собеседование уже завершено. Используйте /start для нового.');
  }

  // ✅ Защита от выхода за пределы массива
  if (session.currentBlock >= interviewBlocks.length) {
    await completeInterview(ctx);
    return;
  }

  const currentBlock = interviewBlocks[session.currentBlock];
  
  // ✅ Дополнительная защита
  if (!currentBlock) {
    await completeInterview(ctx);
    return;
  }

  // Для вопросов проверяем ответ
  if (currentBlock.type === 'question' && !session.hasAnswered) {
    return ctx.reply('❌ Пожалуйста, сначала ответьте на вопрос голосовым сообщением.');
  }

  // Переход к следующему блоку
  session.currentBlock++;
  session.currentMessageNumber = 1;
  session.hasAnswered = false;
  
  // ✅ Проверяем не завершили ли сейчас
  if (session.currentBlock >= interviewBlocks.length) {
    await completeInterview(ctx);
  } else {
    await showCurrentBlock(ctx);
  }
});

// Обработчик текстовых сообщений (на случай если пользователь напишет текст вместо голосового)
bot.on('text', async (ctx) => {
  if (ctx.from.id === ADMIN_ID) return;
  if (ctx.message.text !== 'Следующий блок') {
    await ctx.reply('❌ Пожалуйста, отвечайте только голосовыми сообщениями.');
  }
});

// Запуск бота
initializeYandexDisk().then(() => {
  bot.launch().then(() => {
    console.log('🤖 Бот собеседования запущен!');
    console.log('👑 Админ ID:', ADMIN_ID);
    console.log('💾 Яндекс.Диск:', yandexDiskEnabled ? '✅ Включен' : '❌ Отключен');
  });
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
