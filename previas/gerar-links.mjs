import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const pasta = dirname(fileURLToPath(import.meta.url));
const SITE = "https://pedeki.github.io";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let n = 0;
for (const f of readdirSync(pasta).filter(x => x.endsWith(".json"))) {
  const id = f.slice(0, -5);
  if (!/^[a-z0-9-]+$/.test(id)) continue;
  const d = JSON.parse(readFileSync(join(pasta, f), "utf8"));
  const img = d.logo && existsSync(join(pasta, d.logo)) ? `${SITE}/previas/${d.logo}` : `${SITE}/pedeki-icone.png`;
  const destino = `../previa.html?p=${id}`;
  const titulo = `🍽️ Cardápio digital da ${d.nome}`;
  const desc = `Veja como ficou o cardápio da ${d.nome}: o cliente escolhe e o pedido chega pronto no WhatsApp. Feito pela Pedeki.`;
  writeFileSync(join(pasta, id + ".html"), `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="robots" content="noindex">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Pedeki">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${SITE}/previas/${id}.html">
<meta http-equiv="refresh" content="0;url=${destino}">
<script>location.replace(${JSON.stringify(destino)})</script>
</head><body style="font-family:sans-serif;text-align:center;padding:40px">
<a href="${destino}">Abrir o cardápio da ${esc(d.nome)}</a>
</body></html>
`);
  n++;
}
console.log(n + " páginas de link criadas.");
