const { Telegraf, Markup, session } = require("telegraf");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const YandexDisk = require("./yandexDisk");

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

// Инициализация Яндекс.Диска
const yandexDisk = new YandexDisk(process.env.YANDEX_ACCESS_TOKEN);

// Создаем локальные папки если их нет
fs.ensureDirSync("./data/candidates");
fs.ensureDirSync("./temp_voices");

// Загружаем блоки собеседования
let interviewBlocks = [];
try {
  interviewBlocks = require("./data/blocks.json");
} catch (error) {
  console.error("Ошибка загрузки blocks.json:", error);
}

// Сессии для хранения состояния
bot.use(
  session({
    defaultSession: () => ({
      currentBlock: 0,
      currentMessageNumber: 1,
      hasAnswered: false,
      username: "unknown",
      userId: null,
      isCompleted: false,
      userFolderPath: "",
      yandexFolderPath: "",
    }),
  })
);

// Функции для работы с файлами
function getUserFolderInfo(userId, username) {
  const folderName = `${username}_${getCurrentDate()}.toLowerCase().replace(/[^a-z0-9_]/g, '_')`;
  const localFolderPath = path.join(
    "./data/candidates",
    `${username}_${userId}`
  );
  const yandexFolderPath = `/interview_bot/${folderName}`;

  return { localFolderPath, yandexFolderPath, folderName };
}

function getCurrentDate() {
  return new Date().toISOString().split("T")[0];
}

async function downloadAndSaveVoice(ctx, localFolderPath, fileName) {
  await fs.ensureDir(localFolderPath);

  const voice = ctx.message.voice;
  const file = await ctx.telegram.getFile(voice.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  // Скачиваем файл
  const response = await axios({
    method: "GET",
    url: fileUrl,
    responseType: "stream",
  });

  const localFilePath = path.join(localFolderPath, fileName);
  const writer = fs.createWriteStream(localFilePath);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(localFilePath));
    writer.on("error", reject);
  });
}

async function saveVoiceMessage(ctx, userFolderInfo, fileName) {
  const { localFolderPath, yandexFolderPath } = userFolderInfo;

  try {
    // Скачиваем файл локально
    const localFilePath = await downloadAndSaveVoice(
      ctx,
      localFolderPath,
      fileName
    );

    // Создаем папку на Яндекс.Диске если нужно
    if (!ctx.session.yandexFolderCreated) {
      await yandexDisk.createFolder(yandexFolderPath);
      ctx.session.yandexFolderCreated = true;
    }

    // Загружаем на Яндекс.Диск
    const remoteFilePath = `${yandexFolderPath}/${fileName}`;
    const uploadResult = await yandexDisk.uploadFile(
      localFilePath,
      remoteFilePath
    );

    if (!uploadResult.success) {
      console.error("Ошибка загрузки на Яндекс.Диск:", uploadResult.error);
    }

    // Сохраняем метаданные
    const metaData = {
      fileName,
      localPath: localFilePath,
      yandexPath: remoteFilePath,
      timestamp: new Date().toISOString(),
      block: ctx.session.currentBlock,
      messageNumber: ctx.session.currentMessageNumber,
      uploadedToYandex: uploadResult.success,
    };

    await fs.writeJson(
      path.join(localFolderPath, `${fileName}.json`),
      metaData
    );

    return metaData;
  } catch (error) {
    console.error("Ошибка сохранения голосового сообщения:", error);
    throw error;
  }
}

// Функции для админ-панели
function getCandidatesStats() {
  try {
    const candidates = fs.readdirSync("./data/candidates");
    const completed = candidates.filter((folder) => {
      const metaPath = path.join("./data/candidates", folder, "completed.json");
      return fs.existsSync(metaPath);
    });

    const active = candidates.filter((folder) => {
      const metaPath = path.join("./data/candidates", folder, "completed.json");
      return !fs.existsSync(metaPath);
    });

    return {
      total: candidates.length,
      completed: completed.length,
      active: active.length,
    };
  } catch (error) {
    return { total: 0, completed: 0, active: 0 };
  }
}

// Показ текущего блока
async function showCurrentBlock(ctx) {
  const session = ctx.session;

  if (session.currentBlock >= interviewBlocks.length) {
    // Собеседование завершено
    await ctx.reply("✅ Собеседование завершено! Спасибо за ваши ответы.");
    session.isCompleted = true;

    // Сохраняем метаданные о завершении
    const userFolder = session.userFolderPath;
    await fs.writeJson(path.join(userFolder, "completed.json"), {
      completedAt: new Date().toISOString(),
      totalBlocks: interviewBlocks.length,
      username: session.username,
      userId: session.userId,
    });

    // Публикуем папку и получаем ссылку
    const publishResult = await yandexDisk.publishFolder(
      session.yandexFolderPath
    );

    // Уведомляем админа
    await notifyAdmin(ctx, publishResult.publicUrl || session.yandexFolderPath);
    return;
  }

  const currentBlock = interviewBlocks[session.currentBlock];

  if (currentBlock.type === "technical") {
    await ctx.reply(
      currentBlock.text,
      Markup.keyboard([["Следующий блок"]]).resize()
    );
  } else {
    const keyboard = session.hasAnswered
      ? Markup.keyboard([["Следующий блок"]]).resize()
      : Markup.removeKeyboard();

    await ctx.reply(currentBlock.text, keyboard);
  }
}

// Уведомление админа
async function notifyAdmin(ctx, folderUrl) {
  const session = ctx.session;
  const stats = getCandidatesStats();

  const message = `📊 Новое завершенное собеседование!\n +
                 👤 Кандидат: @${session.username} (ID: ${session.userId})\n +
                 📁 Папка с ответами: ${folderUrl}\n +
                 📈 Статистика: ${stats.completed} завершено, ${stats.active} активно`;

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
  const userFolderInfo = getUserFolderInfo(
    ctx.from.id,
    ctx.from.username || "unknown"
  );

  ctx.session.currentBlock = 0;
  ctx.session.currentMessageNumber = 1;
  ctx.session.hasAnswered = false;
  ctx.session.username = ctx.from.username || "unknown";
  ctx.session.userId = ctx.from.id;
  ctx.session.isCompleted = false;
  ctx.session.userFolderPath = userFolderInfo.localFolderPath;
  ctx.session.yandexFolderPath = userFolderInfo.yandexFolderPath;
  ctx.session.yandexFolderCreated = false;

  await ctx.reply("🚀 Начинаем собеседование!");
  await showCurrentBlock(ctx);
});

// Админ-панель
async function showAdminPanel(ctx) {
  const stats = getCandidatesStats();
  const totalBlocks = interviewBlocks.length;

  const message = `👑 Панель администратора\n\n +
                 📊 Статистика:\n +
                 • Всего кандидатов: ${stats.total}\n +
                 • Завершили: ${stats.completed}\n +
                 • Активных: ${stats.active}\n\n +
                 📝 Блоков в собеседовании: ${totalBlocks}\n +
                 • Технических: ${
                   interviewBlocks.filter((b) => b.type === "technical").length
                 }\n +
                 • Вопросов: ${
                   interviewBlocks.filter((b) => b.type === "question").length
                 }\n\n +
                 ☁️ Хранилище: Яндекс.Диск`;

  await ctx.reply(
    message,
    Markup.keyboard([
      ["📊 Статистика", "✏️ Редактировать блоки"],
      ["👀 Просмотреть блоки", "🆕 Добавить блок"],
    ]).resize()
  );
}

// Обработчики для админа
bot.hears("📊 Статистика", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  await showAdminPanel(ctx);
});

bot.hears("👀 Просмотреть блоки", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  let message = "📋 Текущие блоки собеседования:\n\n";
  interviewBlocks.forEach((block, index) => {
    const typeIcon =
      block.type === "technical" ? "🎯 ТЕХНИЧЕСКИЙ" : "❓ ВОПРОС";
    message += `${index + 1}. ${typeIcon}\n${block.text.substring(
      0,
      80
    )}...\n\n`;
  });

  await ctx.reply(message);
});
// Голосовые сообщения от кандидатов
bot.on("voice", async (ctx) => {
  if (ctx.from.id === ADMIN_ID) return;

  const session = ctx.session;
  if (!session || session.isCompleted) {
    return ctx.reply(
      "❌ Собеседование еще не начато или уже завершено. Используйте /start"
    );
  }

  const currentBlock = interviewBlocks[session.currentBlock];
  if (currentBlock.type !== "question") {
    return ctx.reply("❌ Сейчас не время для ответа. Перейдите к вопросу.");
  }

  try {
    // Сохраняем голосовое сообщение
    const userFolderInfo = {
      localFolderPath: session.userFolderPath,
      yandexFolderPath: session.yandexFolderPath,
    };

    const fileName = `${session.currentBlock}.${session.currentMessageNumber}.ogg`;
    await saveVoiceMessage(ctx, userFolderInfo, fileName);

    session.currentMessageNumber++;

    // Если первый ответ - показываем кнопку
    if (!session.hasAnswered) {
      session.hasAnswered = true;
      await ctx.reply(
        `✅ Ответ сохранен (${fileName})! Вы можете отправить еще сообщений или перейти к следующему вопросу.`,
        Markup.keyboard([["Следующий блок"]]).resize()
      );
    } else {
      await ctx.reply(`✅ Дополнительный ответ сохранен (${fileName})!`);
    }
  } catch (error) {
    console.error("Ошибка обработки голосового сообщения:", error);
    await ctx.reply(
      "❌ Произошла ошибка при сохранении ответа. Попробуйте еще раз."
    );
  }
});

// Кнопка "Следующий блок"
bot.hears("Следующий блок", async (ctx) => {
  if (ctx.from.id === ADMIN_ID) return;

  const session = ctx.session;
  if (!session)
    return ctx.reply("❌ Используйте /start для начала собеседования");

  const currentBlock = interviewBlocks[session.currentBlock];

  // Для вопросов проверяем ответ
  if (currentBlock.type === "question" && !session.hasAnswered) {
    return ctx.reply(
      "❌ Пожалуйста, сначала ответьте на вопрос голосовым сообщением."
    );
  }

  // Переход к следующему блоку
  session.currentBlock++;
  session.currentMessageNumber = 1;
  session.hasAnswered = false;

  await showCurrentBlock(ctx);
});

// Запуск бота
bot.launch().then(() => {
  console.log("🤖 Бот собеседования запущен!");
  console.log("👑 Админ ID:", ADMIN_ID);
  console.log("☁️ Интегрирован с Яндекс.Диском");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));