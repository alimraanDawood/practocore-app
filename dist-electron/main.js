import { app as o, BrowserWindow as n } from "electron";
import r from "node:path";
import { createRequire as i } from "module";
import { fileURLToPath as a } from "url";
const s = i(import.meta.url), { setup: l } = s("firebase-electron"), p = a(import.meta.url), c = r.dirname(p);
let e;
function t() {
  e = new n({
    width: 1200,
    height: 600,
    icon: "@/assets/icon.png",
    webPreferences: {
      preload: r.join(c, "preload.js"),
      sandbox: !1
    }
  }), l(e.webContents), e.loadURL("http://localhost:3000"), e.webContents.openDevTools();
}
o.whenReady().then(() => {
  t(), o.on("activate", () => {
    n.getAllWindows().length === 0 && t();
  });
});
o.on("window-all-closed", () => {
  process.platform !== "darwin" && o.quit();
});
