// Páginas de Termos e Privacidade: ano, contato e identificação
(function () {
  var C = window.PEDEKI || {};
  var zap = C.suporteZap || "5582994012972";
  var ano = document.getElementById("ano");
  if (ano) ano.textContent = new Date().getFullYear();
  var txt = encodeURIComponent("Olá! Tenho uma dúvida/solicitação sobre meus dados na Pedeki.");
  document.querySelectorAll("#btZapPriv,#btZapTermos").forEach(function (a) {
    a.href = "https://wa.me/" + zap + "?text=" + txt;
  });
  var id = document.getElementById("identificacao");
  if (id) {
    id.innerHTML = C.cnpj
      ? "Responsável: <b>" + (C.razaoSocial || "Pedeki") + "</b>, CNPJ <b>" + C.cnpj + "</b>."
      : "Contato oficial: WhatsApp de atendimento informado no fim desta página.";
  }
})();
