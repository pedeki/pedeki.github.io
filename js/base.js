import * as F from "./fb.js";

export const C = window.PEDEKI;
export const configurado = C && C.firebase && C.firebase.apiKey && C.firebase.apiKey !== "COLE_AQUI";
// O app do entregador usa um login SEPARADO do painel da loja.
// Assim, entrar como entregador não tira o dono da loja do painel (e vice-versa) no mesmo celular.
const NOME_APP = /entregador/i.test(location.pathname) ? "entregador" : "[DEFAULT]";
export const app = F.initializeApp(C.firebase, NOME_APP);
export const auth = F.getAuth(app);
export const db = F.getFirestore(app);
export { F };

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const R = v => "R$ " + Number(v || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const soNum = s => String(s || "").replace(/\D/g, "");
export const num = v => { const n = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")); return isNaN(n) ? 0 : n; };
export const dinheiroInput = v => (v === null || v === undefined || v === "") ? "" : Number(v).toFixed(2).replace(".", ",");

export function zapNum(s) {
  let n = soNum(s);
  if (n.length === 10 || n.length === 11) n = "55" + n;
  return n;
}
export function fmtTel(s) {
  let n = soNum(s);
  if (n.startsWith("55") && n.length > 11) n = n.slice(2);
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return s || "";
}
export function mascaraTel(input) {
  input.addEventListener("input", () => {
    let n = soNum(input.value).slice(0, 11);
    let r = n;
    if (n.length > 2) r = `(${n.slice(0, 2)}) ${n.slice(2)}`;
    if (n.length > 7) r = `(${n.slice(0, 2)}) ${n.slice(2, n.length === 11 ? 7 : 6)}-${n.slice(n.length === 11 ? 7 : 6)}`;
    input.value = r;
  });
}
export function cpfValido(c) {
  c = soNum(c);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i);
    if (((10 * s) % 11) % 10 !== +c[t]) return false;
  }
  return true;
}
export function slugify(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
}
export const zapLink = (numero, texto) => `https://wa.me/${zapNum(numero)}?text=${encodeURIComponent(texto)}`;

// datas
export function ms(t) {
  if (!t) return 0;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t === "number") return t;
  return 0;
}
export const DIA = 864e5;
export const fimTeste = l => ms(l.criadoEm) + (l.testeDias || 0) * DIA;
export const validoAte = l => Math.max(fimTeste(l), ms(l.pagoAte));
export const lojaAtiva = l => !!l && validoAte(l) > Date.now();
export const emTeste = l => fimTeste(l) > Date.now() && ms(l.pagoAte) < fimTeste(l);
export const dataBR = m => new Date(m).toLocaleDateString("pt-BR");
export const horaBR = m => new Date(m).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const diasRestantes = m => Math.max(0, Math.ceil((m - Date.now()) / DIA));

export const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
export const DIAS_NOME = { dom: "Domingo", seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado" };
export function horariosPadrao() {
  const h = {};
  DIAS.forEach(d => h[d] = { on: true, ab: "18:00", fe: "23:30" });
  return h;
}
const minDe = s => { const [h, m] = String(s || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
export function abertaAgora(l, agora = new Date()) {
  if (!l) return false;
  if (l.abertoModo === "aberto") return true;
  if (l.abertoModo === "fechado") return false;
  const h = l.horarios || horariosPadrao();
  const d = agora.getDay(), m = agora.getHours() * 60 + agora.getMinutes();
  const hoje = h[DIAS[d]], ontem = h[DIAS[(d + 6) % 7]];
  if (hoje && hoje.on) {
    const a = minDe(hoje.ab), f = minDe(hoje.fe);
    if (a < f ? (m >= a && m < f) : (m >= a)) return true;
  }
  if (ontem && ontem.on) {
    const a = minDe(ontem.ab), f = minDe(ontem.fe);
    if (a > f && m < f) return true;
  }
  return false;
}
export function proximaAbertura(l, agora = new Date()) {
  const h = l.horarios || horariosPadrao();
  for (let i = 0; i < 7; i++) {
    const d = DIAS[(agora.getDay() + i) % 7];
    if (h[d] && h[d].on) {
      if (i === 0 && minDe(h[d].ab) <= agora.getHours() * 60 + agora.getMinutes()) continue;
      return (i === 0 ? "hoje" : i === 1 ? "amanhã" : DIAS_NOME[d].toLowerCase()) + " às " + h[d].ab;
    }
  }
  return "";
}

// imagens: reduz e transforma em texto (fica salvo no banco de dados, grátis)
export function comprimir(file, maxW, maxH, q = 0.78) {
  return new Promise((ok, erro) => {
    const fr = new FileReader();
    fr.onerror = erro;
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => erro(new Error("Imagem inválida"));
      img.onload = () => {
        const s = Math.min(1, maxW / img.width, maxH / img.height);
        const w = Math.round(img.width * s), h = Math.round(img.height * s);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const x = c.getContext("2d");
        x.fillStyle = "#fff"; x.fillRect(0, 0, w, h);
        x.drawImage(img, 0, 0, w, h);
        ok(c.toDataURL("image/jpeg", q));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

// avisos na tela
export function toast(msg, tipo = "ok") {
  let box = $("#toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; document.body.appendChild(box); }
  const t = document.createElement("div");
  t.className = "toast " + tipo;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add("sai"), 3200);
  setTimeout(() => t.remove(), 3700);
}

export function erroAmigavel(e) {
  const c = (e && e.code) || "";
  const m = {
    "auth/email-already-in-use": "Esse e-mail já tem cadastro. Use a opção Entrar.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/invalid-credential": "E-mail ou senha errados.",
    "auth/wrong-password": "E-mail ou senha errados.",
    "auth/user-not-found": "E-mail não encontrado.",
    "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos.",
    "auth/network-request-failed": "Sem internet. Verifique sua conexão.",
    "permission-denied": "Sem permissão para fazer isso."
  };
  return m[c] || (e && e.message) || "Algo deu errado. Tente de novo.";
}

export function linkLoja(slug) {
  return new URL("loja.html?l=" + encodeURIComponent(slug), location.href).href;
}
export function linkPedido(uid, pid) {
  return new URL(`pedido.html?l=${encodeURIComponent(uid)}&p=${encodeURIComponent(pid)}`, location.href).href;
}

export const LOGO = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="lgP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5A1F"/><stop offset="1" stop-color="#FF8A3D"/></linearGradient></defs><rect width="48" height="48" rx="14" fill="url(#lgP)"/><path d="M12.5 17.5a4.5 4.5 0 0 1 4.5-4.5h14a4.5 4.5 0 0 1 4.5 4.5v11a4.5 4.5 0 0 1-4.5 4.5h-8.2l-6.3 5.2V33A4.5 4.5 0 0 1 12.5 28.5z" fill="#fff"/><path d="M19.5 21v-1.5a4.5 4.5 0 0 1 9 0V21" fill="none" stroke="#FF5A1F" stroke-width="2.4" stroke-linecap="round"/><rect x="17" y="20.5" width="14" height="8.5" rx="2.2" fill="#FF5A1F"/></svg>`;
export const marcaHTML = `<span class="marca">${LOGO}<span>Pede<b>ki</b></span></span>`;

// mensagem do pedido (usada no cardápio e no acompanhamento)
export function textoPedido(p, loja, link) {
  const L = [];
  L.push(`🧾 *Pedido #${p.numero}* — ${loja.nome}`);
  L.push("");
  L.push(`*Cliente:* ${p.cliente.nome}`);
  L.push(`*Telefone:* ${fmtTel(p.cliente.tel)}`);
  L.push(`*Tipo:* ${p.tipo === "entrega" ? "🛵 Entrega" : "🏪 Retirada no local"}`);
  if (p.tipo === "entrega") L.push(`*Endereço:* ${p.cliente.endereco}`);
  L.push("");
  L.push("*Itens*");
  p.itens.forEach(i => {
    L.push(`${i.qtd}x ${i.nome} — ${R(i.unit * i.qtd)}`);
    (i.adicionais || []).forEach(a => L.push(`   + ${a.nome}${a.preco ? " (" + R(a.preco) + ")" : ""}`));
    if (i.obs) L.push(`   _Obs: ${i.obs}_`);
  });
  L.push("");
  L.push(`Subtotal: ${R(p.subtotal)}`);
  if (p.tipo === "entrega") L.push(`Taxa de entrega: ${p.taxa ? R(p.taxa) : "Grátis"}`);
  if (p.desconto) L.push(`Desconto (${p.cupom}): -${R(p.desconto)}`);
  L.push(`*Total: ${R(p.total)}*`);
  L.push("");
  L.push(`*Pagamento:* ${p.pagamento}${p.troco ? ` (troco para ${R(p.troco)})` : ""}`);
  if (p.obs) L.push(`*Observação:* ${p.obs}`);
  if (link) { L.push(""); L.push(`📍 Acompanhe: ${link}`); }
  return L.join("\n");
}
