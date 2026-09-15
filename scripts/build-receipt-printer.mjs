#!/usr/bin/env node
/**
 * Build the receipt printer helper (native/receipt-printer/ReceiptPrinter.cs)
 *
 * Uses the C# compiler that comes with .NET Framework 4.x, part of every
 * Windows 10 and 11, so there is nothing to install. The result goes to
 * build/receipt-printer/, from where electron-builder copies it into the
 * installer (build.win.extraResources) and the app runs it in development.
 *
 *   node scripts/build-receipt-printer.mjs             fails if it cannot build
 *   node scripts/build-receipt-printer.mjs --optional  only warns (npm install)
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'native', 'receipt-printer', 'ReceiptPrinter.cs');
const output = path.join(root, 'build', 'receipt-printer', 'ReceiptPrinter.exe');
const optional = process.argv.includes('--optional');

function give(message) {
  if (optional) {
    console.warn(`[receipt-printer] ${message} Receipts will print through Chromium.`);
    process.exit(0);
  }
  console.error(`[receipt-printer] ${message}`);
  process.exit(1);
}

if (process.platform !== 'win32') {
  console.log('[receipt-printer] Not on Windows: skipped.');
  process.exit(0);
}

const windows = process.env.WINDIR || 'C:/Windows';
const compiler = ['Framework64', 'Framework']
  .map((dir) => path.join(windows, 'Microsoft.NET', dir, 'v4.0.30319', 'csc.exe'))
  .find((candidate) => fs.existsSync(candidate));

if (!compiler) {
  give('The C# compiler of .NET Framework 4.x was not found.');
}

if (fs.existsSync(output) && fs.statSync(output).mtimeMs >= fs.statSync(source).mtimeMs) {
  console.log('[receipt-printer] Up to date.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(output), { recursive: true });

try {
  execFileSync(compiler, [
    '-nologo',
    '-optimize',
    // The source is UTF-8; csc would read it as the ANSI code page
    '-codepage:65001',
    '-target:exe',
    `-out:${output}`,
    '-r:System.Drawing.dll',
    '-r:System.Windows.Forms.dll',
    '-r:System.Web.Extensions.dll',
    source
  ], { stdio: 'inherit' });
} catch (error) {
  give(`Could not compile ${path.relative(root, source)}.`);
}

console.log(`[receipt-printer] Built ${path.relative(root, output)}`);
