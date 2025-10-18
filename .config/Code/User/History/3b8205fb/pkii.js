
import { Telegraf, Markup } from 'telegraf';
import { config } from 'dotenv';
import { userStore } from './services/userStore.js';
import { testService } from './services/testService.js';
import { USER_STATES } from './config/index.js';

config();

const bot = new Telegraf(process.env.BOT_TOKEN);

function getGodparentMenu() {
  return Markup.keyboard([
    ['📋 Можно ли мне быть крестным?'],
    ['📚 Подготовка к Таинству'],
    ['⛪ Обряд Крещения: что делать в храме'],
    ['🙏 Духовные обязанности крестного'],
    ['❓ Частые вопросы']
  ]).resize();
}

function removeKeyboard() {
  return Markup.removeKeyboard();
}

function getTestKeyboard(question) {
  const buttons = question.options.map(option => 
    [Markup.button.callback(option.text, `test_answer_${question.id}_${option.id}`)]
  );
  return Markup.inlineKeyboard(buttons);
}

bot.start(async (ctx) => {
  const welcomeText = `Выберите вашу роль:`;

  await ctx.reply(welcomeText, Markup.keyboard([
    ['🙋 Я буду крестным', '🎯 Хочу креститься сам']
  ]).resize());
  
  userStore.updateUserState(ctx.from.id, USER_STATES.START);
});

bot.hears('🙋 Я буду крестным', async (ctx) => {
  const userId = ctx.from.id;
  
  userStore.setUser(userId, { 
    role: 'godparent',
    state: USER_STATES.TAKING_TEST
  });

  // Убираем клавиатуру выбора роли и не показываем меню
  const welcomeMessage =  await ctx.reply(
    'Вы выбрали роль крестного! Чтобы я мог лучше вам помочь, давайте пройдем небольшой тест для понимания вашего уровня знаний.',
    removeKeyboard()
  );

  userStore.setUser( userId, { welcomeMessageId: welcomeMessage.message_id})

  await startTest(ctx);
});

async function startTest(ctx) {
  const userId = ctx.from.id;
  const user = userStore.getUser(userId);
  
  // Удаляем приветственное сообщение
  if (user.welcomeMessageId) {
    try {
      await ctx.deleteMessage(user.welcomeMessageId);
    } catch (e) {
      console.log('Не удалось удалить приветственное сообщение:', e.message);
    }
  }
  
  userStore.setUser(userId, {
    state: USER_STATES.TAKING_TEST,
    testAnswers: [],
    currentQuestion: 1
  });

  const firstQuestion = testService.getQuestion(1);
  await ctx.reply(
    `Чтобы понять ваш уровень знаний о Православии, ответьте, пожалуйста, на следующие вопросы:\n\nВопрос ${testService.getProgress(1)}:\n${firstQuestion.question}`,
    getTestKeyboard(firstQuestion)
  );
}

bot.action(/test_answer_(\d+)_(.+)/, async (ctx) => {
  await ctx.answerCbQuery(); // Снимаем "часики" с кнопки
  
  const userId = ctx.from.id;
  const user = userStore.getUser(userId);
  
  // Если это ПЕРВЫЙ ответ - удаляем приветственное сообщение (на случай если не удалилось в startTest)
  if (user.testAnswers.length === 0 && user.welcomeMessageId) {
    try {
      await ctx.deleteMessage(user.welcomeMessageId);
    } catch (e) {
      console.log('Не удалось удалить приветственное сообщение в action:', e.message);
    }
  }
  
  const questionId = parseInt(ctx.match[1]);
  const answer = ctx.match[2];

  // Сохраняем ответ
  user.testAnswers.push({ questionId, answer });
  userStore.setUser(userId, user);

  // Удаляем предыдущее сообщение с кнопками чтобы избежать путаницы
  try {
    await ctx.deleteMessage();
  } catch (e) {
    console.log('Не удалось удалить сообщение:', e.message);
  }

  // Переходим к следующему вопросу или завершаем тест
  const nextQuestionId = questionId + 1;
  const nextQuestion = testService.getQuestion(nextQuestionId);

  if (nextQuestion) {
    await ctx.reply(
      `Вопрос ${testService.getProgress(nextQuestionId)}:\n${nextQuestion.question}`,
      getTestKeyboard(nextQuestion)
    );
  } else {
    await completeTest(ctx);
  }
});

async function completeTest(ctx) {
  const userId = ctx.from.id;
  const user = userStore.getUser(userId);
  
  const knowledgeLevel = testService.calculateLevel(user.testAnswers);
  userStore.setUser(userId, {
    knowledgeLevel,
    state: USER_STATES.TEST_COMPLETED
  });

  const levelMessages = {
    beginner: 'Спасибо за ответы! Я вижу, что вы только начинаете знакомство с верой. Я буду давать вам простые и понятные объяснения.',
    basic: 'Спасибо за ответы! У вас есть базовые знания. Я буду дополнять их и помогать углубить понимание.',
    churched: 'Спасибо за ответы! Вижу, что вы уже воцерковлены. Смогу давать вам более глубокие материалы и ссылки на источники.'
  };

  await ctx.reply(levelMessages[knowledgeLevel]);
  
  // ТОЛЬКО СЕЙЧАС показываем меню после завершения всех вопросов
  await ctx.reply(
    'Теперь вы можете пользоваться меню. Выберите интересующий вас раздел:',
    getGodparentMenu()
  );
}

// Обработчики меню (работают только после завершения теста)
bot.hears('📋 Можно ли мне быть крестным?', async (ctx) => {
  const user = userStore.getUser(ctx.from.id);
  
  // Проверяем, завершил ли пользователь тест
  if (user.state !== USER_STATES.TEST_COMPLETED) {
    await ctx.reply('Пожалуйста, сначала завершите тест для доступа к меню.');
    return;
  }

  let response = '';
  switch(user.knowledgeLevel) {
    case 'beginner':
      response = 'Здесь будет простое объяснение для начинающих о том, кто может быть крестным...';
      break;
    case 'basic':
      response = 'Здесь будет базовое объяснение с основными требованиями к крестным...';
      break;
    case 'churched':
      response = 'Здесь будет подробное объяснение с ссылками на каноны и церковные правила...';
      break;
    default:
      response = 'Раздел "Можно ли мне быть крестным?" в разработке...';
  }

  await ctx.reply(response);
});

bot.hears('📚 Подготовка к Таинству', async (ctx) => {
  const user = userStore.getUser(ctx.from.id);
  if (user.state !== USER_STATES.TEST_COMPLETED) {
    await ctx.reply('Пожалуйста, сначала завершите тест для доступа к меню.');
    return;
  }
  await ctx.reply('Раздел "Подготовка к Таинству" в разработке...');
});

bot.hears('⛪ Обряд Крещения: что делать в храме', async (ctx) => {
  const user = userStore.getUser(ctx.from.id);
  if (user.state !== USER_STATES.TEST_COMPLETED) {
    await ctx.reply('Пожалуйста, сначала завершите тест для доступа к меню.');
    return;
  }
  await ctx.reply('Раздел "Обряд Крещения" в разработке...');
});

bot.hears('🙏 Духовные обязанности крестного', async (ctx) => {
  const user = userStore.getUser(ctx.from.id);
  if (user.state !== USER_STATES.TEST_COMPLETED) {
    await ctx.reply('Пожалуйста, сначала завершите тест для доступа к меню.');
    return;
  }
  await ctx.reply('Раздел "Духовные обязанности" в разработке...');
});

bot.hears('❓ Частые вопросы', async (ctx) => {
  const user = userStore.getUser(ctx.from.id);
  if (user.state !== USER_STATES.TEST_COMPLETED) {
    await ctx.reply('Пожалуйста, сначала завершите тест для доступа к меню.');
    return;
  }
  await ctx.reply('Раздел "Частые вопросы" в разработке...');
});

bot.launch().then(() => {
  console.log('Бот запущен!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
