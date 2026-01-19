// AsyncStorage 工具类 - 提供类似 localStorage 的异步存储接口
import AsyncStorage from '@react-native-async-storage/async-storage';

class Storage {
  /**
   * 保存数据
   */
  async setItem(key: string, value: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error(`❌ Storage.setItem error (${key}):`, error);
    }
  }

  /**
   * 读取数据
   */
  async getItem<T>(key: string, defaultValue?: T): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : (defaultValue ?? null);
    } catch (error) {
      console.error(`❌ Storage.getItem error (${key}):`, error);
      return defaultValue ?? null;
    }
  }

  /**
   * 删除数据
   */
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`❌ Storage.removeItem error (${key}):`, error);
    }
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('❌ Storage.clear error:', error);
    }
  }

  /**
   * 获取所有键
   */
  async getAllKeys(): Promise<string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('❌ Storage.getAllKeys error:', error);
      return [];
    }
  }
}

export default new Storage();

