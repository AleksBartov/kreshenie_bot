import { CONFIG } from '../config/index.js';
import { getGradeEmoji } from './helpers.js';

export const formatDate = (dateString) => {
  const date = new Date(dateString.split('.').reverse().join('-'));
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Сегодня';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Вчера';
  } else {
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  }
};

export const formatGrade = (grade) => {
  const emoji = getGradeEmoji(grade.estimate_value_name);
  const date = formatDate(grade.date);
  return `${grade.subject_name} - ${grade.estimate_value_name} ${emoji} (${date})`;
};

export const formatGradesMessage = (childName, grades) => {
  if (grades.length === 0) {
    return `📝 У ${childName} ${CONFIG.children[childName].emoji} нет новых оценок`;
  }
  
  const header = `🎓 Новые оценки для ${childName} ${CONFIG.children[childName].emoji}:\n\n`;
  const gradesList = grades.map(grade => `• ${formatGrade(grade)}`).join('\n');
  
  return header + gradesList;
};

export const formatManualGrades = (childName, grades) => {
  if (grades.length === 0) {
    return `📝 У ${childName} ${CONFIG.children[childName].emoji} нет оценок за последние 2 дня`;
  }
  
  const gradesByDate = {};
  grades.forEach(grade => {
    if (!gradesByDate[grade.date]) {
      gradesByDate[grade.date] = [];
    }
    gradesByDate[grade.date].push(grade);
  });
  
  let message = `📊 Последние оценки ${childName} ${CONFIG.children[childName].emoji}:\n\n`;
  
  const sortedDates = Object.keys(gradesByDate).sort((a, b) => 
    new Date(b.split('.').reverse().join('-')) - new Date(a.split('.').reverse().join('-'))
  );
  
  sortedDates.forEach(date => {
    const formattedDate = formatDate(date);
    message += `📅 ${formattedDate}:\n`;
    gradesByDate[date].forEach(grade => {
      const emoji = getGradeEmoji(grade.estimate_value_name);
      message += `• ${grade.subject_name} - ${grade.estimate_value_name} ${emoji}\n`;
    });
    message += '\n';
  });
  
  return message.trim();
};