import { app, BrowserWindow } from 'electron';
import path from "node:path";

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { setup: setupPushReceiver } = require('firebase-electron');

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win;

function createWindow () {
    win = new BrowserWindow({
        width: 1200,
        height: 600,
        icon: '@/assets/icon.png',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false
        }
    });

    setupPushReceiver(win.webContents);

    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});