// İkonları SVG-dən PNG-yə çevirir (Playwright/Chromium ilə). Bir dəfə işlədilir.
const { chromium } = require("playwright");
const path = require("path");
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" ${pad ? "" : 'rx="112"'} fill="#0f1115"/>
  <g transform="translate(256 256) scale(${pad ? 0.72 : 0.9}) translate(-256 -256)">
    <circle cx="256" cy="256" r="190" fill="#f5b942"/>
    <g fill="none" stroke="#1a1405" stroke-width="22" stroke-linecap="round">
      <circle cx="186" cy="330" r="46"/><circle cx="326" cy="330" r="46"/>
      <path d="M215 296 L330 140"/><path d="M297 296 L182 140"/>
    </g>
  </g></svg>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const out = (f) => path.join(__dirname, "..", "public", "icons", f);
  for (const [file, size, pad] of [["icon-192.png",192,false],["icon-512.png",512,false],["icon-maskable-512.png",512,true],["apple-touch-icon.png",180,true]]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg(pad).replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: out(file), omitBackground: !pad });
  }
  await b.close();
})();
