/**
 * Textos da pagina Integracoes via \uXXXX (arquivo ASCII).
 * Garante UTF-8 correto no bundle mesmo se .tsx for salvo com encoding errado no build.
 */
export const IX = {
  hojeAsPrefix: "Hoje \u00e0s ",
  pageTitle: "Integra\u00e7\u00f5es",
  /** EM DASH (\u2014) antes de "use a aba" */
  introPublicidadeWhatsapp: "Publicidade (Google e Meta) e alertas por WhatsApp via Ativa CRM \u2014 use a aba ",
  searchPlaceholder: "Buscar integra\u00e7\u00e3o...",
  disponiveisAgora: "Dispon\u00edveis agora",
  outrasPlataformas: "Outras plataformas ",
  emBreveCount: (n: number) => `(em breve \u00b7 ${n})`,
  roadmapWhatsappAba: "Roadmap: checkout e webhooks. Alertas por WhatsApp: aba ",
  nestaPagina: "nesta p\u00e1gina.",
  nenhumaTitulo: "Nenhuma integra\u00e7\u00e3o encontrada",

  ultimaSync: "\u00daltima sync: ",

  authIncompleta: "Autoriza\u00e7\u00e3o incompleta.",
  sessaoExpirada: "Sess\u00e3o expirada. Tente conectar de novo.",
  naoFoiPossivelConexao: "N\u00e3o foi poss\u00edvel iniciar a conex\u00e3o.",
  integracaoDesvinculada: "Integra\u00e7\u00e3o desvinculada.",

  errCarregarCfg: "N\u00e3o foi poss\u00edvel carregar as configura\u00e7\u00f5es.",
  cfgSalvas: "Configura\u00e7\u00f5es salvas.",
  ativaCrmCfgSalvas: "Ativa CRM: configura\u00e7\u00f5es salvas.",
  integracaoRemovida: "Integra\u00e7\u00e3o removida.",
  painelIntegracaoTitle: "Integra\u00e7\u00e3o WhatsApp (Ativa CRM)",
  painelPeriodoTail: "quando o painel avaliar o per\u00edodo.",
  tokenPhOpcional: "Opcional (deixe em branco para manter o token atual)",
  tokenPhCole: "Cole o token da conex\u00e3o WhatsApp",
  tokenAfterLink: ": abra o menu ",
  conexoesMenu: "Conex\u00f5es",
  tokenAfterConexoes: ", edite a conex\u00e3o do WhatsApp e copie o valor do campo ",
  numeroAvisos: "N\u00famero que receber\u00e1 os avisos (Brasil: comece com 55, ex.: 5511999999999).",
  alertasCriticos: "Enviar alertas cr\u00edticos e de aviso por WhatsApp",
  periodoMarketingFull:
    "Ao avaliar o per\u00edodo no Dashboard/Marketing, mensagens de gravidade alta s\u00e3o enviadas (m\u00ednimo de 15 minutos entre envios).",
  whatsappPadrao: "WhatsApp padr\u00e3o",
  salvarCfg: "Salvar configura\u00e7\u00f5es",
  removerIntegracao: "Remover integra\u00e7\u00e3o",
} as const;
