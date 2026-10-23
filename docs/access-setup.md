# Acesso e assinatura — configuração pendente

A página inicial `/` abre o login. Também existe `/acesso.html` para os mesmos
fluxos. As telas têm formulários e rotas de login, cadastro, confirmação de
email, recuperação, redefinição, conta, assinatura, horários e administração.
Não há perfis de exemplo, atalhos de admin, cobranças simuladas ou armazenamento
de senhas no navegador.

## O que está preparado

- `apps/web/src/access/main.tsx`: telas, navegação, estados de envio, erros e respostas.
- `apps/web/src/access/api.ts`: cliente dos contratos HTTP, na mesma origem, com
  credenciais de sessão enviadas por cookie; nenhum token vai para localStorage.
- `apps/api/src/access.controller.ts`: endpoints com validação de entrada. Até a
  integração, devolvem HTTP 503 para impedir qualquer sucesso ou acesso fictício.
- `apps/api/src/accounts.ts`: tipos de usuário, permissões, configuração e assinatura;
  regra de acesso por e-mail verificado, proprietário da assinatura e vencimento.
- `docs/database/001_accounts.sql`: tabelas e políticas de isolamento para aplicar
  em um projeto Supabase. Não foi aplicado ou conectado a nenhum banco.
- `.env.example`: variáveis que deverão ser preenchidas privadamente no servidor.

Abrir o login não verifica provedores ou exibe avisos de configuração. O serviço
indisponível só é informado após uma operação que precisa da integração. Entradas
como e-mail inválido, senha com menos de seis caracteres ou confirmação divergente
são rejeitadas pelo backend. O frontend mantém apenas campos obrigatórios, tipos
básicos de entrada e limites máximos de tamanho.

## Contratos HTTP

Todos os caminhos abaixo usam o prefixo `/api/access`.

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
| GET | `/settings` | `{ settings }`, podendo ser null |
| GET | `/admin/users` | `{ users }`, somente para administrador |
| POST | `/billing/checkout` | `{ url }`, checkout HTTPS do gateway |
| POST | `/billing/portal` | `{ url }`, portal HTTPS da assinatura |

Login recebe `email` e `password`. Cadastro recebe `name`, `email`, `password` e
`confirmation`; nunca aceita escolha de papel administrativo. Redefinição recebe
`password`, `confirmation` e `token`. Confirmação recebe `token`; reenvio e
recuperação recebem `email`. As operações protegidas devem descobrir o usuário
pela sessão validada, nunca por um `userId` informado pelo cliente.

Links de confirmação e recuperação devem apontar respectivamente para
`APP_URL/#confirmar-email?token=...` e `APP_URL/#nova-senha?token=...`. Os tokens
precisam de expiração e uso único no provedor/backend. A confirmação bem-sucedida
remove o token da URL. Não registrar tokens, senhas ou cookies nos logs.

## Contas que você pode criar agora

1. **Supabase**: criar uma conta e um projeto. Guardar URL, chave pública e chave de
   serviço. A chave de serviço e a conexão do banco ficam somente no `.env` privado.
2. **Resend**: criar a conta. Quando escolher o domínio, verificar os registros DNS
   de envio e configurar o SMTP no Supabase para confirmação e recuperação.
3. **Stripe**: criar a conta e usar o ambiente de testes. Definir o valor mensal e
   criar produto/preço recorrente. Guardar chave secreta, identificador do preço e,
   quando o endpoint existir, segredo de assinatura do webhook.
4. **Domínio**: escolher/comprar quando estiver pronto para publicar. É usado tanto
   pelo site quanto pelo envio de e-mail. O desenvolvimento pode continuar antes disso.

Nenhuma dessas contas é criada ou conectada automaticamente pelo código.
Não envie chaves secretas ou senhas pelo chat e não as coloque em arquivos versionados.

## Integração a concluir no computador pessoal

1. Aplicar a estrutura SQL em um projeto Supabase de teste. Ela exige o esquema
   `auth` e os papéis `anon` e `authenticated` do Supabase.
2. Implementar o login do provedor nos contratos existentes, com sessões de cookie
   HttpOnly, Secure em produção, política SameSite e proteção contra CSRF nas mutações.
   Restaurar sessão por `/session`, renovar expiração e invalidar ao sair.
3. Criar perfis com papel `user` definido no servidor. Provisionar o administrador
   por convite usando `APP_ADMIN_EMAIL`, sem senha padrão no código, e habilitar MFA.
4. Integrar confirmação e recuperação com o SMTP verificado. Nenhuma tela deve
   declarar envio, confirmação ou troca de senha antes da resposta real do provedor.
5. Criar Checkout e portal de assinatura. O cartão vai ao gateway; não armazenar
   número ou CVV. O teste de sete dias começa apenas após evento confirmado do
   gateway, nunca por clique ou datas enviadas pelo navegador.
6. Implementar webhooks assinados e idempotentes, reconciliação, cancelamento e
   tratamento de pagamento recusado. Atualizar acesso e agendamento no servidor.
7. Migrar configurações e histórico para dados por usuário, criptografar as credenciais
   do EasyMOB e validar proprietário e assinatura em toda execução agendada.

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
O painel local antigo continua em `/painel-local.html`, com a API local já existente;
essa parte ainda não foi migrada para autenticação multiusuário. Não publicar como
serviço multiusuário antes de concluir as proteções acima.

`npm test` e `npm run build` não exigem banco, SMTP ou pagamento. Os testes HTTP
usam somente servidor local temporário e diretório descartável. Até integrar os
provedores, não existe conta válida, sessão, confirmação de e-mail ou cobrança ativa.
