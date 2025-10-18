const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class YandexDisk {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseURL = 'https://cloud-api.yandex.net/v1/disk/resources';
    this.headers = {
      'Authorization': `OAuth ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Создание папки
  async createFolder(folderPath) {
    try {
      const response = await axios.put(`${this.baseURL}?path=${encodeURIComponent(folderPath)}`, {}, {
        headers: this.headers
      });
      return { success: true, data: response.data };
    } catch (error) {
      if (error.response?.status === 409) {
        return { success: true, data: { message: 'Folder already exists' } };
      }
      console.error('❌ Ошибка создания папки на Яндекс.Диске:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Загрузка файла на Яндекс.Диск
  async uploadFile(localFilePath, remoteFilePath) {
    try {
      // Получаем URL для загрузки
      const uploadResponse = await axios.get(`${this.baseURL}/upload?path=${encodeURIComponent(remoteFilePath)}&overwrite=true`, {
        headers: this.headers
      });

      const uploadUrl = uploadResponse.data.href;

      // Читаем файл и загружаем
      const fileBuffer = await fs.readFile(localFilePath);
      
      await axios.put(uploadUrl, fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });

      console.log('✅ Файл загружен на Яндекс.Диск:', remoteFilePath);
      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка загрузки на Яндекс.Диск:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Проверка существования папки
  async folderExists(folderPath) {
    try {
      await axios.get(`${this.baseURL}?path=${encodeURIComponent(folderPath)}`, {
        headers: this.headers
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Получение публичной ссылки на папку
  async publishFolder(folderPath) {
    try {
      // Публикуем папку
      await axios.put(`${this.baseURL}/publish?path=${encodeURIComponent(folderPath)}`, {}, {
        headers: this.headers
      });

      // Получаем публичную ссылку
      const response = await axios.get(`${this.baseURL}?path=${encodeURIComponent(folderPath)}`, {
        headers: this.headers
      });

      return { 
        success: true, 
        publicUrl: response.data.public_url || `https://disk.yandex.ru/client/disk${folderPath}`
      };
    } catch (error) {
      console.error('❌ Ошибка публикации папки:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Проверка валидности токена
  async checkToken() {
    try {
      await this.folderExists('/');
      return { success: true, message: 'Токен валиден' };
    } catch (error) {
      return { success: false, error: 'Токен невалиден' };
    }
  }
}

module.exports = YandexDisk;
