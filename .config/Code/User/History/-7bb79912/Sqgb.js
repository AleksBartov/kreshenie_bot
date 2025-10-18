const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class YandexDisk {
  constructor(accessToken) {
    console.log('🔐 Инициализация Яндекс.Диска...');
    console.log('🔐 Токен получен:', accessToken ? `(длина: ${accessToken.length})` : 'ОТСУТСТВУЕТ');
    
    this.accessToken = accessToken;
    this.baseURL = 'https://cloud-api.yandex.net/v1/disk/resources';
    this.headers = {
      'Authorization': `OAuth ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
    
    console.log('🔐 Заголовки установлены:', this.headers);
    
    // Привязываем методы к контексту
    this.createFolder = this.createFolder.bind(this);
    this.checkToken = this.checkToken.bind(this);
    this.uploadFile = this.uploadFile.bind(this);
    this.folderExists = this.folderExists.bind(this);
    this.publishFolder = this.publishFolder.bind(this);
  }

  // Проверка валидности токена
  async checkToken() {
    try {
      console.log('🔐 Проверка токена...');
      console.log('🔐 URL:', `${this.baseURL}?path=/`);
      console.log('🔐 Заголовки:', this.headers);
      
      const response = await axios.get(`${this.baseURL}?path=/`, {
        headers: this.headers
      });
      
      console.log('✅ Проверка токена успешна');
      return { success: true, message: 'Токен валиден' };
    } catch (error) {
      console.log('❌ Ошибка проверки токена:');
      console.log('❌ Статус:', error.response?.status);
      console.log('❌ Данные:', error.response?.data);
      console.log('❌ Сообщение:', error.message);
      
      return { 
        success: false, 
        error: 'Токен невалиден: ' + (error.response?.data?.message || error.message) 
      };
    }
  }

  // Создание папки
  async createFolder(folderPath) {
    try {
      console.log(`📁 Создание папки: ${folderPath}`);
      console.log('🔐 Заголовки для создания:', this.headers);
      
      const url = `${this.baseURL}?path=${encodeURIComponent(folderPath)}`;
      console.log('🔐 Полный URL:', url);
      
      const response = await axios({
        method: 'PUT',
        url: url,
        headers: this.headers
      });
      
      console.log('✅ Папка создана на Яндекс.Диске');
      return { success: true, data: response.data };
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('✅ Папка уже существует на Яндекс.Диске');
        return { success: true, data: { message: 'Folder already exists' } };
      }
      
      console.error('❌ Ошибка создания папки:');
      console.error('❌ Статус:', error.response?.status);
      console.error('❌ Данные:', error.response?.data);
      console.error('❌ Сообщение:', error.message);
      
      return { 
        success: false, 
        error: error.response?.data || error.message 
      };
    }
  }

  // Загрузка файла на Яндекс.Диск
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
      console.error('❌ Ошибка загрузки файла:');
      console.error('❌ Статус:', error.response?.status);
      console.error('❌ Данные:', error.response?.data);
      console.error('❌ Сообщение:', error.message);
      
      return { 
        success: false, 
        error: error.response?.data || error.message 
      };
    }
  }

  // Проверка существования папки
  async folderExists(folderPath) {
    try {
      const response = await axios.get(
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

  // Получение публичной ссылки на папку
  async publishFolder(folderPath) {
    try {
      console.log(`🔗 Публикация папки: ${folderPath}`);
      
      // 1. Публикуем папку
      await axios.put(
        `${this.baseURL}/publish?path=${encodeURIComponent(folderPath)}`, 
        null,
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
      console.error('❌ Ошибка публикации папки:');
      console.error('❌ Статус:', error.response?.status);
      console.error('❌ Данные:', error.response?.data);
      console.error('❌ Сообщение:', error.message);
      
      // Возвращаем хотя бы путь даже без публичной ссылки
      return { 
        success: false, 
        publicUrl: `https://disk.yandex.ru/client/disk${folderPath}`,
        error: error.response?.data || error.message 
      };
    }
  }

  // Создание всей иерархии папок
  async ensureFolderStructure(basePath) {
    try {
      console.log('📁 Создание базовой структуры папок...');
      const result = await this.createFolder(basePath);
      
      if (result.success) {
        console.log('✅ Базовая структура папок создана');
      } else {
        console.log('⚠️  Базовая структура не создана:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Ошибка создания структуры папок:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = YandexDisk;