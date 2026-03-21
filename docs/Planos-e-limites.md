# Planos e limites (Ativa Dash)

## Conceitos

| Conceito | Onde aparece | O que conta no limite |
|----------|----------------|------------------------|
| **Usuários** | Equipe | Contas com **login** (membership **direta** na empresa ativa). Acesso “pela agência” não entra nessa contagem para o limite do plano. |
| **Clientes comerciais** | Menu **Clientes** | Registros de marcas/contas que você atende **dentro** da empresa ativa. |
| **Empresas vinculadas** | Configurações → Empresa | Organizações **filhas** (revenda): cada uma é um ambiente isolado no seletor do topo. |
| **Integrações** | Marketing → Integrações | Contas **conectadas** (status `connected`) por empresa. |
| **Dashboards** | (futuro / uso do modelo) | Contagem no banco por organização; limite já definido no plano. |

## Planos no seed (`npm run seed`)

| Slug | Nome | Usuários | Clientes | Empresas filhas | Integrações | Dashboards |
|------|------|----------|----------|-----------------|-------------|--------------|
| `starter` | Essencial | 3 | 15 | 0 | 3 | 10 |
| `professional` | Profissional | 10 | 60 | 15 | 10 | 40 |
| `agency` | Agência Plus | 30 | ∞ | ∞ | 20 | 100 |

- `null` em **maxClientAccounts** ou **maxChildOrganizations** = ilimitado.
- **maxUsers** `null` = ilimitado (não usado nos seeds atuais).

## Comportamento no sistema

- Cadastro (`register`): nova organização recebe o plano **starter**.
- Criar **cliente comercial**: bloqueado ao atingir `maxClientAccounts` (HTTP 403).
- Criar **empresa vinculada**: bloqueado se `maxChildOrganizations` for 0 ou limite atingido; a filha **herda** o `planId` da mãe.
- Nova **integração** (primeira conexão por slug): bloqueada se já houver `maxIntegrations` integrações **conectadas**.
- `GET /api/organization` passa a incluir `plan`, `limits` e `usage` para o front exibir contadores.

## Usuários: controle completo

Hoje não há endpoint de convite de membro; o limite **maxUsers** já está no banco e na API de contexto. Na **Equipe**, exibimos `diretos / limite`. Quando existir `POST` de convite, deve-se chamar a mesma regra: contar memberships diretas e recusar acima de `maxUsers`.
