// =====================================================
//  PEDEKI — PAGAMENTOS (Cloudflare Worker, grátis)
//  Gera o Pix da mensalidade pela BetterSell e libera a loja
//  sozinho quando o pagamento cai na sua carteira.
//
//  Variáveis (Settings > Variables and Secrets):
//    BETTERSELL_KEY   (Secret)  chave da API da BetterSell (bs_key_...)
//    FIREBASE_PROJECT (Text)    ID do projeto no Firebase
//    FIREBASE_EMAIL   (Text)    client_email da conta de serviço
//    FIREBASE_KEY     (Secret)  private_key da conta de serviço
//    PRECO            (Text)    valor da mensalidade, ex.: 39.90
//    DIAS             (Text)    dias liberados por pagamento, ex.: 30
// =====================================================

const BS = env => env.BS_BASE || "https://bettersell.com.br";
const TOKEN_URL = env => env.TOKEN_URL || "https://oauth2.googleapis.com/token";
const FS_HOST = env => env.FS_BASE || "https://firestore.googleapis.com";
const FS_DB = env => `projects/${env.FIREBASE_PROJECT}/databases/(default)/documents`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });

const preco = env => Number(env.PRECO || "39.90");
const dias = env => parseInt(env.DIAS || "30", 10);
const DIA = 86400000;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      if (url.pathname === "/") return json({ ok: true, servico: "pedeki-pagamentos" });
      if (url.pathname === "/teste") return await teste(env);
      if (url.pathname === "/cobrar" && req.method === "POST") return await cobrar(req, env, url);
      if (url.pathname === "/status" && req.method === "GET") return await status(url, env);
      if (url.pathname === "/webhook" && req.method === "POST") return await webhook(req, env);
      return json({ erro: "Rota não encontrada" }, 404);
    } catch (e) {
      console.log("ERRO", e && e.stack || e);
      return json({ erro: "Erro no servidor de pagamentos: " + (e && e.message || e) }, 500);
    }
  }
};

// ---------------- rotas ----------------

// Confere se tudo está configurado (não mostra nenhum segredo)
async function teste(env) {
  const r = { preco: preco(env), dias: dias(env), bettersell: "?", firebase: "?" };
  try {
    const s = await bs(env, "GET", "/api/external/payments/settings");
    r.bettersell = s.webhook_secret ? "ok" : "sem segredo de retorno";
  } catch (e) { r.bettersell = "erro: " + e.message; }
  try {
    await googleToken(env);
    r.firebase = "ok";
  } catch (e) { r.firebase = "erro: " + e.message; }
  return json(r);
}

async function cobrar(req, env, url) {
  const body = await req.json().catch(() => ({}));
  const loja = String(body.loja || "");
  if (!/^[A-Za-z0-9]{10,40}$/.test(loja)) return json({ erro: "Loja inválida" }, 400);
  const l = await fsGet(env, `lojas/${loja}`);
  if (!l) return json({ erro: "Loja não encontrada" }, 404);
  const valor = preco(env), d = dias(env);
  const nome = String(l.nome || "loja").slice(0, 80);
  const pay = await bs(env, "POST", "/api/external/payments", {
    amount: valor,
    description: `Pedeki - mensalidade ${d} dias - ${nome}`.slice(0, 180),
    reference: `pdk_${loja}_${Date.now()}`,
    metadata: { loja, dias: String(d), produto: "pedeki" },
    callback_url: `${url.origin}/webhook`,
    expiration_seconds: 1800,
    idempotency_key: crypto.randomUUID()
  });
  return json({
    id: pay.id, amount: pay.amount, status: pay.status,
    copy_paste: pay.copy_paste, qr_code_base64: pay.qr_code_base64, qr_code_url: pay.qr_code_url,
    expires_at: pay.expires_at
  });
}

async function status(url, env) {
  const id = String(url.searchParams.get("id") || "");
  if (!/^[A-Za-z0-9_.:-]{3,100}$/.test(id)) return json({ erro: "id inválido" }, 400);
  const pay = await bs(env, "GET", "/api/external/payments/" + encodeURIComponent(id));
  let validoAte = null;
  if (pay.paid === true) validoAte = await aplicar(env, pay);
  return json({ id: pay.id, paid: pay.paid === true, status: pay.status, terminal: pay.terminal === true, validoAte });
}

async function webhook(req, env) {
  const raw = await req.text();
  const ok = await assinaturaValida(env, raw, req.headers.get("X-BetterSell-Signature") || "");
  if (!ok) return json({ erro: "assinatura inválida" }, 401);
  let ev;
  try { ev = JSON.parse(raw); } catch { return json({ erro: "json inválido" }, 400); }
  if (ev.event !== "payment.external.paid" || typeof ev.data?.id !== "string") return json({ recebido: true });
  // confirma na API (a fonte da verdade), nunca só no aviso
  const pay = await bs(env, "GET", "/api/external/payments/" + encodeURIComponent(ev.data.id));
  if (pay.paid !== true) return json({ erro: "ainda não pago" }, 503);
  await aplicar(env, pay);
  return json({ recebido: true });
}

// ---------------- liberar a loja (uma vez só por pagamento) ----------------
async function aplicar(env, pay) {
  let loja = pay.metadata && pay.metadata.loja;
  if (!loja) { const m = /^pdk_([A-Za-z0-9]+)_\d+$/.exec(pay.reference || ""); if (m) loja = m[1]; }
  if (!loja || !/^[A-Za-z0-9]{10,40}$/.test(loja)) throw new Error("pagamento sem loja");
  if (Number(pay.amount) + 0.001 < preco(env)) { console.log("valor menor que o preço", pay.id, pay.amount); return null; }

  const ja = await fsGet(env, `pagamentos/${pay.id}`);
  if (ja) return ja.validoAte ? new Date(ja.validoAte).toISOString() : null;

  const l = await fsGet(env, `lojas/${loja}`);
  if (!l) throw new Error("loja não existe");
  const d = parseInt((pay.metadata && pay.metadata.dias) || dias(env), 10) || dias(env);
  const agora = Date.now();
  const fimTeste = (l.criadoEm ? l.criadoEm.getTime() : 0) + (l.testeDias || 0) * DIA;
  const base = Math.max(agora, l.pagoAte ? l.pagoAte.getTime() : 0, fimTeste);
  const novo = new Date(base + d * DIA);

  // grava as duas coisas juntas: o recibo (só se ainda não existir) e a nova validade
  const writes = [
    {
      update: {
        name: `${FS_DB(env)}/pagamentos/${pay.id}`,
        fields: toFields({ loja, valor: Number(pay.amount), dias: d, pagoEm: new Date(pay.paid_at || agora), validoAte: novo, referencia: pay.reference || "" })
      },
      currentDocument: { exists: false }
    },
    {
      update: { name: `${FS_DB(env)}/lojas/${loja}`, fields: toFields({ pagoAte: novo }) },
      updateMask: { fieldPaths: ["pagoAte"] },
      currentDocument: { exists: true }
    }
  ];
  const r = await fsFetch(env, "POST", `/v1/${FS_DB(env)}:commit`, { writes });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 409 || /ALREADY_EXISTS|FAILED_PRECONDITION/.test(t)) {
      const j = await fsGet(env, `pagamentos/${pay.id}`);
      return j && j.validoAte ? j.validoAte.toISOString() : null;
    }
    throw new Error("Firestore commit " + r.status + ": " + t.slice(0, 200));
  }
  console.log("loja liberada", loja, novo.toISOString());
  return novo.toISOString();
}

// ---------------- BetterSell ----------------
async function bs(env, method, path, body) {
  if (!env.BETTERSELL_KEY) throw new Error("BETTERSELL_KEY não configurada");
  const r = await fetch(BS(env) + path, {
    method,
    headers: { "X-API-Key": env.BETTERSELL_KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = { error: t.slice(0, 200) }; }
  if (!r.ok) {
    const msg = j.code === "wallet_not_activated" ? "Carteira da BetterSell não ativada" : (j.error || j.message || ("BetterSell " + r.status));
    throw new Error(msg);
  }
  return j;
}

let segredoCache = null;
async function segredo(env) {
  if (!segredoCache) segredoCache = (await bs(env, "GET", "/api/external/payments/settings")).webhook_secret;
  return segredoCache;
}

async function assinaturaValida(env, raw, header) {
  const m = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(header);
  if (!m) return false;
  const [, t, assinatura] = m;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const s = await segredo(env);
  if (!s) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + raw)));
  const esperado = [...mac].map(b => b.toString(16).padStart(2, "0")).join("");
  let dif = 0;
  for (let i = 0; i < 64; i++) dif |= esperado.charCodeAt(i) ^ assinatura.charCodeAt(i);
  return dif === 0;
}

// ---------------- Firestore (com a conta de serviço) ----------------
let tokenCache = { token: null, exp: 0 };
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlStr = s => b64url(new TextEncoder().encode(s));

async function googleToken(env) {
  if (tokenCache.token && tokenCache.exp > Date.now() + 60000) return tokenCache.token;
  if (!env.FIREBASE_EMAIL || !env.FIREBASE_KEY || !env.FIREBASE_PROJECT) throw new Error("variáveis do Firebase faltando");
  const pem = String(env.FIREBASE_KEY).replace(/\\n/g, "\n");
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const agora = Math.floor(Date.now() / 1000);
  const corpo = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + b64urlStr(JSON.stringify({
    iss: env.FIREBASE_EMAIL, scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600
  }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(corpo));
  const r = await fetch(TOKEN_URL(env), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + corpo + "." + b64url(sig)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("login do Google falhou: " + (j.error_description || j.error || r.status));
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}

async function fsFetch(env, method, path, body) {
  const tk = await googleToken(env);
  return fetch(FS_HOST(env) + path, {
    method,
    headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
}
async function fsGet(env, caminho) {
  const r = await fsFetch(env, "GET", `/v1/${FS_DB(env)}/${caminho}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Firestore " + r.status + ": " + (await r.text()).slice(0, 200));
  return fromFields((await r.json()).fields || {});
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(o) { const f = {}; for (const k in o) f[k] = toValue(o[k]); return f; }
function fromValue(v) {
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) return fromFields(v.mapValue.fields || {});
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  return null;
}
function fromFields(f) { const o = {}; for (const k in f) o[k] = fromValue(f[k]); return o; }
