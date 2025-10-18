import { config } from 'dotenv'


import {Telegraf, Markup} from 'telegraf'

config();

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

bot.action('varvara', (ctx, next)=> ctx.answerCbQuery('varyas grades', {show_alert: true}).then(()=>next()))
bot.action('ivan', (ctx, next)=> ctx.answerCbQuery('ivans grades', {show_alert: true}).then(()=>next()))
bot.action('boris', (ctx, next)=> ctx.answerCbQuery('borises grades', {show_alert: true}).then(()=>next()))


bot.launch()

