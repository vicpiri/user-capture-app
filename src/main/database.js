const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
  constructor(dbPath) {
    this.db = null;
    this.dbPath = dbPath;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
          reject(err);
        } else {
          this.db.run('PRAGMA journal_mode = WAL');
          try {
            await this.createTables();
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Groups table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL
          )
        `);

        // Users table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name1 TEXT NOT NULL,
            last_name2 TEXT,
            birth_date TEXT,
            document TEXT,
            nia TEXT,
            group_code TEXT,
            image_path TEXT,
            has_external_image INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_code) REFERENCES groups(code)
          )
        `);

        // Create indexes
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_code)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_type ON users(type)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_nia ON users(nia)', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async importUsers(users) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        // Insert groups
        const insertGroup = this.db.prepare('INSERT OR IGNORE INTO groups (code, name) VALUES (?, ?)');
        users.groups.forEach(group => {
          insertGroup.run(group.code, group.name);
        });
        insertGroup.finalize();

        // Insert special groups
        this.db.run('INSERT OR IGNORE INTO groups (code, name) VALUES (?, ?)', ['DOCENTES', 'Docentes']);
        this.db.run('INSERT OR IGNORE INTO groups (code, name) VALUES (?, ?)', ['NO_DOCENTES', 'No Docentes']);

        // Insert students
        const insertUser = this.db.prepare(
          'INSERT INTO users (type, first_name, last_name1, last_name2, birth_date, document, nia, group_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );

        users.students.forEach(student => {
          insertUser.run(
            'student',
            student.first_name,
            student.last_name1,
            student.last_name2,
            student.birth_date,
            student.document,
            student.nia,
            student.group_code
          );
        });

        // Insert teachers
        users.teachers.forEach(teacher => {
          insertUser.run(
            'teacher',
            teacher.first_name,
            teacher.last_name1,
            teacher.last_name2,
            teacher.birth_date,
            teacher.document,
            null,
            'DOCENTES'
          );
        });

        // Insert non-teaching staff
        users.nonTeachingStaff.forEach(staff => {
          insertUser.run(
            'non_teaching_staff',
            staff.first_name,
            staff.last_name1,
            staff.last_name2,
            staff.birth_date,
            staff.document,
            null,
            'NO_DOCENTES'
          );
        });

        insertUser.finalize();

        this.db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async getUsers(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM users WHERE 1=1';
      const params = [];

      if (filters.groupCode) {
        query += ' AND group_code = ?';
        params.push(filters.groupCode);
      }

      if (filters.search) {
        query += ' AND (first_name LIKE ? OR last_name1 LIKE ? OR last_name2 LIKE ? OR nia LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      if (filters.type) {
        query += ' AND type = ?';
        params.push(filters.type);
      }

      query += ' ORDER BY last_name1, last_name2, first_name';

      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getUserById(userId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getGroups() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM groups ORDER BY code', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getUsersByImagePath(imagePath) {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM users WHERE image_path = ?', [imagePath], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async linkImageToUser(userId, imagePath) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE users SET image_path = ? WHERE id = ?', [imagePath, userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async markExternalImage(userId, exists) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE users SET has_external_image = ? WHERE id = ?', [exists ? 1 : 0, userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DatabaseManager;
