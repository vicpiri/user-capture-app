const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class FolderWatcher extends EventEmitter {
  constructor(ingestPath, importsPath) {
    super();
    this.ingestPath = ingestPath;
    this.importsPath = importsPath;
    this.watcher = null;
    this.isProcessing = new Set();
  }

  start() {
    // Watch the ingest folder for new images
    this.watcher = chokidar.watch(this.ingestPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (filePath) => this.handleNewFile(filePath))
      .on('error', (error) => console.error('Watcher error:', error));

    console.log('Folder watcher started on:', this.ingestPath);
  }

  async handleNewFile(filePath) {
    // Prevent processing the same file multiple times
    if (this.isProcessing.has(filePath)) {
      return;
    }

    const ext = path.extname(filePath).toLowerCase();

    // Only process JPG files
    if (ext !== '.jpg' && ext !== '.jpeg') {
      console.log('Ignoring non-JPG file:', filePath);
      return;
    }

    this.isProcessing.add(filePath);

    try {
      // Wait a bit to ensure file is completely written
      await this.waitForFileStability(filePath);

      // Validate file size (max 5MB)
      const stats = fs.statSync(filePath);
      if (stats.size > 5 * 1024 * 1024) {
        console.error('File too large:', filePath);
        this.isProcessing.delete(filePath);
        return;
      }

      // Generate formatted filename with timestamp
      const timestamp = new Date();
      const formattedName = this.formatTimestamp(timestamp);
      const ext = path.extname(filePath);
      let newFilename = `${formattedName}${ext}`;
      let destinationPath = path.join(this.importsPath, newFilename);

      // Handle duplicate filenames (same second)
      let finalDestination = destinationPath;
      let counter = 1;
      while (fs.existsSync(finalDestination)) {
        newFilename = `${formattedName}_${counter}${ext}`;
        finalDestination = path.join(this.importsPath, newFilename);
        counter++;
      }

      // Move the file
      fs.renameSync(filePath, finalDestination);

      console.log('Image moved to imports:', path.basename(finalDestination));

      // Emit event
      this.emit('image-added', path.basename(finalDestination));

      this.isProcessing.delete(filePath);
    } catch (error) {
      console.error('Error processing file:', error);
      this.isProcessing.delete(filePath);
    }
  }

  async waitForFileStability(filePath, timeout = 2000) {
    return new Promise((resolve, reject) => {
      let lastSize = -1;
      let stableCount = 0;
      const requiredStableCount = 3;

      const interval = setInterval(() => {
        try {
          if (!fs.existsSync(filePath)) {
            clearInterval(interval);
            reject(new Error('File disappeared'));
            return;
          }

          const stats = fs.statSync(filePath);
          const currentSize = stats.size;

          if (currentSize === lastSize) {
            stableCount++;
            if (stableCount >= requiredStableCount) {
              clearInterval(interval);
              resolve();
            }
          } else {
            stableCount = 0;
            lastSize = currentSize;
          }
        } catch (error) {
          clearInterval(interval);
          reject(error);
        }
      }, 200);

      // Timeout
      setTimeout(() => {
        clearInterval(interval);
        resolve(); // Resolve anyway after timeout
      }, timeout);
    });
  }

  formatTimestamp(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      console.log('Folder watcher stopped');
    }
  }
}

module.exports = FolderWatcher;
