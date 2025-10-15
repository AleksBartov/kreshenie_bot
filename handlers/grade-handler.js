import { getRecentGrades } from '../services/dnevnik-api.js';
import { formatManualGrades } from '../utils/formatters.js';

export const gradeHandler = (bot) => {
  // Ручная проверка конкретного ребенка
  bot.hears(/Проверить (Варю|Ваню|Борю)/, async (ctx) => {
    const childMap = {
      'Варю': 'Varvara',
      'Ваню': 'Ivan', 
      'Борю': 'Boris'
    };
    
    const childKey = childMap[ctx.match[1]];
    
    try {
      await ctx.reply(`🔍 Проверяю оценки для ${childKey}...`);
      const grades = await getRecentGrades(ctx.children[childKey].id);
      const message = formatManualGrades(childKey, grades);
      await ctx.reply(message);
    } catch (error) {
      await ctx.reply(`❌ Ошибка при проверке ${childKey}: ${error.message}`);
    }
  });
};