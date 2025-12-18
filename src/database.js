import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs-extra';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseManager {
  constructor() {
    // Ensure database directory exists and is writable
    const dbPath = config.database.path;
    const dbDir = dirname(dbPath);
    
    try {
      // Create directory if it doesn't exist
      fs.ensureDirSync(dbDir);
      
      // Set directory permissions (rwxr-xr-x)
      try {
        fs.chmodSync(dbDir, 0o755);
      } catch (err) {
        console.warn(`Warning: Could not set directory permissions: ${err.message}`);
      }
      
      // Check if database file exists and is writable
      if (fs.existsSync(dbPath)) {
        try {
          fs.accessSync(dbPath, fs.constants.W_OK);
        } catch (err) {
          console.error(`Database file is not writable: ${dbPath}`);
          console.error(`Error: ${err.message}`);
          // Try to fix permissions
          try {
            fs.chmodSync(dbPath, 0o664);
            console.log(`Fixed database file permissions`);
          } catch (chmodErr) {
            console.error(`Could not fix permissions: ${chmodErr.message}`);
            throw new Error(`Database file is not writable: ${err.message}`);
          }
        }
      } else {
        // File doesn't exist, will be created by SQLite
        console.log(`Database file will be created at: ${dbPath}`);
      }
    } catch (err) {
      console.error(`Error setting up database directory: ${err.message}`);
      throw err;
    }
    
    // Open database with WAL mode for better concurrency
    try {
      this.db = new Database(dbPath, {
        verbose: process.env.NODE_ENV === 'development' ? console.log : null
      });
      
      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      
      // Set file permissions after creation
      try {
        fs.chmodSync(dbPath, 0o664);
      } catch (err) {
        console.warn(`Warning: Could not set database file permissions: ${err.message}`);
      }
    } catch (err) {
      console.error(`Error opening database: ${err.message}`);
      throw err;
    }
    
    this.initDatabase();
  }

  initDatabase() {
    // Create users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create chat_history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `);

    // Create user_profiles table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INTEGER PRIMARY KEY,
        preferences TEXT,
        context TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_history_timestamp ON chat_history(timestamp);
    `);
  }

  // User management
  createOrUpdateUser(userId, userData) {
    const stmt = this.db.prepare(`
      INSERT INTO users (user_id, username, first_name, last_name, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      userId,
      userData.username || null,
      userData.first_name || null,
      userData.last_name || null
    );
  }

  getUser(userId) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE user_id = ?');
    return stmt.get(userId);
  }

  // Chat history management
  addMessage(userId, role, content) {
    const stmt = this.db.prepare(`
      INSERT INTO chat_history (user_id, role, content)
      VALUES (?, ?, ?)
    `);
    stmt.run(userId, role, content);
  }

  getChatHistory(userId, limit = 20) {
    const stmt = this.db.prepare(`
      SELECT role, content, timestamp
      FROM chat_history
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const messages = stmt.all(userId, limit);
    return messages.reverse(); // Return in chronological order
  }

  clearChatHistory(userId) {
    const stmt = this.db.prepare('DELETE FROM chat_history WHERE user_id = ?');
    stmt.run(userId);
  }

  // User profile management
  createOrUpdateProfile(userId, preferences = {}, context = '', metadata = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO user_profiles (user_id, preferences, context, metadata, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        preferences = excluded.preferences,
        context = excluded.context,
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      userId,
      JSON.stringify(preferences),
      context,
      JSON.stringify(metadata)
    );
  }

  getProfile(userId) {
    const stmt = this.db.prepare('SELECT * FROM user_profiles WHERE user_id = ?');
    const profile = stmt.get(userId);
    if (profile) {
      return {
        ...profile,
        preferences: JSON.parse(profile.preferences || '{}'),
        metadata: JSON.parse(profile.metadata || '{}'),
      };
    }
    return null;
  }

  updateProfileContext(userId, context) {
    const stmt = this.db.prepare(`
      UPDATE user_profiles
      SET context = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `);
    stmt.run(context, userId);
  }

  // Add perfume to user's collection
  addUserPerfume(userId, perfumeName) {
    const profile = this.getProfile(userId);
    const preferences = profile?.preferences || {};
    const perfumes = preferences.perfumes || [];
    
    // Add perfume if not already exists
    if (!perfumes.includes(perfumeName)) {
      perfumes.push(perfumeName);
      preferences.perfumes = perfumes;
      
      const stmt = this.db.prepare(`
        INSERT INTO user_profiles (user_id, preferences, context, metadata, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          preferences = excluded.preferences,
          updated_at = CURRENT_TIMESTAMP
      `);
      
      const existingProfile = this.getProfile(userId);
      stmt.run(
        userId,
        JSON.stringify(preferences),
        existingProfile?.context || '',
        JSON.stringify(existingProfile?.metadata || {})
      );
      
      return true;
    }
    return false;
  }

  // Remove perfume from user's collection
  removeUserPerfume(userId, perfumeName) {
    const profile = this.getProfile(userId);
    const preferences = profile?.preferences || {};
    const perfumes = preferences.perfumes || [];
    
    const index = perfumes.indexOf(perfumeName);
    if (index > -1) {
      perfumes.splice(index, 1);
      preferences.perfumes = perfumes;
      
      const stmt = this.db.prepare(`
        UPDATE user_profiles
        SET preferences = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `);
      
      stmt.run(JSON.stringify(preferences), userId);
      return true;
    }
    return false;
  }

  // Get user's perfumes
  getUserPerfumes(userId) {
    const profile = this.getProfile(userId);
    return profile?.preferences?.perfumes || [];
  }

  close() {
    this.db.close();
  }
}

export default new DatabaseManager();

