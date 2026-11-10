// Chat de suporte: desenha as mensagens (painel da loja e central do admin)
import { esc, ms } from "./base.js";
const hora = t => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dia = t => { const d = new Date(t), h = new Date(); const ontem = new Date(h); ontem.setDate(h.getDate() - 1);
  if (d.toDateString() === h.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); };

export const BOAS_VINDAS = "Olá! 👋 Bem-vindo ao suporte da Pedeki.\nEscreva aqui embaixo o que você precisa: uma dúvida, um problema ou uma sugestão. A gente responde por aqui mesmo. 😊";
export const AGUARDE = "✅ Recebemos sua mensagem!\nAguarde um pouquinho que já vamos te responder aqui. Enquanto isso, conte o máximo de detalhes: o que aconteceu e em qual tela.";

// msgs: [{de:'loja'|'admin', texto, em}] — souAdmin: quem está olhando
export function desenhaChat(caixa, msgs, souAdmin) {
  const meu = souAdmin ? "admin" : "loja";
  let html = "", ultDia = "";
  const jaTinha = +(caixa.dataset.n || 0); caixa.dataset.n = msgs.length;
  if (!souAdmin) html += `<div class="bolha auto"><span class="rot">Pedeki · mensagem automática</span>${esc(BOAS_VINDAS)}</div>`;
  msgs.forEach((m, i) => {
    const t = ms(m.em) || Date.now(), d = dia(t);
    if (d !== ultDia) { html += `<div class="chat-dia">${d}</div>`; ultDia = d; }
    const lado = m.de === meu ? "meu" : "eles";
    const rot = lado === "eles" && !souAdmin ? '<span class="rot">Suporte Pedeki</span>' : "";
    html += `<div class="bolha ${lado}${caixa.dataset.ja && i >= jaTinha ? " nova" : ""}">${rot}${esc(m.texto)}<small>${hora(t)}</small></div>`;
    // a cada vez que a loja começa a falar (início ou depois de uma resposta): aviso automático de "aguarde"
    const ant = msgs[i - 1];
    if (m.de === "loja" && (!ant || ant.de === "admin")) html += souAdmin
      ? `<div class="chat-dia">a loja recebeu o aviso automático de "aguarde"</div>`
      : `<div class="bolha auto"><span class="rot">Pedeki · mensagem automática</span>${esc(AGUARDE)}</div>`;
  });
  const embaixo = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 80;
  caixa.innerHTML = html;
  if (embaixo || !caixa.dataset.ja) caixa.scrollTop = caixa.scrollHeight;
  caixa.dataset.ja = 1;
}

// Enter envia, Shift+Enter quebra linha; caixa cresce
export function ligaEnvio(txt, botao, enviar) {
  const vai = async () => { const v = txt.value.trim(); if (!v) return; botao.disabled = true;
    try { await enviar(v.slice(0, 1000)); txt.value = ""; txt.style.height = ""; } finally { botao.disabled = false; txt.focus(); } };
  botao.onclick = vai;
  txt.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); vai(); } };
  txt.oninput = () => { txt.style.height = "auto"; txt.style.height = Math.min(txt.scrollHeight, 120) + "px"; };
}
