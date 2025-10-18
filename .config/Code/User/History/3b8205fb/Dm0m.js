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
  
  const options = question.options.map(option => option.text);
  
  const pollMessage = await ctx.replyWithPoll(
    questionText,
    options,
    {
      is_anonymous: false,
      type: 'regular'
    }
  );
  
  const userId = ctx.from.id;
  userStore.setUser(userId, {
    currentPollMessageId: pollMessage.message_id
  });
}

bot.start(async (ctx) => {
  const welcomeText = `# КРЕЩЕНИЕ  
**Бот-помощник**

## Что умеет этот бот?  
- Подготавливает крещаемых: Основы веры, смысл Таинства, ответы на главные вопросы.  
- Инструктирует крестных: Кто может быть восприемником, какие молитвы знать, в чем заключается духовная роль.  

Выберите вашу роль:`;

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

  const welcomeMessage = await ctx.reply(
    'Вы выбрали роль крестного! Чтобы я мог лучше вам помочь, давайте пройдем небольшой тест для понимания вашего уровня знаний.',
    removeKeyboard()
  );

  userStore.setUser(userId, {
    welcomeMessageId: welcomeMessage.message_id
  });

  await startTest(ctx);
});

async function startTest(ctx) {
  const userId = ctx.from.id;
  const user = userStore.getUser(userId);
  
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

// Обработчик ответов на опросы - ИСПРАВЛЕННАЯ ВЕРСИЯ
bot.on('poll_answer', async (ctx) => {
  console.log('Poll answer received:', ctx.pollAnswer);
  
  const pollAnswer = ctx.pollAnswer;
  const userId = pollAnswer.user.id;
  const user = userStore.getUser(userId);
  
  // Проверяем, что пользователь проходит тест
  if (!user || user.state !== USER_STATES.TAKING_TEST) {
    console.log('User not in test state or not found');
    return;
  }
  
  const currentQuestionId = user.testAnswers.length + 1;
  const currentQuestion = testService.getQuestion(currentQuestionId);
  
  if (!currentQuestion) {
    console.log('No current question found for ID:', currentQuestionId);
    return;
  }
  
  // Получаем выбранный вариант
  const selectedOptionIndex = pollAnswer.option_ids[0];
  
  // Проверяем, что индекс в пределах массива
  if (selectedOptionIndex === undefined || selectedOptionIndex >= currentQuestion.options.length) {
    console.log('Invalid option index:', selectedOptionIndex);
    return;
  }
  
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
      await bot.telegram.deleteMessage(userId, user.currentPollMessageId);
    } catch (e) {
      console.log('Не удалось удалить сообщение с опросом:', e.message);
    }
  }
  
  // Переходим к следующему вопросу или завершаем тест
  const nextQuestionId = currentQuestionId + 1;
  const nextQuestion = testService.getQuestion(nextQuestionId);
  
  if (nextQuestion) {
    // Используем bot.telegram для отправки сообщения конкретному пользователю
    const nextQuestionText = `Вопрос ${testService.getProgress(nextQuestion.id)}:\n${nextQuestion.question}`;
    const options = nextQuestion.options.map(option => option.text);
    
    const pollMessage = await bot.telegram.sendPoll(
      userId,
      nextQuestionText,
      options,
      {
        is_anonymous: false,
        type: 'regular'
      }
    );
    
    userStore.setUser(userId, {
      currentPollMessageId: pollMessage.message_id
    });
  } else {
    // Завершаем тест
    await completeTestForUser(userId);
  }
});

// Функция для завершения теста для конкретного пользователя
async function completeTestForUser(userId) {
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

  await bot.telegram.sendMessage(userId, levelMessages[knowledgeLevel]);
  await bot.telegram.sendMessage(
    userId,
    'Теперь вы можете пользоваться меню. Выберите интересующий вас раздел:',
    getGodparentMenu()
  );
}

async function completeTest(ctx) {
  const userId = ctx.from.id;
  await completeTestForUser(userId);
}

// Остальные обработчики меню остаются без изменений...
bot.hears('📋 Можно ли мне быть крестным?', async (ctx) => {
  const user = userStore.getUser(ctx.from.id);
  
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
