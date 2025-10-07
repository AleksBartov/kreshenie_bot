import { config } from 'dotenv'

import { Telegraf} from 'telegraf'

config();

const bot = new Telegraf(process.env.BOT_TOKEN)

bot.start(ctx=>{
    ctx.reply('let us start with env!')
})


bot.launch()


process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));