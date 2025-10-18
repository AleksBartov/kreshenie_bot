import { config } from 'dotenv'
import axios from 'axios';


import {Telegraf, Markup} from 'telegraf'

config();

// Ваши авторизационные данные
const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI5ZDg1MWJiZC05YzljLTQ4NTctYjI0OC0xNDBkNTYzMmFmODQiLCJleHAiOjE3NjA0Nzc1MjMsImlhdCI6MTc2MDQ3NzA0MywiZXNrIjoiZGIzYzJjZjUtMmUwZi00M2E2LThhMzMtY2RhNTgzOTFkOGI3IiwiZXNhaWQiOiI3NDk3NTYxODg1IiwiZWlkIjoiMTA4NzM3OTg4MyJ9.-gQqjpUWVQ8pRR5JgiXNoXMoXPugchU2ianIKqa4Zv4";
const ssoKey = "db3c2cf5-2e0f-43a6-8a33-cda58391d8b7";
const IDes = {
  "Varvara": 614996,
  "Ivan": 647827,
  "Boris": 741052
}

// Куки как объект
const cookies = {
  '_ga': 'GA1.2.899629649.1760383314',
  '_gid': 'GA1.2.1649209595.1760383314', 
  '_ym_uid': '1760383318884942455',
  '_ym_d': '1760383318',
  '_ym_isad': '1',
  'sso-key': ssoKey,
  'X-JWT-Token': token
};

// Преобразуем объект куки в строку
const cookieString = Object.entries(cookies)
  .map(([key, value]) => `${key}=${value}`)
  .join('; ');

// Настройка axios
const api = axios.create({
  baseURL: 'https://dnevnik2.petersburgedu.ru',
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cookie': cookieString
  }
});



// Функция для создания точного URL (как в браузере)
function createExactUrl(educationId, dateFrom, dateTo, limit = 100, page = 1) {
  // Кодируем параметры точно как в браузере
  const params = new URLSearchParams();
  params.append('p_educations[]', educationId);  // ← ИСПРАВЛЕНО: p_educations[] вместо p_education[]
  params.append('p_date_from', dateFrom);
  params.append('p_date_to', dateTo);
  params.append('p_limit', limit.toString());
  params.append('p_page', page.toString());
  
  return `/api/journal/estimate/table?${params.toString()}`;
}

// Основная функция для получения оценок
async function getGrades(periodName, dateFrom, dateTo, n) {
    const result = []
  try {
    console.log(`\n📅 ${periodName} (${dateFrom} - ${dateTo})`);
    console.log('='.repeat(50));
    
    const url = createExactUrl(n === 1 ? IDes.Varvara : n === 2 ? IDes.Ivan : IDes.Boris, dateFrom, dateTo, 200, 1);
    const response = await api.get(url);
    
    if (response.data && response.data.data && response.data.data.items) {
      const items = response.data.data.items;
      
      if (items.length === 0) {
        console.log('📝 Оценок нет');
        return;
      }
      
      // Фильтруем только нужный период
      const periodItems = items.filter(item => {
        const itemDate = new Date(item.date.split('.').reverse().join('-'));
        const fromDate = new Date(dateFrom.split('.').reverse().join('-'));
        const toDate = new Date(dateTo.split('.').reverse().join('-'));
        return itemDate >= fromDate && itemDate <= toDate;
      });
      
      console.log(`📊 Найдено ${periodItems.length} оценок:\n`);
      
      // Группируем по датам
      const byDate = {};
      periodItems.forEach(item => {
        if (!byDate[item.date]) byDate[item.date] = [];
        byDate[item.date].push(item);
      });
      
      // Выводим по датам (сортировка по убыванию - свежие сначала)
      Object.keys(byDate)
        .sort((a, b) => new Date(b.split('.').reverse().join('-')) - new Date(a.split('.').reverse().join('-')))
        .forEach(date => {
          byDate[date].forEach(grade => {
            const subject = grade.subject_name.padEnd(25, ' ');
            const type = grade.estimate_type_name.padEnd(20, ' ');
            const answer = `${subject} ${grade.estimate_value_name} (${type})`
            console.log(answer)
            result.push(answer)

          });
        });
      
      
    } else {
      console.log('📝 Оценок не найдено');
    }
    
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status || error.message);
  }
  return result
}

async function getTodayGrades(n) {
  const today = new Date()
today.setDate(today.getDate()-1)
  const yesterday = today.toLocaleDateString('ru-RU');
  return await getGrades('ВЧЕРА', yesterday, yesterday,n);
  
}

const bot = new Telegraf(process.env.BOT_TOKEN)
bot.start((ctx) => {
    
    return ctx.reply('Ну что, начнем?',
        Markup.keyboard([
            [Markup.button.pollRequest('🙋‍♀️ Создать опросник', 'regular'),
            Markup.button.pollRequest('🙋‍♀️ Создать викторину', 'quiz')],
            ['hi', '/poll', '/quiz', '/inline']
        ]).oneTime().resize())
})

bot.help(ctx => ctx.reply(`Попробуйте команды:
/poll
/quiz
/inline
или напишите hi
или отправьте мне стикер`))

bot.on('sticker', ctx => ctx.reply('🥰'))

bot.hears('дети', ctx => ctx.reply(`Выбери кого оценки посмотрим:`, Markup.inlineKeyboard([
    Markup.button.callback('Варя', 'varvara'),
    Markup.button.callback('Ваня', 'ivan'),
    Markup.button.callback('Боря', 'boris'),
])))

bot.command('poll', ctx => ctx.replyWithPoll('Твой любимый язык программирования?', [
    'JavaScript', 'Python', 'C++', 'Lua', 'Pascal', 'Что такое "язык программирования'], { is_anonymous: false }))

bot.command('quiz', ctx=>ctx.replyWithQuiz('1 + 1 = ?', ['4', '3.14', '2', '💩'], {correct_option_id: 2}))

bot.command('inline', ctx=>ctx.reply('Какой-то текст', Markup.inlineKeyboard([
    Markup.button.callback('Скажу "ДА"', 'ok'),
    Markup.button.callback('Скажу "Нет"', 'cancel'),
])))

bot.action('ok', (ctx, next)=> ctx.answerCbQuery('Ответ Да').then(()=>next()))
bot.action('cancel', (ctx, next)=> ctx.answerCbQuery('Ответ Нет', {show_alert: true}).then(()=>next()))

bot.action('varvara', async(ctx, next)=> {
    const grades = await getTodayGrades(1);
    ctx.answerCbQuery()
    ctx.reply(grades.map(g=>{
        return`<b>${g}</b>\n`
    }), {parse_mode:'HTML'})
})
bot.action('ivan',  async(ctx, next)=> {
    const grades = await getTodayGrades(2);
    ctx.answerCbQuery()
    ctx.reply(grades.map(g=>{
        return`<b>${g}</b>\n`
    }), {parse_mode:'HTML'})
})
bot.action('boris', async(ctx, next)=> {
    const grades = await getTodayGrades(3);
    ctx.answerCbQuery()
    ctx.reply(grades.map(g=>{
        return`<b>${g}</b>\n`
    }), {parse_mode:'HTML'})
})


bot.launch()

