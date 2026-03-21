/**
 * Textos da pagina Integracoes via \uXXXX (arquivo ASCII).
 * Garante UTF-8 correto no bundle mesmo se .tsx for salvo com encoding errado no build.
 */
export const IX = {
  hojeAsPrefix: "Hoje \u00e0s ",
  pageTitle: "Integra\u00e7\u00f5es",
  /** Eyebrow do cabe\u00e7alho da p\u00e1gina */
  eyebrowConexoes: "Conex\u00f5es",
  /** aria-label do select de cliente no card */
  ariaClienteComercialSelect: "Cliente comercial vinculado \u00e0 integra\u00e7\u00e3o",
  /** Origem dos dados quando a integra\u00e7\u00e3o ainda n\u00e3o est\u00e1 definida no card */
  dataSourceEmBreve: "\u2014",
  /** Subt\u00edtulo da p\u00e1gina (uma frase completa, UTF-8 via escapes) */
  pageSubtitle:
    "Conecte Google Ads e Meta Ads para m\u00e9tricas no per\u00edodo. Alertas de desempenho por WhatsApp: configure na aba WhatsApp (CRM) com o Ativa CRM.",
  /** Legado: composi\u00e7\u00e3o antiga; preferir pageSubtitle na p\u00e1gina */
  introPublicidadeWhatsapp: "Publicidade (Google e Meta) e alertas por WhatsApp via Ativa CRM \u2014 use a aba ",
  searchPlaceholder: "Buscar integra\u00e7\u00e3o\u2026",
  disponiveisAgora: "Dispon\u00edveis agora",
  /** Descri\u00e7\u00e3o da se\u00e7\u00e3o de redes j\u00e1 dispon\u00edveis */
  sectionDisponiveisDesc:
    "OAuth e leitura de campanhas no per\u00edodo selecionado no Marketing.",
  /** Integra\u00e7\u00f5es em roadmap (texto gen\u00e9rico) */
  sectionRoadmapGenerico:
    "Integra\u00e7\u00f5es em roadmap para CRM, checkout, pagamentos e automa\u00e7\u00f5es. Fale com o comercial para priorizar.",
  sectionCrmRoadmapDesc:
    "Use a aba WhatsApp (CRM) para alertas via Ativa CRM. Demais integra\u00e7\u00f5es de CRM e mensageria seguem no roadmap.",
  outrasPlataformas: "Outras plataformas ",
  emBreveCount: (n: number) => `(em breve \u00b7 ${n})`,
  roadmapWhatsappAba: "Roadmap: checkout e webhooks. Alertas por WhatsApp: aba ",
  nestaPagina: "nesta p\u00e1gina.",
  nenhumaTitulo: "Nenhuma integra\u00e7\u00e3o encontrada",

  testarConexaoOk:
    "Conex\u00e3o verificada \u2014 lista atualizada. Confira a \u00faltima sincroniza\u00e7\u00e3o no card.",
  vinculoClienteOk: "V\u00ednculo com cliente atualizado.",
  vinculoClienteErro: "Erro ao salvar v\u00ednculo.",

  ultimaSync: "\u00daltima sincroniza\u00e7\u00e3o: ",

  authIncompleta: "Autoriza\u00e7\u00e3o incompleta.",
  sessaoExpirada: "Sess\u00e3o expirada. Tente conectar de novo.",
  naoFoiPossivelConexao: "N\u00e3o foi poss\u00edvel iniciar a conex\u00e3o.",
  integracaoDesvinculada: "Integra\u00e7\u00e3o desvinculada.",
  planLimitIntegrations:
    "Limite do plano: m\u00e1ximo de integra\u00e7\u00f5es conectadas. Desvincule uma conta ou fale com vendas para ampliar.",

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
