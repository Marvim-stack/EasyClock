# E-mails do EasyClock Pro

Os HTMLs usam a nova marca EasyClock Pro: símbolo de relógio, tipografia limpa e
cores vermelho/off-white. A versão PNG transparente fica em
`apps/web/public/easyclock-logo.png`; o site usa `easyclock-logo.svg` e o ícone
da aba usa `favicon.svg`. Não anunciam planos, valores ou teste gratuito. Os links usam os hashes
suportados pelo backend; não troque por um token de sessão.

No Supabase, abra **Authentication → Email Templates** e salve:

| Template | Assunto | Corpo HTML |
| --- | --- | --- |
| Confirm signup | Confirme seu acesso ao EasyClock Pro | `confirm-signup.html` |
| Reset password | Redefina sua senha no EasyClock Pro | `reset-password.html` |

Abra cada arquivo, copie o conteúdo inteiro e substitua o corpo do template.
Em **URL Configuration**, use `http://localhost:3000` como Site URL para `npm start`
(ou `http://localhost:5173` com `npm run dev`).

O HTML muda a aparência da mensagem. Para o remetente usar o nome **EasyClock Pro** e
um endereço do seu domínio, configure o SMTP do Resend no Supabase e preencha o
nome do remetente com **EasyClock Pro**. Enquanto usar o envio padrão, o endereço do
remetente continua sendo do Supabase.

A logo está em HTTPS no GitHub para aparecer mesmo com o site local. Quando o
site tiver domínio público, troque a URL da imagem nos dois HTMLs pelo endereço
da própria marca.

A publicação destes templates é manual no painel; eles não são enviados ou
aplicados automaticamente ao executar o projeto.

Referências: [templates](https://supabase.com/docs/guides/auth/auth-email-templates)
e [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
