import { contextBridge } from 'electron';

console.log("I have been executed!");
contextBridge.exposeInMainWorld('is_desktop', true);
