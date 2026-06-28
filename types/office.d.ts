// Minimal ambient declarations for the Office.js + Word.js globals used by the Word
// add-in routes (lib/office.ts). This is a SPIKE shim: it keeps `nuxi typecheck`
// green without pulling in the full `@types/office-js` dev dependency. Replace with
// `@types/office-js` when the Word integration graduates from spike to product.
declare const Office: any;
declare const Word: any;

interface Window {
  Office?: any;
  Word?: any;
}
