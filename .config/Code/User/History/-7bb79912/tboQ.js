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

  // Создание папки (ИСПРАВЛЕННАЯ ВЕРСИЯ)
  async createFolder(folderPath) {
    try {
      console.log(`📁 Создание папки: ${folderPath}`);
      
      const response = await axios.put(
        `${this.baseURL}?path=${encodeURIComponent(folderPath)}`,
        undefined,
        { headers: this.headers }
      );
      
      console.log('✅ Папка создана на Яндекс.Диске');
      return { success: true, data: response.data };
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('✅ Папка уже существует на Яндекс.Диске');
        return { success: true, data: { message: 'Folder already exists' } };
      }
      console.error('❌ Ошибка создания папки:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Загрузка файла на Яндекс.Диск (ИСПРАВЛЕННАЯ ВЕРСИЯ)
  async uploadFile(localFilePath, remoteFilePath) {
    try {
      console.log(`📤 Загрузка файла: ${localFilePath} -> ${remoteFilePath}`);
      
      // 1. Сначала убедимся что папка существует
      const folderPath = path.dirname(remoteFilePath);
      await this.createFolder(folderPath);

      // 2. Получаем URL для загрузки
      const uploadResponse = await axios.get(
        `${this.baseURL}/upload?path=${encodeURIComponent(remoteFilePath)}&overwrite=true`,
        { headers: this.headers }
      );

      const uploadUrl = uploadResponse.data.href;

      // 3. Читаем файл и загружаем
      const fileBuffer = await fs.readFile(localFilePath);
      
      await axios.put(uploadUrl, fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileBuffer.length
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      console.log('✅ Файл успешно загружен на Яндекс.Диск');
      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка загрузки файла:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data || error.message 
      };
    }
  }

  // Проверка существования папки
  async folderExists(folderPath) {
    try {
      await axios.get(
        `${this.baseURL}?path=${encodeURIComponent(folderPath)}`, 
        { headers: this.headers }
      );
      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  // Получение публичной ссылки на папку (ИСПРАВЛЕННАЯ ВЕРСИЯ)
  async publishFolder(folderPath) {
    try {
      console.log(`🔗 Публикация папки: ${folderPath}`);
      
      // 1. Публикуем папку
      await axios.put(
        `${this.baseURL}/publish?path=${encodeURIComponent(folderPath)}`, 
        null, // Явно указываем null
        { headers: this.headers }
      );

      // 2. Ждем немного перед получением ссылки
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 3. Получаем информацию о папке
      const response = await axios.get(
        `${this.baseURL}?path=${encodeURIComponent(folderPath)}`, 
        { headers: this.headers }
      );

      const publicUrl = response.data.public_url || 
                       `https://disk.yandex.ru/client/disk${folderPath}`;

      console.log('✅ Папка опубликована:', publicUrl);
      return { success: true, publicUrl };
    } catch (error) {
      console.error('❌ Ошибка публикации папки:', error.response?.data || error.message);
      
      // Возвращаем хотя бы путь даже без публичной ссылки
      return { 
        success: false, 
        publicUrl: `https://disk.yandex.ru/client/disk${folderPath}`,
        error: error.response?.data || error.message 
      };
    }
  }

  // Проверка валидности токена
  async checkToken() {
    try {
      await axios.get(
        `${this.baseURL}?path=/`, 
        { headers: this.headers }
      );
      return { success: true, message: 'Токен валиден' };
    } catch (error) {
      return { 
        success: false, 
        error: 'Токен невалиден: ' + (error.response?.data?.message || error.message) 
      };
    }
  }

  // Создание всей иерархии папок
  async ensureFolderStructure(basePath) {
    try {
      await this.createFolder('/interview_bot');
      console.log('✅ Базовая структура папок создана');
      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка создания структуры папок:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = YandexDisk;