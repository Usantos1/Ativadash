# Modelo: usuário e empresa (organização)

No Ativa Dash, **cada usuário autenticado está sempre associado a uma empresa** via a tabela **`Membership`** (N:N entre `User` e `Organization`).

## Regras

1. **Cadastro (`POST /api/auth/register`)**  
   - Cria um registro em **`Organization`** (nome da empresa informado ou padrão).  
   - Cria o **`User`**.  
   - Cria **`Membership`** com papel `owner`, ligando usuário ↔ empresa.

2. **Login (`POST /api/auth/login`)**  
   - Só conclui se existir pelo menos um **`Membership`** para o usuário.  
   - Caso contrário: *"Usuário sem organização vinculada"*.  
   - O token JWT carrega `organizationId` da empresa usada na sessão (hoje: primeira membership por data de criação).

3. **Sessão (`GET /api/auth/me`)**  
   - Confirma que o `userId` do JWT ainda possui **`Membership`** com o `organizationId` do JWT.  
   - Retorna nome da empresa para exibição no app.

4. **Dados de negócio** (integrações, marketing, dashboards, etc.)  
   - Continuam escopados por **`organizationId`**, não por usuário isolado.

## Múltiplas empresas por usuário

O schema permite **várias** linhas em `Membership` para o mesmo `userId`. A API atual escolhe a primeira (ordem de criação) no login/refresh. Um fluxo futuro de **“trocar empresa”** pode emitir novo JWT com outro `organizationId`.

## Cadastro no front

Rota **`/register`**: campo **Empresa** obrigatório, enviado como `organizationName` para a API.
