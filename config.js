// =====================================================
//  CONFIGURAÇÃO DO PEDEKI  (só mexa aqui)
// =====================================================
window.PEDEKI = {
  // 1) Cole aqui a configuração do seu app Web do Firebase
  //    (Firebase > Configurações do projeto > Seus apps > Config)
  firebase: {
    apiKey: "AIzaSyBZMnu3i3J1Hj06Z-E7k4myynsh0TnM2qI",
    authDomain: "vertexmods.firebaseapp.com",
    projectId: "vertexmods",
    storageBucket: "vertexmods.firebasestorage.app",
    messagingSenderId: "832719362143",
    appId: "1:832719362143:web:300b9ffde163efd39ae3ea"
  },

  // 2) Endereço do seu Worker da Cloudflare (pagamentos)
  worker: "https://pedeki-pagamentos.SEU-USUARIO.workers.dev",

  // 3) Seu e-mail de administrador (o mesmo do firestore.rules)
  adminEmail: "davidsoars2266@gmail.com",

  // 4) Valores mostrados no site (o valor cobrado de verdade fica no Worker)
  preco: 39.90,
  diasTeste: 7,
  diasPlano: 30,

  // 5) Link da loja de exemplo (o "link" que você escolher ao criar ela)
  lojaExemplo: "exemplo"
};