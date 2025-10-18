
import { CONFIG } from '../config/index.js';

export const isAdmin = (userId) => {
  return userId === CONFIG.adminId;
};

export const getGradeEmoji = (grade) => {
  const gradeValue = parseInt(grade);
  if (isNaN(gradeValue)) {
    if (grade.includes('5')) return '🎉';
    if (grade.includes('4')) return '👍';
    if (grade.includes('3')) return '😐';
    if (grade.includes('2')) return '😞';
    if (grade.toLowerCase().includes('зач') || grade.toLowerCase().includes('уч')) return '✅';
    return '❓';
  }
  
  if (gradeValue >= 4) return '🎉';
  if (gradeValue === 3) return '😐';
  if (gradeValue === 2) return '😞';
  return '💀';
};

export const getKeyboardForUser = (userId, monitoringActive) => {
  const baseButtons = [
    ['👧 Проверить Варю', '👦 Проверить Ваню', '👶 Проверить Борю']
  ];
  
  if (isAdmin(userId)) {
    if (monitoringActive) {
      baseButtons.unshift(['🛑 Остановить мониторинг']);
    } else {
      baseButtons.unshift(['🎯 Запустить мониторинг']);
    }
  }
  
  return baseButtons;
};

export const findNewGrades = (oldGrades, newGrades) => {
  if (!oldGrades || oldGrades.length === 0) return [];
  
  const oldIds = new Set(oldGrades.map(g => g.uniqueId));
  return newGrades.filter(grade => !oldIds.has(grade.uniqueId));
};