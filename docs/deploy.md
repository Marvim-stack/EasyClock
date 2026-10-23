# Publicar em easyclock.pro

Configuração preparada para uma única VPS Linux, com Docker Compose, disco persistente e portas TCP 80/443 livres. Nest, React e Chromium rodam no mesmo container. Caddy recebe o tráfego público, fornece HTTPS e encaminha para o Nest em localhost:3000. O Compose local continua disponível para desenvolvimento.

## Antes de publicar

Escolha o servidor e confirme onde administra o DNS do domínio. Não é necessário mudar o domínio de registrador. O endereço público do servidor será usado no registro DNS.

O agendador precisa permanecer ligado. Esta versão usa uma única instância e arquivos em `data/`; não escale para vários containers nem use disco descartável. A cobrança Stripe ainda não foi implementada: publique inicialmente para testes/uso restrito, sem oferecer assinaturas pagas. Confirme os seletores de registro do EasyMOB antes de habilitar registros reais.

## Servidor e configuração privada

No servidor com Docker e Compose instalados, obtenha o código:

```bash
git clone https://github.com/Marvim-stack/EasyClock.git
cd EasyClock
cp .env.example .env
chmod 600 .env
```

Preencha privadamente `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL` e `EASYCLOCK_CREDENTIALS_KEY`. Defina `APP_URL=https://easyclock.pro`. Preserve a mesma chave de criptografia se migrar arquivos de uma instalação existente; não gere outra chave sobre dados já criptografados. Transfira `data/` por um canal privado, com a instalação de origem parada e sem executar as duas instalações simultaneamente. Não compartilhe a senha do banco no chat ou em comandos versionados; troque a senha de banco anteriormente compartilhada antes da publicação.

As credenciais de EasyMOB serão cadastradas no painel de cada usuário. Remova do ambiente de produção as credenciais pessoais globais `EASYMOB_GROUP`, `EASYMOB_USER` e `EASYMOB_PASSWORD`. Remova também qualquer `LD_LIBRARY_PATH` que aponte para caminhos locais do WSL: a imagem já instala as bibliotecas do Chromium.

## DNS e portas

No serviço que administra o DNS, configure um registro **A**, nome **@**, com o IPv4 público do servidor. Mantenha os registros de e-mail existentes. Se houver um registro AAAA para esse nome, ele precisa apontar para o IPv6 funcional do mesmo servidor; um AAAA antigo pode impedir acesso/certificação. Não altere registros de outros serviços sem conferir o uso.

Libere TCP 80 e 443 no firewall do provedor e do servidor, preservando o acesso SSH. A porta 3000 fica em localhost. Não execute outro servidor web nas mesmas portas. Esta configuração publica somente `easyclock.pro`; `www` pode ser acrescentado depois.

## Supabase e e-mails

Em Authentication → URL Configuration, defina Site URL como `https://easyclock.pro` e autorize o redirecionamento `https://easyclock.pro/**`. Mantenha a confirmação de e-mail ligada e aplique os templates em `docs/emails/`. Configure e valide o SMTP para os destinatários que usarão o serviço. Os endereços locais podem permanecer na lista de redirecionamentos se você continuar desenvolvendo localmente.

Confirme que os dois scripts SQL de `docs/database/` já foram aplicados. O modo de produção recusa a inicialização sem as configurações obrigatórias e exige HTTPS; o painel público não pode cair acidentalmente no modo local sem autenticação.

## Subir e conferir

Execute somente após configurar servidor, DNS, Supabase e `.env`:

```bash
sudo docker compose -f compose.production.yaml config --quiet
sudo docker compose -f compose.production.yaml up -d --build
sudo docker compose -f compose.production.yaml ps
sudo docker compose -f compose.production.yaml logs --tail=80
```

Não rode também o Compose local na mesma máquina/porta. Se estiver trocando de um para o outro, pare primeiro a instalação antiga. Caddy emite e renova o certificado automaticamente quando DNS e portas estão acessíveis. O primeiro certificado pode levar algum tempo.

Abra `https://easyclock.pro` e confira cadastro, confirmação por e-mail, login, recuperação de senha, saída, configurações por conta e consulta de marcações. Use simulação para testar acesso ao EasyMOB. O healthcheck verifica apenas se o painel HTTP responde; não valida banco, SMTP ou registro de ponto.

## Operação

Preserve backups privados de `data/` junto da chave de criptografia e das variáveis necessárias. Os volumes `caddy_data` e `caddy_config` preservam os certificados. Não use `down -v` em manutenção rotineira.

Para atualizar o código:

```bash
git pull --ff-only
sudo docker compose -f compose.production.yaml up -d --build
```

As configurações de produção limitam o tamanho dos logs. O serviço reinicia após falha/boot quando o Docker estiver habilitado no servidor; um processo que continue vivo mas não saudável exige investigação pelos logs. Não há teste de capacidade para vários usuários simultâneos.

Referências: [HTTPS automático do Caddy](https://caddyserver.com/docs/automatic-https), [proxy do Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [redirecionamentos do Supabase](https://supabase.com/docs/guides/auth/redirect-urls).
