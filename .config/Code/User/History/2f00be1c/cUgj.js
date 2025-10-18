import { config } from 'dotenv'


import {Telegraf, Markup} from 'telegraf'

config();

const bot = new Telegraf(process.env.BOT_TOKEN)
bot.start(ctx=>{
    ctx.reply('Какой-то текст', Markup.inlineKeyboard([
    Markup.button.callback('Скажу "ДА"', 'ok'),
    Markup.button.callback('Скажу "Нет"', 'cancel'),
]))
})

bot.help(ctx => ctx.reply(`Попробуйте команды:
/poll
/quiz
/inline
или напишите hi
или отправьте мне стикер`))

bot.on('sticker', ctx => ctx.reply('🥰'))

bot.hears('hi', ctx => ctx.reply(`What??? И это все, ${ctx.chat.first_name}, что ты можешь сказать?`))

bot.command('poll', ctx => ctx.replyWithPoll('Твой любимый язык программирования?', [
    'JavaScript', 'Python', 'C++', 'Lua', 'Pascal', 'Что такое "язык программирования'], { is_anonymous: false }))

bot.command('quiz', ctx=>ctx.replyWithQuiz('1 + 1 = ?', ['4', '3.14', '2', '💩'], {correct_option_id: 2}))

bot.command('inline', ctx=>ctx.reply('Какой-то текст', Markup.inlineKeyboard([
    Markup.button.callback('Скажу "ДА"', 'ok'),
    Markup.button.callback('Скажу "Нет"', 'cancel'),
])))

bot.action('ok', (ctx, next)=> ctx.answerCbQuery('Ответ Да').then(()=>next()))
bot.action('cancel', (ctx, next)=> ctx.answerCbQuery('Ответ Нет', {show_alert: true}).then(()=>next()))

bot.launch()

