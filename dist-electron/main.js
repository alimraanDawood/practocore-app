import { app as o, BrowserWindow as r } from "electron";
import t from "node:path";
import { createRequire as s } from "module";
import { fileURLToPath as a } from "url";
const l = s(import.meta.url), { setup: p } = l("firebase-electron"), c = a(import.meta.url), n = t.dirname(c);
let e;
function i() {
  e = new r({
    width: 1200,
    height: 600,
    icon: "@/assets/icon.png",
    webPreferences: {
      preload: t.join(n, "preload.js"),
      sandbox: !1
    }
  }), p(e.webContents), process.env.VITE_DEV_SERVER_URL ? e.loadURL("http://localhost:3000") : e.loadFile(t.join(n, "../.output/public/index.html")), e.webContents.openDevTools();
}
o.whenReady().then(() => {
  i(), o.on("activate", () => {
    r.getAllWindows().length === 0 && i();
  });
});
o.on("window-all-closed", () => {
  process.platform !== "darwin" && o.quit();
});
