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

        // Image tags table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS image_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_path TEXT NOT NULL,
            tag TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Project settings table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS project_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create indexes for performance optimization
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_code)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_type ON users(type)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_nia ON users(nia)');

        // Composite index for search operations (optimizes LIKE queries on multiple fields)
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_search ON users(first_name, last_name1, last_name2, nia)');

        // Index for image path lookups (optimizes linking and unlinking operations)
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_image ON users(image_path)');

        this.db.run('CREATE INDEX IF NOT EXISTS idx_image_tags_path ON image_tags(image_path)', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async importUsers(users) {
    return new Promise((resolve, reject) => {
      // Track issues during import
      const report = {
        imported: 0,
        withoutIdentifier: [],
        withoutGroup: [],
        duplicates: []
      };

      // Pre-process all users and resolve duplicates
      // Map: identifier -> { user: userData, fullName: string }
      const usersToImport = new Map();

      // Helper function to collect all occurrences of each identifier
      const userOccurrences = new Map(); // identifier -> array of occurrences

      const collectUser = (user, type, defaultGroup) => {
        const fullName = `${user.first_name} ${user.last_name1} ${user.last_name2 || ''}`.trim();

        // Determine identifier based on type
        let identifier, identifierLabel;
        if (type === 'student') {
          if (!user.nia) {
            report.withoutIdentifier.push({
              type: 'Estudiante',
              name: fullName,
              group: user.group_code || 'Sin grupo',
              document: user.document || 'Sin documento',
              reason: 'Sin NIA'
            });
            return; // Skip this user
          }
          identifier = `student_${user.nia}`;
          identifierLabel = `NIA: ${user.nia}`;
        } else {
          if (!user.document) {
            report.withoutIdentifier.push({
              type: type === 'teacher' ? 'Docente' : 'No Docente',
              name: fullName,
              group: defaultGroup,
              document: 'Sin documento',
              reason: 'Sin documento'
            });
            return; // Skip this user
          }
          identifier = `${type}_${user.document}`;
          identifierLabel = `Documento: ${user.document}`;
        }

        // Assign default group for teachers/staff, keep as-is for students
        const groupCode = type === 'student' ? user.group_code : (user.group_code || defaultGroup);

        // Collect this occurrence
        if (!userOccurrences.has(identifier)) {
          userOccurrences.set(identifier, []);
        }
        userOccurrences.get(identifier).push({
          user: { ...user, group_code: groupCode },
          fullName: fullName,
          type: type,
          identifierLabel: identifierLabel
        });
      };

      // Collect all students
      users.students.forEach(student => {
        collectUser(student, 'student', student.group_code);
      });

      // Collect all teachers
      users.teachers.forEach(teacher => {
        collectUser(teacher, 'teacher', 'DOCENTES');
      });

      // Collect all non-teaching staff
      users.nonTeachingStaff.forEach(staff => {
        collectUser(staff, 'non_teaching_staff', 'NO_DOCENTES');
      });

      // Now process all collected occurrences and decide which to import
      for (const [identifier, occurrences] of userOccurrences) {
        if (occurrences.length === 1) {
          // Single occurrence - check if it has a group
          const occurrence = occurrences[0];
          const hasGroup = occurrence.user.group_code && occurrence.user.group_code !== '';

          // If no group, assign to SIN_GRUPO
          if (!hasGroup) {
            occurrence.user.group_code = 'SIN_GRUPO';
          }

          usersToImport.set(identifier, occurrence);

          if (!hasGroup && occurrence.type === 'student') {
            // Student without group and no duplicates
            report.withoutGroup.push({
              type: 'Estudiante',
              name: occurrence.fullName,
              identifier: occurrence.identifierLabel,
              document: occurrence.user.document || 'Sin documento',
              note: 'No existen grupos asignados'
            });
          }
        } else {
          // Multiple occurrences - duplicates detected
          const userType = occurrences[0].type === 'student' ? 'Estudiante' :
                          (occurrences[0].type === 'teacher' ? 'Docente' : 'No Docente');

          // Analyze groups in all occurrences
          const withGroup = occurrences.filter(occ => occ.user.group_code && occ.user.group_code !== '');
          const withoutGroup = occurrences.filter(occ => !occ.user.group_code || occ.user.group_code === '');

          let selectedOccurrence;
          let duplicateNote;

          if (withGroup.length === 0) {
            // No occurrence has a group - assign to SIN_GRUPO
            selectedOccurrence = occurrences[0];
            selectedOccurrence.user.group_code = 'SIN_GRUPO';
            duplicateNote = 'No existen grupos asignados';

            // Add to withoutGroup report
            report.withoutGroup.push({
              type: userType,
              name: selectedOccurrence.fullName,
              identifier: selectedOccurrence.identifierLabel,
              document: selectedOccurrence.user.document || 'Sin documento',
              note: 'No existen grupos asignados'
            });
          } else if (withGroup.length === 1) {
            // One occurrence has group, others don't
            selectedOccurrence = withGroup[0];
            duplicateNote = `Importado en el grupo ${selectedOccurrence.user.group_code}`;
          } else {
            // Multiple occurrences with different groups
            selectedOccurrence = withGroup[0];
            const groups = withGroup.map(occ => occ.user.group_code).filter((v, i, a) => a.indexOf(v) === i);
            if (groups.length > 1) {
              duplicateNote = `Usuario asignado a más de un grupo. Importado en el grupo ${selectedOccurrence.user.group_code}`;
            } else {
              duplicateNote = `Importado en el grupo ${selectedOccurrence.user.group_code}`;
            }
          }

          // Import the selected occurrence
          usersToImport.set(identifier, selectedOccurrence);

          // Collect all unique group codes found in occurrences
          const allGroups = occurrences
            .map(occ => occ.user.group_code || 'Sin grupo')
            .filter((v, i, a) => a.indexOf(v) === i) // unique values
            .join(', ');

          // Report all duplicates in one consolidated entry
          report.duplicates.push({
            type: userType,
            identifier: selectedOccurrence.identifierLabel,
            allNames: occurrences.map(o => o.fullName).join(', '),
            allGroups: allGroups,
            group: selectedOccurrence.user.group_code || 'Sin grupo',
            note: duplicateNote,
            occurrencesCount: occurrences.length,
            processed: true
          });
        }
      }

      // Now import the selected users
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
        this.db.run('INSERT OR IGNORE INTO groups (code, name) VALUES (?, ?)', ['SIN_GRUPO', '⚠ Sin grupo']);

        // Insert users
        const insertUser = this.db.prepare(
          'INSERT INTO users (type, first_name, last_name1, last_name2, birth_date, document, nia, group_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );

        for (const [identifier, userData] of usersToImport) {
          const user = userData.user;
          const type = userData.type;

          insertUser.run(
            type,
            user.first_name,
            user.last_name1,
            user.last_name2,
            user.birth_date,
            user.document,
            type === 'student' ? user.nia : null,
            user.group_code
          );
          report.imported++;
        }

        insertUser.finalize();

        this.db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve(report);
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

  async unlinkImageFromUser(userId) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE users SET image_path = NULL WHERE id = ?', [userId], (err) => {
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

  async updateUser(userId, updates) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];

      // Build update query dynamically based on provided fields
      if (updates.first_name !== undefined) {
        fields.push('first_name = ?');
        values.push(updates.first_name);
      }
      if (updates.last_name1 !== undefined) {
        fields.push('last_name1 = ?');
        values.push(updates.last_name1);
      }
      if (updates.last_name2 !== undefined) {
        fields.push('last_name2 = ?');
        values.push(updates.last_name2);
      }
      if (updates.birth_date !== undefined) {
        fields.push('birth_date = ?');
        values.push(updates.birth_date);
      }
      if (updates.document !== undefined) {
        fields.push('document = ?');
        values.push(updates.document);
      }
      if (updates.group_code !== undefined) {
        fields.push('group_code = ?');
        values.push(updates.group_code);
      }
      if (updates.nia !== undefined) {
        fields.push('nia = ?');
        values.push(updates.nia);
      }

      if (fields.length === 0) {
        resolve(); // Nothing to update
        return;
      }

      values.push(userId); // Add userId for WHERE clause
      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;

      this.db.run(query, values, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async deleteUser(userId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async addImageTag(imagePath, tag) {
    return new Promise((resolve, reject) => {
      this.db.run('INSERT INTO image_tags (image_path, tag) VALUES (?, ?)', [imagePath, tag], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getImageTags(imagePath) {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM image_tags WHERE image_path = ? ORDER BY created_at DESC', [imagePath], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async deleteImageTag(tagId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM image_tags WHERE id = ?', [tagId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getAllImagesWithTags() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT DISTINCT image_path
        FROM image_tags
        ORDER BY image_path
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  // Project settings methods
  async getProjectSetting(key) {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT value FROM project_settings WHERE key = ?
      `, [key], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.value : null);
      });
    });
  }

  async setProjectSetting(key, value) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR REPLACE INTO project_settings (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
      `, [key, value], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async deleteProjectSetting(key) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        DELETE FROM project_settings WHERE key = ?
      `, [key], (err) => {
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
