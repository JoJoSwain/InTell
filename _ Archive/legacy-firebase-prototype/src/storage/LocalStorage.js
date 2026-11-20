import AsyncStorage from '@react-native-async-storage/async-storage';

class LocalStorage {
  // User data keys
  USER_KEY = '@replaceplace:user';
  PROGRESS_KEY = '@replaceplace:progress';
  SETTINGS_KEY = '@replaceplace:settings';

  // Save user data
  async saveUser(userData) {
    try {
      const jsonValue = JSON.stringify(userData);
      await AsyncStorage.setItem(this.USER_KEY, jsonValue);
      return true;
    } catch (error) {
      console.error('Error saving user:', error);
      return false;
    }
  }

  // Get user data
  async getUser() {
    try {
      const jsonValue = await AsyncStorage.getItem(this.USER_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  // Remove user data (logout)
  async removeUser() {
    try {
      await AsyncStorage.removeItem(this.USER_KEY);
      return true;
    } catch (error) {
      console.error('Error removing user:', error);
      return false;
    }
  }

  // Save progress
  async saveProgress(progress) {
    try {
      const jsonValue = JSON.stringify(progress);
      await AsyncStorage.setItem(this.PROGRESS_KEY, jsonValue);
      return true;
    } catch (error) {
      console.error('Error saving progress:', error);
      return false;
    }
  }

  // Get progress
  async getProgress() {
    try {
      const jsonValue = await AsyncStorage.getItem(this.PROGRESS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error getting progress:', error);
      return null;
    }
  }

  // Save settings
  async saveSettings(settings) {
    try {
      const jsonValue = JSON.stringify(settings);
      await AsyncStorage.setItem(this.SETTINGS_KEY, jsonValue);
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }

  // Get settings
  async getSettings() {
    try {
      const jsonValue = await AsyncStorage.getItem(this.SETTINGS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error getting settings:', error);
      return null;
    }
  }

  // Clear all storage
  async clearStorage() {
    try {
      await AsyncStorage.multiRemove([
        this.USER_KEY,
        this.PROGRESS_KEY,
        this.SETTINGS_KEY,
      ]);
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      return false;
    }
  }
}

export default new LocalStorage();
