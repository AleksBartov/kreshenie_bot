
import { config } from 'dotenv';
import { readFileSync, writeFileSync, existsSync } from 'fs';

config();

export const CONFIG = {
  token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI5ZDg1MWJiZC05YzljLTQ4NTctYjI0OC0xNDBkNTYzMmFmODQiLCJleHAiOjE3NjA0Nzc1MjMsImlhdCI6MTc2MDQ3NzA0MywiZXNrIjoiZGIzYzJjZjUtMmUwZi00M2E2LThhMzMtY2RhNTgzOTFkOGI3IiwiZXNhaWQiOiI3NDk3NTYxODg1IiwiZWlkIjoiMTA4NzM3OTg4MyJ9.-gQqjpUWVQ8pRR5JgiXNoXMoXPugchU2ianIKqa4Zv4",
  ssoKey: "db3c2cf5-2e0f-43a6-8a33-cda58391d8b7",
  checkInterval: 300000,
  adminId: parseInt(process.env.ADMIN_ID),
  children: {
    "Варя": { id: 614996, emoji: "👧" },
    "Ваня": { id: 647827, emoji: "👦" },
    "Боря": { id: 741052, emoji: "👶" }
  }
};

// Глобальное состояние мониторинга
export let globalMonitoringActive = false;
export let lastCheckedGrades = new Map();
export let authError = false;

// Хранилище всех активных пользователей бота
export let allUsers = new Set();

// Загрузка пользователей из файла при старте
const USERS_FILE = './data/users.json';

function loadUsers() {
  try {
    const data = readFileSync(USERS_FILE, 'utf8');
    const usersArray = JSON.parse(data);
    allUsers = new Set(usersArray);
    console.log(`📁 Загружено ${allUsers.size} пользователей из файла`);
  } catch (error) {
    console.log('📁 Файл с пользователями пустой или поврежден, начнем с чистого списка');
    allUsers = new Set();
  }
}

function saveUsers() {
  const usersArray = Array.from(allUsers);
  writeFileSync(USERS_FILE, JSON.stringify(usersArray, null, 2));
  console.log(`💾 Сохранено ${usersArray.length} пользователей в файл`);
}

// Загружаем пользователей при импорте
loadUsers();

export function setMonitoringState(active, error = false) {
  globalMonitoringActive = active;
  authError = error;
}

export function addUser(userId) {
  allUsers.add(userId);
  saveUsers();
  console.log(`👤 Добавлен пользователь ${userId}. Всего пользователей: ${allUsers.size}`);
}

export function removeUser(userId) {
  allUsers.delete(userId);
  saveUsers();
  console.log(`👤 Удален пользователь ${userId}. Всего пользователей: ${allUsers.size}`);
}

export function getUserCount() {
  return allUsers.size;
}