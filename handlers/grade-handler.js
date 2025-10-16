import { getRecentGrades } from '../services/dnevnik-api.js';
import { formatManualGrades } from '../utils/formatters.js';
import { CONFIG } from '../config/index.js';

export const gradeHandler = (bot) => {
  bot.hears(/Проверить (Варю|Ваню|Борю)/, async (ctx) => {
    const childNameMatch = ctx.match[1];
    
    // Преобразуем имена из винительного падежа в именительный
    const nameMapping = {
      'Варю': 'Варя',
      'Ваню': 'Ваня', 
      'Борю': 'Боря'
    };
    
    const childName = nameMapping[childNameMatch];
    
    if (!childName || !CONFIG.children[childName]) {
      await ctx.reply(`❌ Неизвестный ребенок: ${childNameMatch}`);
      return;
    }
    
    try {
      await ctx.reply(`🔍 Проверяю оценки для ${childName}...`);
      const childData = CONFIG.children[childName];
      const grades = await getRecentGrades(childData.id);
      const message = formatManualGrades(childName, grades);
      await ctx.reply(message);
    } catch (error) {
      await ctx.reply(`❌ Ошибка при проверке ${childName}: ${error.message}`);
    }
  });
};
