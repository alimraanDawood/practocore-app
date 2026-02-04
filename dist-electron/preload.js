import { contextBridge as e } from "electron";
console.log("I have been executed!");
e.exposeInMainWorld("is_desktop", !0);
