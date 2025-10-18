import {Telegraf, Markup} from 'telegraf'
import {message} from 'telegraf/filters'

// Ваши авторизационные данные
const token = "8487691900:AAHH4LJTm1bUYcOX6smwwnQniwg3tp5xf3U";
 
const bot = new Telegraf(token)
 
bot.start((ctx) => ctx.reply('что вы хотите?',{
  parse_mode:'MarkdownV2',
  ...Markup.keyboard(['буду крестным','хочу креститься']).resize()
}))
bot.help((ctx) => ctx.reply('Send me a sticker'))
bot.on(message('sticker'), (ctx) => ctx.reply('👍'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))
bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))