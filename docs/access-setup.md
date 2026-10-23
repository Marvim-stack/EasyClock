# Acesso com Supabase Free

A página inicial `/` abre o login. Também existe `/acesso.html` para os mesmos
fluxos. As telas têm formulários e rotas de login, cadastro, confirmação de
email, recuperação, redefinição, conta, assinatura, horários e administração.
Não há perfis de exemplo, atalhos de admin, cobranças simuladas ou armazenamento
de senhas no navegador.

## O que está preparado

- `apps/web/src/access/main.tsx`: telas, navegação, estados de envio, erros e respostas.
- `apps/web/src/access/api.ts`: cliente dos contratos HTTP, na mesma origem, com
  credenciais de sessão enviadas por cookie; nenhum token vai para localStorage.
- `apps/api/src/access.controller.ts`: cadastro, login, confirmação, reenvio,
  recuperação, redefinição e logout integrados ao Supabase. Validação no servidor
  e proteção contra CSRF por cabeçalho obrigatório e conferência da origem.
- `apps/api/src/supabase-access.ts`: cliente oficial por requisição, cookies
  HttpOnly/SameSite=Lax/Secure em HTTPS, renovação de sessão e consultas com RLS.
  A identidade é validada pelo provedor e a permissão vem do perfil no banco;
  metadados enviados pelo usuário nunca concedem administração.
- `apps/api/src/clock.controller.ts`, `clocks.ts` e `clock.ts`: painel completo por
  usuário, com conexão/configuração gratuitas e automação protegida no servidor.
- `apps/api/src/account-database.ts`: consultas administrativas e de permissão
  usando o Session pooler, com TLS e certificado público oficial do Supabase.
- `apps/api/src/accounts.ts`: tipos de usuário, permissões, configuração e assinatura;
  regra de acesso por e-mail verificado, proprietário da assinatura e vencimento.
- `docs/database/001_accounts.sql` e `002_auth_profiles.sql`: tabelas, isolamento
  e criação automática de perfil/configurações no cadastro. Aplicar no Supabase.
- `.env.example`: variáveis que deverão ser preenchidas privadamente no servidor.

Abrir o login não verifica provedores ou exibe avisos de configuração. O serviço
indisponível só é informado após uma operação que precisa da integração. Entradas
como e-mail inválido, senha com menos de seis caracteres ou confirmação divergente
são rejeitadas pelo backend. O frontend mantém apenas campos obrigatórios, tipos
básicos de entrada e limites máximos de tamanho.

## Primeiro passo: conectar sem contratar nada

1. Acesse <https://supabase.com/dashboard>, crie uma conta e um projeto no plano
   **Free**. Escolha uma senha de banco nova e guarde-a privadamente.
2. No **SQL Editor**, execute primeiro `docs/database/001_accounts.sql` e depois
   `docs/database/002_auth_profiles.sql`. São instalações únicas, nesta ordem.
3. Em **Connect** / **API Keys**, copie a **Project URL** e a **Publishable key**
   (a chave `anon` antiga também funciona). Preencha no `.env` da raiz, preservando
   as configurações existentes:

   ```dotenv
   APP_URL=http://localhost:3000
   SUPABASE_URL=https://SEU-PROJETO.supabase.co
   SUPABASE_PUBLISHABLE_KEY=SUA-CHAVE-PUBLICA
   ```

   Login usa URL e chave pública. Para a administração e as permissões da automação,
   preencha também `DATABASE_URL` com a conexão **Session pooler** mostrada em
   **Connect**. A senha deve estar percent-encoded na URL. A chave `service_role`
   não é necessária.
   Configure `EASYCLOCK_CREDENTIALS_KEY` com 32 bytes aleatórios em base64 e preserve
   essa chave. Ela protege os arquivos operacionais de cada conta em `data/accounts/`.
   Se usar `npm run dev`, troque `APP_URL` para `http://localhost:5173`.
4. Em **Authentication**, habilite o provedor Email, mantenha **Confirm email**
   ligado e configure a senha mínima em **6 caracteres**. Em **URL Configuration**,
   use o mesmo endereço de `APP_URL` como **Site URL** e autorize os endereços de
   desenvolvimento que utilizar (`http://localhost:3000/**`, `http://localhost:5173/**`).
5. Em **Email Templates**, use os [HTMLs com a identidade da marca](emails/README.md).
   Ajuste os links para a aplicação receber o hash de
   uso único, sem tokens de sessão na URL. Template **Confirm signup**:

   ```html
   <a href="{{ .SiteURL }}/#confirmar-email?token={{ .TokenHash }}">Confirmar meu e-mail</a>
   ```

   Template **Reset password**:

   ```html
   <a href="{{ .SiteURL }}/#nova-senha?token={{ .TokenHash }}">Redefinir minha senha</a>
   ```

6. Execute `npm ci`, `npm run build` e `npm start`. Cadastre uma conta, abra o
   e-mail e confirme; depois entre com e-mail/senha. Recarregue `/#conta` para
   conferir a sessão, teste **Sair** e **Esqueci minha senha**.

O e-mail padrão do Supabase permite testes apenas com endereços dos membros da
organização, com limite atual de dois envios por hora. Para outras pessoas,
configure o SMTP do **Resend Free** no Supabase e verifique um domínio de envio.
Não desative a confirmação para contornar essa etapa.

O Free pode pausar após uma semana sem atividade. Ele serve para começar; a
capacidade do servidor da automação será medida antes de abrir para vários usuários.

Referências: [clientes oficiais e cookies](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[templates de e-mail](https://supabase.com/docs/guides/auth/auth-email-templates),
[restrições do SMTP padrão](https://supabase.com/docs/guides/auth/auth-smtp),
[plano Free](https://supabase.com/pricing).

## Sua conta administradora

Cadastre e confirme seu e-mail normalmente. Depois, no **SQL Editor**, execute:

```sql
update public.account_profiles set role = 'admin'
where id = (select id from auth.users
  where lower(email) = 'braescherm@gmail.com' and email_confirmed_at is not null);
```

Nenhuma senha padrão é definida no código. O SQL promove apenas a conta já
verificada; se ela não existir, não altera ninguém. Reabra `/#conta` para ler a
permissão atualizada. A área **Admin** lista os usuários cadastrados; a automação
do administrador funciona sem assinatura, mantendo a exigência de e-mail verificado.

## Contratos HTTP

Todos os caminhos abaixo usam o prefixo `/api/access`.
As mutações exigem o cabeçalho `X-EasyClock-Request: 1`. O cliente web já o envia.
Os endpoints de cobrança continuam pendentes (503).

| Método | Caminho | Resposta esperada após integração |
| --- | --- | --- |
| GET | `/session` | `{ user }`, ou 401 sem sessão |
| POST | `/login` | `{ user }` e cookie de sessão |
| POST | `/register` | `{ email }`, após criação real do usuário |
| POST | `/email/confirm` | 204, após validar o token |
| POST | `/email/resend` | 204, após encaminhar a solicitação ao provedor |
| POST | `/password/forgot` | 204, sem revelar se o e-mail existe |
| POST | `/password/reset` | 204, após validar token e atualizar senha |
| POST | `/logout` | 204 e invalidação da sessão |
| GET | `/subscription` | `{ subscription }`, podendo ser null |
| GET | `/admin/users` | `{ users }`, somente para administrador |
| POST | `/billing/checkout` | `{ url }`, checkout HTTPS do gateway |
| POST | `/billing/portal` | `{ url }`, portal HTTPS da assinatura |

Login recebe `email` e `password`. Cadastro recebe `name`, `email`, `password` e
`confirmation`; nunca aceita escolha de papel administrativo. Redefinição recebe
`password`, `confirmation` e `token`. Confirmação recebe `token`; reenvio e
recuperação recebem `email`. As operações protegidas devem descobrir o usuário
pela sessão validada, nunca por um `userId` informado pelo cliente.

Os templates de confirmação e recuperação devem apontar respectivamente para
`APP_URL/#confirmar-email?token=...` e `APP_URL/#nova-senha?token=...`. Os tokens
precisam de expiração e uso único no provedor/backend. A confirmação bem-sucedida
remove o token da URL. Não registrar tokens, senhas ou cookies nos logs.

## Painel disponível sem assinatura

As rotas `/api/settings`, `/api/connect`, `/api/status`, `/api/history` e
`/api/punches` usam a mesma sessão do login. Configurações e teste de conexão
não exigem assinatura. `/api/toggle` verifica a assinatura para ativar a automação;
pausar continua permitido. A permissão também é conferida em cada execução
agendada e imediatamente antes de um clique real. Admin dispensa assinatura.

O cookie tem escopo `/api`; cookies antigos em `/api/access` são removidos na
próxima atualização de sessão. As mutações do painel também exigem o cabeçalho
de proteção e conferência de origem. Enviar apenas `X-EasyClock: local` não
libera acesso quando o Supabase está configurado.

Para manter esta primeira versão simples, horários, cache e execuções ficam em
arquivos por usuário no disco persistente do servidor; as configurações com
credenciais usam AES-256-GCM. O banco guarda identidades, perfis e assinaturas.
As tabelas operacionais do SQL inicial ficam reservadas para futura migração.
Não executar várias instâncias nem usar hospedagem com disco descartável.

## Contas que você pode criar agora

1. **Supabase Free**: criar uma conta e um projeto. Para esta etapa, usar apenas
   URL e chave pública, conforme o passo a passo acima.
2. **Resend**: criar a conta. Quando escolher o domínio, verificar os registros DNS
   de envio e configurar o SMTP no Supabase para confirmação e recuperação.
3. **Stripe**: criar a conta e usar o ambiente de testes. Definir o valor mensal e
   criar produto/preço recorrente. Guardar chave secreta, identificador do preço e,
   quando o endpoint existir, segredo de assinatura do webhook.
4. **Domínio**: escolher/comprar quando estiver pronto para publicar. É usado tanto
   pelo site quanto pelo envio de e-mail. O desenvolvimento pode continuar antes disso.

Nenhuma dessas contas é criada ou conectada automaticamente pelo código.
Não envie chaves secretas ou senhas pelo chat e não as coloque em arquivos versionados.

## Próximas etapas, depois de testar o login

1. Aplicar e validar a estrutura SQL em um projeto Supabase de teste. Ela exige o esquema
   `auth` e os papéis `anon` e `authenticated` do Supabase.
2. Validar cadastro, confirmação, recuperação, renovação e logout no projeto real.
   Os testes automatizados verificam o SDK e os contratos com respostas controladas,
   sem criar projetos, enviar e-mail ou executar SQL. Logout revoga a renovação;
   um JWT copiado pode continuar válido até expirar, conforme o modelo do Supabase.
3. Promover a conta administradora pelo SQL acima. Habilitar MFA antes de usar a
   administração em produção.
4. Integrar confirmação e recuperação com o SMTP verificado. Nenhuma tela deve
   declarar envio, confirmação ou troca de senha antes da resposta real do provedor.
5. Criar Checkout e portal de assinatura. O cartão vai ao gateway; não armazenar
   número ou CVV. O teste de sete dias começa apenas após evento confirmado do
   gateway, nunca por clique ou datas enviadas pelo navegador.
6. Implementar webhooks assinados e idempotentes, reconciliação, cancelamento e
   tratamento de pagamento recusado. Atualizar acesso e agendamento no servidor.
7. Antes de escalar para múltiplas instâncias, migrar os arquivos operacionais para
   o banco, com coordenação entre workers. No piloto, preservar `data/` e a chave de
   criptografia junto aos backups. Não há teste de capacidade para múltiplos browsers.

As tabelas têm RLS e não concedem escrita de papéis, assinaturas, eventos de cobrança
ou credenciais ao cliente. A chave de serviço ignora RLS: consultas do backend também
precisam conferir o proprietário. As permissões da interface não substituem essas verificações.

## Executar e validar

```bash
npm ci
npm run build
npm start
```

Login: `http://localhost:3000/`. Desenvolvimento: `npm run dev`, porta 5173.
O painel antigo continua em `/painel-local.html`; com Supabase configurado, usa
a mesma sessão e o mesmo isolamento de dados das contas. Sem Supabase, permanece
o modo pessoal local. O provisionamento de cobrança e SMTP ainda precisa ser concluído.

`npm test` e `npm run build` não exigem banco, SMTP ou pagamento. Os testes HTTP
usam somente servidores locais temporários e diretório descartável. Sem URL/chave,
o acesso continua retornando HTTP 503, sem usuários ou sessões fictícias. Cobrança
ainda retorna 503. Nenhuma assinatura começa automaticamente ao criar a conta.
