import { Telegraf} from 'telegraf'
import {token} from './token.js'

const bot = new Telegraf(token)

bot.start(ctx=>{
    ctx.reply('let us start!')
})


bot.launch()


process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));