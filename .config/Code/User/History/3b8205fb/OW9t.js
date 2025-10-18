
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

async function sendTestQuestion(ctx, question) {
  const questionText = `Вопрос ${testService.getProgress(question.id)}:\n${question.question}`;
  
  // Создаем массив вариантов ответов из question.options
  const options = question.options.map(option => option.text);
  
  // Отправляем опрос
  const pollMessage = await ctx.replyWithPoll(
    questionText,
    options,
    {
      is_anonymous: false, // Чтобы видеть, кто ответил
      type: 'regular' // Один вариант ответа
    }
  );
  
  // Сохраняем ID сообщения с опросом для возможного удаления
  const userId = ctx.from.id;
  const user = userStore.getUser(userId);
  userStore.setUser(userId, {
    currentPollMessageId: pollMessage.message_id
  });
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

  // Сохраняем сообщение с приветствием (возвращает отправленное сообщение)
  const welcomeMessage = await ctx.reply(
    'Вы выбрали роль крестного! Чтобы я мог лучше вам помочь, давайте пройдем небольшой тест для понимания вашего уровня знаний.',
    removeKeyboard()
  );

  // Сохраняем ID сообщения для последующего удаления
  userStore.setUser(userId, {
    welcomeMessageId: welcomeMessage.message_id
  });

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
  await sendTestQuestion(ctx, firstQuestion);
}

// Обработчик ответов на опросы
bot.on('poll_answer', async (ctx) => {
  const userId = ctx.from.id;
  const user = userStore.getUser(userId);
  
  // Проверяем, что пользователь проходит тест
  if (user.state !== USER_STATES.TAKING_TEST) return;
  
  const pollAnswer = ctx.pollAnswer;
  const currentQuestionId = user.testAnswers.length + 1;
  const currentQuestion = testService.getQuestion(currentQuestionId);
  
  if (!currentQuestion) return;
  
  // Получаем выбранный вариант (pollAnswer.option_ids содержит массив индексов)
  const selectedOptionIndex = pollAnswer.option_ids[0];
  const selectedOption = currentQuestion.options[selectedOptionIndex];
  
  // Сохраняем ответ
  user.testAnswers.push({ 
    questionId: currentQuestionId, 
    answer: selectedOption.id 
  });
  userStore.setUser(userId, user);
  
  // Удаляем предыдущий опрос
  if (user.currentPollMessageId) {
    try {
      await ctx.deleteMessage(user.currentPollMessageId);
    } catch (e) {
      console.log('Не удалось удалить сообщение с опросом:', e.message);
    }
  }
  
  // Переходим к следующему вопросу или завершаем тест
  const nextQuestionId = currentQuestionId + 1;
  const nextQuestion = testService.getQuestion(nextQuestionId);
  
  if (nextQuestion) {
    await sendTestQuestion(ctx, nextQuestion);
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
