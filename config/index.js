import { config } from 'dotenv';
config();

export const CONFIG = {
  token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI5ZDg1MWJiZC05YzljLTQ4NTctYjI0OC0xNDBkNTYzMmFmODQiLCJleHAiOjE3NjA0Nzc1MjMsImlhdCI6MTc2MDQ3NzA0MywiZXNrIjoiZGIzYzJjZjUtMmUwZi00M2E2LThhMzMtY2RhNTgzOTFkOGI3IiwiZXNhaWQiOiI3NDk3NTYxODg1IiwiZWlkIjoiMTA4NzM3OTg4MyJ9.-gQqjpUWVQ8pRR5JgiXNoXMoXPugchU2ianIKqa4Zv4",
  ssoKey: "db3c2cf5-2e0f-43a6-8a33-cda58391d8b7",
  checkInterval: 300000, // 5 минут
  adminId: parseInt(process.env.ADMIN_ID),
  children: {
    "Varvara": { id: 614996, emoji: "👧" },
    "Ivan": { id: 647827, emoji: "👦" },
    "Boris": { id: 741052, emoji: "👶" }
  }
};

// Глобальное состояние мониторинга
export let globalMonitoringActive = false;
export let lastCheckedGrades = new Map();
export let authError = false;

export function setMonitoringState(active, error = false) {
  globalMonitoringActive = active;
  authError = error;
}