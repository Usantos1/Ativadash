# Empresa, revenda e isolamento de dados

## Modelo

- **Organization** é o *tenant*: integrações, marketing, `ClientAccount`, projetos e configurações pertencem a uma `organizationId`.
- Cada **User** acessa o sistema via **Membership** (`userId` + `organizationId` + `role`).
- O **JWT** carrega a `organizationId` **ativa**. Todas as rotas de API filtram por esse id — um usuário nunca vê dados de outra empresa no mesmo token.

## Revenda (agência)

- Campo opcional **`Organization.parentOrganizationId`**: empresas *filhas* são clientes da agência (organização mãe).
- **Owner/admin** da mãe pode:
  - listar e criar filiais (`GET/POST /api/organization/children`);
  - **entrar no contexto da filha** com `POST /api/auth/switch-organization` (sem precisar ser membro da filha).
- Na filha, o token passa a ser só dela: integrações e métricas isoladas.

## Multi-empresa (mesmo usuário)

- Um usuário pode ter vários **Memberships**. O login usa o vínculo mais antigo por padrão.
- **Trocar empresa** no header chama `switch-organization` e renova access + refresh com a nova `organizationId`.

## Refresh token

- O refresh inclui `organizationId` para manter o contexto ao renovar sessão.

## Clientes comerciais (`ClientAccount`)

- São registros **dentro** da organização ativa (aba Clientes). Não confundir com *empresa filha* da revenda: filial = nova `Organization` isolada; cliente comercial = linha em `ClientAccount` para projetos/lançamentos.
