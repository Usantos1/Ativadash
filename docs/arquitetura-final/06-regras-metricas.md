# Regras de consistência das métricas

**Objetivo:** o mesmo número não muda de significado entre dashboard, marketing, captação, conversão e receita; estados vazios são **comunicação honesta**, não “zero mentiroso”.

**Princípio:** cada KPI tem **fonte primária** e **regras de fallback** documentadas abaixo.

---

## 1. Vocabulário de estados na UI

| Estado exibido | Significado | Quando usar |
|----------------|-------------|-------------|
| **Valor numérico (incluindo 0)** | Dado retornado pela fonte com semântica clara | API retornou número e métrica está definida para o período |
| **— (em dash)** | **Indisponível** | API não expõe a métrica, escopo não autorizado, ou canal desligado para o usuário |
| **“Sem dados no período”** | **Sem base** | Integração OK mas nenhum evento no range (ex.: gasto 0 e também sem impressões) |
| **“Estimado”** | **Estimado** | Modelo heurístico ou projeção (sempre com tooltip “como calculamos”) — usar raramente |
| **“Tracking incompleto”** | **Tracking incompleto** | Compras/receita dependem de pixel/webhook e há evidência de configuração parcial ou ausência de eventos de compra com gasto > 0 |
| **“Híbrido / taxa >100%”** | Leitura de funil com volumes não monótonos | Apenas conversão/funil; não alterar números brutos |

**Regra:** não usar **0** para “não sabemos” — usar **—** ou copy específica.

---

## 2. Fonte primária por KPI (workspace com Meta conectada)

| KPI | Fonte primária | Agregação |
|-----|----------------|-----------|
| Investimento (Meta) | Meta Insights / edge de gasto | Soma no período, moeda workspace |
| Impressões | Meta | Soma |
| Alcance | Meta (quando API devolve) | Conforme nota de agregação (soma diária vs único) — exibir nota em tooltip |
| Cliques | Meta | Soma |
| CTR | Derivado cliques ÷ impressões | Recalcular no servidor a partir de totais |
| CPC | Gasto ÷ cliques | Se cliques = 0 → **—** |
| CPM | Gasto ÷ impressões × mil | Se impressões = 0 → **—** |
| Frequência | Meta ou derivado impr ÷ alcance | Se alcance null → **—** ou só Meta |
| Link clicks | Meta (campo específico) | Se não retornado → **—** + “indisponível na API para o período” |
| LPV | Meta landing page views | Idem |
| Leads | Meta actions mapeadas | Soma |
| Checkout iniciado | Meta | Soma |
| Compras | Meta purchase events | Soma |
| Valor de compra / receita atribuída | Meta | Soma |
| ROAS | receita ÷ gasto | Se gasto = 0 → **—**; se receita indisponível → ver §3 |
| CPL | gasto ÷ leads | leads = 0 → **—** |

**Google (quando conectado):** paralelo com prefixo de objeto na resposta API ou `channel: google` em agregados; nunca somar Meta + Google no mesmo KPI sem rótulo “Total multicanal”.

---

## 3. Meta sem Google / Google sem Meta

| Cenário | Comportamento |
|---------|----------------|
| Só Meta | KPIs Google: **—**; cards Google ocultos ou seção “Google não conectado”. |
| Só Google | Inverso para Meta. |
| Nenhum | Dashboard: empty integrações; KPIs principais **—** ou “Sem canal conectado”. |
| Comparativo Meta vs Google | Somente se ambos com dados no período; senão mostrar uma coluna **—**. |

---

## 4. Período sem compra

| Condição | Exibição |
|----------|----------|
| Gasto > 0, compras = 0, pixel ativo | Compras = **0**; ROAS **—** ou “0×” com tooltip “sem compras atribuídas”; opcional **tracking incompleto** se regras abaixo |
| Gasto = 0, compras = 0 | “Sem dados no período” para bloco receita **ou** 0 com copy clara |
| Compras indisponíveis (API erro) | Receita **—**; mensagem de erro parcial |

---

## 5. Período com lead mas sem receita

- Leads: mostrar número real.
- Receita/ROAS: **—** ou 0 conforme §4; copy: “Há leads, mas sem compras atribuídas no período (verifique pixel/webhook).”
- Não inferir receita a partir de lead.

---

## 6. Webhook sem mídia

- Eventos de conversão/receita podem vir só de webhook.
- KPIs de **mídia** (impressões, CTR): **—** ou seção oculta.
- KPIs de **negócio** (leads webhook, compras webhook): exibir com selo **fonte: webhook** onde aplicável.
- Funil: etapas de mídia **—**; etapas alimentadas por webhook preenchidas.

---

## 7. Mídia sem webhook

- Comportamento padrão atual (só Meta/Google).
- Não exibir zeros falsos para eventos que só webhook traria; usar **—** nas linhas de atribuição cruzada.

---

## 8. Consistência entre telas

| Tela | Deve bater com |
|------|----------------|
| `/dashboard` cards | `GET /marketing/summary` mesmo `rangeKey` |
| `/marketing` topo | Mesmo summary; detalhe pode divergir só por filtros adicionais explícitos |
| `/marketing/captacao` | Subset ou drill-down; totais globais = summary se filtros default iguais |
| `/marketing/conversao` | Mesmos volumes brutos de funil que summary; taxas derivadas localmente igual servidor |
| `/marketing/receita` | Receita e compras = mesma fonte que dashboard “receita” |

**Cache:** `MetricsSnapshot` deve incluir `rangeKey` normalizado (`start_end_hash`) para invalidação previsível.

---

## 9. Delta período anterior

- Se período anterior sem dados: exibir **—** no delta, não ±∞%.
- Se comparativo desligado: ocultar delta.

---

## 10. Checklist de implementação (métricas)

- [ ] Tabela interna “KPI → fonte → estado se zero → estado se null” gerada a partir deste doc.
- [ ] Testes de contrato API: mesmos inputs → mesmos outputs nas rotas summary e dashboard.
- [ ] Tooltips no produto alinhados às notas de alcance/soma diária Meta.

---

*Próximo: [`07-checklist-pre-coding.md`](07-checklist-pre-coding.md)*
