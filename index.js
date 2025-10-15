import { config } from "dotenv";
import axios from "axios";
import { Telegraf, Markup } from "telegraf";

config();

// Конфигурация
const CONFIG = {
  token:
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI5ZDg1MWJiZC05YzljLTQ4NTctYjI0OC0xNDBkNTYzMmFmODQiLCJleHAiOjE3NjA1NDg5NjcsImlhdCI6MTc2MDU0ODQ4NywiZXNrIjoiYjM0MzY2MmItZTc5My00NjZmLTk4MTEtZDk2YTM1ODdiZWYzIiwiZXNhaWQiOiI3NDk3NTYxODg1IiwiZWlkIjoiMTA4NzM3OTg4MyJ9.qpTfHInE43iRZ9v89m480YtwdC2XcCLGdwSv0jrzF5I",
  ssoKey: "b343662b-e793-466f-9811-d96a3587bef3",
  checkInterval: 300000, // 5 минут
  children: {
    Varvara: { id: 614996, emoji: "👧" },
    Ivan: { id: 647827, emoji: "👦" },
    Boris: { id: 741052, emoji: "👶" },
  },
};

// Глобальные переменные для отслеживания состояния
let monitoringActive = false;
let lastCheckedGrades = new Map();

// Настройка axios с улучшенной обработкой ошибок
const createApiClient = () => {
  const cookies = {
    "sso-key": CONFIG.ssoKey,
    "X-JWT-Token": CONFIG.token,
  };

  const cookieString = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");

  return axios.create({
    baseURL: "https://dnevnik2.petersburgedu.ru",
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      Accept: "application/json, text/plain, */*",
      Cookie: cookieString,
    },
    timeout: 10000,
  });
};

// Функция для получения смайлика оценки
const getGradeEmoji = (grade) => {
  const gradeValue = parseInt(grade);
  if (isNaN(gradeValue)) {
    if (grade.includes("5")) return "🎉";
    if (grade.includes("4")) return "👍";
    if (grade.includes("3")) return "😐";
    if (grade.includes("2")) return "😞";
    return "❓";
  }

  if (gradeValue >= 4) return "🎉";
  if (gradeValue === 3) return "😐";
  if (gradeValue === 2) return "😞";
  return "💀";
};

// Форматирование одной оценки для красивого вывода
const formatGrade = (grade) => {
  const emoji = getGradeEmoji(grade.estimate_value_name);
  return `${grade.subject_name} - ${grade.estimate_value_name} ${emoji}`;
};

// Получение оценок за последние 2 дня
async function getRecentGrades(childId) {
  try {
    const api = createApiClient();
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);

    const dateTo = today.toLocaleDateString("ru-RU");
    const dateFrom = twoDaysAgo.toLocaleDateString("ru-RU");

    const url = `/api/journal/estimate/table?p_educations[]=${childId}&p_date_from=${dateFrom}&p_date_to=${dateTo}&p_limit=50&p_page=1`;

    const response = await api.get(url);

    if (response.data?.data?.items) {
      return response.data.data.items
        .filter((item) => {
          const itemDate = new Date(item.date.split(".").reverse().join("-"));
          const fromDate = new Date(twoDaysAgo);
          return itemDate >= fromDate;
        })
        .map((item) => ({
          ...item,
          uniqueId: `${item.date}_${item.subject_id}_${item.estimate_value_name}_${item.estimate_type_name}`,
        }));
    }

    return [];
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error("AUTH_ERROR");
    }
    console.error("Ошибка при получении оценок:", error.message);
    throw error;
  }
}

// Сравнение оценок и поиск новых
function findNewGrades(oldGrades, newGrades) {
  if (!oldGrades || oldGrades.length === 0) return [];

  const oldIds = new Set(oldGrades.map((g) => g.uniqueId));
  return newGrades.filter((grade) => !oldIds.has(grade.uniqueId));
}

// Форматирование сообщения для отправки
function formatGradesMessage(childName, grades) {
  if (grades.length === 0) {
    return `📝 У ${childName} ${CONFIG.children[childName].emoji} нет новых оценок`;
  }

  const header = `🎓 Новые оценки для ${childName} ${CONFIG.children[childName].emoji}:\n\n`;
  const gradesList = grades
    .map((grade) => `• ${formatGrade(grade)}`)
    .join("\n");

  return header + gradesList;
}

// Основная функция мониторинга
async function checkForNewGrades(ctx) {
  if (!monitoringActive) return;

  try {
    let anyNewGrades = false;

    for (const [childName, childData] of Object.entries(CONFIG.children)) {
      try {
        const currentGrades = await getRecentGrades(childData.id);
        const lastGrades = lastCheckedGrades.get(childName) || [];
        const newGrades = findNewGrades(lastGrades, currentGrades);

        if (newGrades.length > 0) {
          const message = formatGradesMessage(childName, newGrades);
          await ctx.reply(message);
          console.log(
            `📨 Отправлены новые оценки для ${childName}: ${newGrades.length} шт.`
          );
          anyNewGrades = true;
        }

        lastCheckedGrades.set(childName, currentGrades);
      } catch (error) {
        if (error.message === "AUTH_ERROR") {
          await ctx.reply(
            `🔐 Ошибка авторизации для ${childName}. Токен устарел.`
          );
          console.error(`Ошибка авторизации для ${childName}`);
        } else {
          console.error(`Ошибка для ${childName}:`, error.message);
        }
      }

      // Небольшая пауза между запросами для разных детей
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!anyNewGrades) {
      console.log("✅ Новых оценок нет у всех детей");
    }
  } catch (error) {
    console.error("Общая ошибка мониторинга:", error.message);
  } finally {
    // Планируем следующую проверку, если мониторинг еще активен
    if (monitoringActive) {
      setTimeout(() => checkForNewGrades(ctx), CONFIG.checkInterval);
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

    const header = `📊 Последние оценки ${childName} ${CONFIG.children[childName].emoji}:\n\n`;
    const gradesList = grades
      .map((grade) => `• ${formatGrade(grade)}`)
      .join("\n");
    return header + gradesList;
  } catch (error) {
    if (error.message === "AUTH_ERROR") {
      return `🔐 Ошибка авторизации для ${childName}. Токен устарел.`;
    }
    return `❌ Ошибка при получении оценок для ${childName}: ${error.message}`;
  }
}

// Инициализация бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Команда /start - запуск мониторинга
bot.start(async (ctx) => {
  if (monitoringActive) {
    await ctx.reply("🔍 Мониторинг оценок уже запущен!");
    return;
  }

  monitoringActive = true;
  lastCheckedGrades.clear();

  await ctx.reply(
    "🎯 Запускаю мониторинг новых оценок!\n" +
      "⏰ Проверка каждые 5 минут\n" +
      "📅 Слежу за оценками за последние 2 дня\n\n" +
      "⏳ Инициализация...",
    Markup.keyboard([
      ["🛑 Остановить мониторинг"],
      ["👧 Проверить Варю", "👦 Проверить Ваню", "👶 Проверить Борю"],
    ]).resize()
  );

  // Инициализация базы оценок
  setTimeout(async () => {
    try {
      let initializedCount = 0;

      for (const [childName, childData] of Object.entries(CONFIG.children)) {
        const currentGrades = await getRecentGrades(childData.id);
        lastCheckedGrades.set(childName, currentGrades);
        console.log(
          `📊 Инициализирована база для ${childName}: ${currentGrades.length} оценок`
        );
        initializedCount += currentGrades.length;

        // Пауза между запросами
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      await ctx.reply(
        `✅ Мониторинг активен!\n` +
          `📊 Загружено ${initializedCount} оценок для отслеживания\n` +
          `🔍 Теперь буду присылать только НОВЫЕ оценки`
      );

      // Запускаем регулярную проверку
      checkForNewGrades(ctx);
    } catch (error) {
      await ctx.reply(
        "❌ Ошибка инициализации мониторинга. Проверьте токен авторизации."
      );
      monitoringActive = false;
    }
  }, 2000);
});

// Ручная проверка конкретного ребенка
bot.hears(/Проверить (Варю|Ваню|Борю)/, async (ctx) => {
  const childMap = {
    Варю: "Varvara",
    Ваню: "Ivan",
    Борю: "Boris",
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

// Остановка мониторинга
bot.hears("🛑 Остановить мониторинг", async (ctx) => {
  monitoringActive = false;
  await ctx.reply(
    "🛑 Мониторинг оценок остановлен!\n" +
      "Для возобновления используйте /start",
    Markup.removeKeyboard()
  );
});

// Команда для принудительной остановки
bot.command("stop", async (ctx) => {
  monitoringActive = false;
  await ctx.reply("🛑 Мониторинг оценок остановлен!", Markup.removeKeyboard());
});

// Базовые команды
bot.help((ctx) =>
  ctx.reply(
    `
📚 *Команды бота:*

/start - запустить мониторинг новых оценок
/stop - остановить мониторинг
/help - показать справку

*Кнопки:*
• Проверить оценки вручную
• Остановить автоматическую проверку

*Как работает:*
- Проверяет оценки за последние 2 дня
- Присылает уведомления только о НОВЫХ оценках
- Работает автоматически каждые 5 минут
`,
    { parse_mode: "Markdown" }
  )
);

// Обработка неожиданных ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, err);
});

process.on("unhandledRejection", (error) => {
  console.error("Необработанная ошибка:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Неперехваченное исключение:", error);
});

// Запуск бота
bot.launch().then(() => {
  console.log("🤖 Бот запущен!");
  console.log("👥 Дети для мониторинга:");
  Object.entries(CONFIG.children).forEach(([name, data]) => {
    console.log(`   ${data.emoji} ${name} (ID: ${data.id})`);
  });
});

// Graceful shutdown
process.once("SIGINT", () => {
  console.log("🛑 Остановка бота...");
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  console.log("🛑 Остановка бота...");
  bot.stop("SIGTERM");
});
