import {Telegraf, Markup} from 'telegraf'

// Ваши авторизационные данные
const token = "8487691900:AAHH4LJTm1bUYcOX6smwwnQniwg3tp5xf3U";

const bot = new Telegraf(token)

bot.command("/start", ctx=>{
  ctx.reply('',{
    parse_mode: 'MarkdownV2',
    ...Markup.keyboard(['хочу креститься'],['буду крестным']).resize()
  })
})

bot.launch().then(()=>{
  console.log('bot is running...')
})
