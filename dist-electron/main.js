import { app as o, BrowserWindow as t } from "electron";
import i from "node:path";
import { fileURLToPath as a } from "url";
const r = a(import.meta.url), l = i.dirname(r);
function n() {
  const e = new t({
    width: 1200,
    height: 600,
    webPreferences: {
      preload: i.join(l, "preload.js"),
      sandbox: !1
    }
  });
  e.loadURL("http://localhost:3000"), e.webContents.openDevTools();
}
o.whenReady().then(() => {
  n(), o.on("activate", () => {
    t.getAllWindows().length === 0 && n();
  });
});
o.on("window-all-closed", () => {
  process.platform !== "darwin" && o.quit();
});
