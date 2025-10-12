const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class GoogleDriveManager extends EventEmitter {
  constructor() {
    super();
    this.drive = null;
    this.auth = null;
    this.isAuthenticated = false;
  }

  /**
   * Initialize Google Drive authentication
   * @param {string} credentialsPath - Path to Google API credentials JSON file
   */
  async authenticate(credentialsPath) {
    try {
      if (!fs.existsSync(credentialsPath)) {
        throw new Error('Credentials file not found');
      }

      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

      // Create OAuth2 client
      const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
      const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

      // Check if we have previously stored a token
      const tokenPath = path.join(path.dirname(credentialsPath), 'token.json');
      if (fs.existsSync(tokenPath)) {
        const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        oAuth2Client.setCredentials(token);
        this.auth = oAuth2Client;
        this.drive = google.drive({ version: 'v3', auth: this.auth });
        this.isAuthenticated = true;
        return { success: true, needsAuth: false };
      }

      // If no token exists, return auth URL for user to authenticate
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.readonly']
      });

      return { success: false, needsAuth: true, authUrl, oAuth2Client };
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  /**
   * Complete authentication with authorization code
   */
  async completeAuthentication(oAuth2Client, code, credentialsPath) {
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);

      // Save the token for future use
      const tokenPath = path.join(path.dirname(credentialsPath), 'token.json');
      fs.writeFileSync(tokenPath, JSON.stringify(tokens));

      this.auth = oAuth2Client;
      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.isAuthenticated = true;

      return { success: true };
    } catch (error) {
      console.error('Error completing authentication:', error);
      throw error;
    }
  }

  /**
   * List files in a specific folder
   * @param {string} folderId - Google Drive folder ID
   */
  async listFiles(folderId) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and mimeType contains 'image/jpeg' and trashed=false`,
        fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
        pageSize: 1000
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Download a file from Google Drive
   * @param {string} fileId - File ID in Google Drive
   * @param {string} destinationPath - Local path to save the file
   */
  async downloadFile(fileId, destinationPath) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      const dest = fs.createWriteStream(destinationPath);

      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      return new Promise((resolve, reject) => {
        response.data
          .on('end', () => {
            resolve({ success: true });
          })
          .on('error', (err) => {
            reject(err);
          })
          .pipe(dest);
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  /**
   * Download multiple files with progress tracking
   * @param {Array} files - Array of file objects with {id, name}
   * @param {string} destinationFolder - Local folder to save files
   */
  async downloadFiles(files, destinationFolder) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google Drive');
    }

    const results = {
      total: files.length,
      downloaded: 0,
      failed: 0,
      errors: []
    };

    for (const file of files) {
      try {
        const filePath = path.join(destinationFolder, file.name);

        // Skip if file already exists
        if (fs.existsSync(filePath)) {
          results.downloaded++;
          this.emit('file-downloaded', { file: file.name, status: 'skipped' });
          continue;
        }

        await this.downloadFile(file.id, filePath);
        results.downloaded++;
        this.emit('file-downloaded', { file: file.name, status: 'success' });
      } catch (error) {
        results.failed++;
        results.errors.push({ file: file.name, error: error.message });
        this.emit('file-downloaded', { file: file.name, status: 'error', error: error.message });
      }

      // Emit progress
      this.emit('download-progress', {
        current: results.downloaded + results.failed,
        total: results.total,
        percentage: Math.round(((results.downloaded + results.failed) / results.total) * 100)
      });
    }

    return results;
  }

  /**
   * Get user information by filename matching
   * This helps identify which images belong to which users
   */
  async findUserImages(users, folderId) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      const files = await this.listFiles(folderId);
      const matches = [];

      users.forEach(user => {
        // Try to match by document number or NIA in filename
        const identifiers = [user.document, user.nia].filter(Boolean);

        identifiers.forEach(identifier => {
          const matchedFiles = files.filter(file =>
            file.name.toLowerCase().includes(identifier.toLowerCase())
          );

          matchedFiles.forEach(file => {
            matches.push({
              userId: user.id,
              fileId: file.id,
              fileName: file.name,
              matched: true
            });
          });
        });
      });

      return { files, matches };
    } catch (error) {
      console.error('Error finding user images:', error);
      throw error;
    }
  }
}

module.exports = GoogleDriveManager;
