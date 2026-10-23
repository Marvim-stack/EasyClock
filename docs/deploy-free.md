# Publicar easyclock.pro usando seu computador

Esta opção usa Cloudflare Free e Cloudflare Tunnel, sem contratar VPS nem hospedagem. O domínio continua registrado na Hostinger. O site completo, a API e a automação ficam no seu computador. O DNS passa a ser administrado na Cloudflare e o túnel publica a aplicação por HTTPS.

Quando o computador, o Docker, o WSL ou a conexão desligarem, o site fica indisponível e a automação para. Eletricidade, internet e renovação do domínio continuam por sua conta. Esta é uma instalação inicial para testes/uso restrito, sem disponibilidade garantida. A cobrança do EasyClock ainda está pendente.

## 1. Cloudflare e domínio

1. Crie uma conta em https://dash.cloudflare.com e adicione `easyclock.pro` no plano **Free**.
2. Confira os registros DNS importados. Preserve principalmente MX e TXT de e-mail, SPF, DKIM e verificações de serviços existentes. A importação automática pode não trazer tudo.
3. Copie os dois nameservers que a Cloudflare mostrar para esse domínio. Não use nameservers de exemplo.
4. Na Hostinger, abra o gerenciamento de `easyclock.pro`, procure DNS/Nameservers e substitua os nameservers pelos dois fornecidos pela Cloudflare. Essa alteração troca somente o gerenciamento de DNS, não transfere o registro do domínio. Se DNSSEC estiver ativo, siga o procedimento de migração da Cloudflare antes de trocar os nameservers para evitar falhas de resolução.
5. Espere a Cloudflare indicar que o domínio está ativo. Não há necessidade de apontar um registro A para o IP da sua casa.

## 2. Criar o túnel

No painel da Cloudflare, abra **Networking → Tunnels** (em algumas versões, fica no painel Cloudflare One, em Networks/Connectors):

1. Crie um túnel do tipo **Cloudflared**, com nome `easyclock-local`.
2. Selecione a opção de conector Docker. O painel mostrará um comando com `--token`.
3. Copie somente o valor do token para uma nova linha no `.env` privado da raiz do projeto:

   ```dotenv
   CLOUDFLARE_TUNNEL_TOKEN=SEU_TOKEN_PRIVADO
   ```

   Não envie esse token pelo chat, não o cole no Git e não execute o comando Docker avulso do painel: o Compose do projeto já inicia o conector.

4. Adicione uma rota de aplicação publicada, com domínio `easyclock.pro`, subdomínio vazio e serviço **HTTP** com endereço **127.0.0.1:3000**. Não use HTTPS para o endereço local; o HTTPS público é fornecido pela Cloudflare. Não configure Host Header/Origin Server Name para localhost: a aplicação deve continuar recebendo o domínio público.
5. Se já existir um registro A/AAAA/CNAME conflitante no nome exato `easyclock.pro`, confira sua finalidade e substitua somente esse registro pela rota do túnel. Preserve os outros registros. Não é necessário configurar `www` nesta etapa.

O destino local funciona porque o projeto usa rede do host no Docker Linux/WSL. Não abra portas no roteador. O túnel se conecta de dentro para fora. A conta Cloudflare e o token ainda precisam ser criados por você; o projeto não faz isso automaticamente.

## 3. Supabase

Mantenha as configurações já preenchidas no `.env` (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `EASYCLOCK_CREDENTIALS_KEY`). Preserve a chave de criptografia existente e os arquivos em `data/`.

No painel Supabase, em Authentication → URL Configuration:

- **Site URL:** `https://easyclock.pro`
- **Redirect URLs:** adicione `https://easyclock.pro/**`

Use os templates de e-mail em `docs/emails/` e mantenha confirmação de e-mail habilitada. O envio para usuários externos depende do SMTP configurado no Supabase. Não muda com o túnel.

Defina também no `.env`:

```dotenv
APP_URL=https://easyclock.pro
```

O Compose do túnel fixa essa mesma origem e exige autenticação em produção. Depois de publicá-lo, faça login pelo domínio HTTPS, pois os cookies serão Secure. O endereço localhost continuará servindo HTTP para diagnóstico, mas o login deve ser usado no endereço público.

Antes de publicar, troque a senha de banco anteriormente compartilhada e atualize `DATABASE_URL`. Remova credenciais pessoais globais de EasyMOB do ambiente público e qualquer `LD_LIBRARY_PATH` referente a arquivos do WSL; a imagem instala as bibliotecas necessárias. Isso não altera as credenciais já salvas e criptografadas por conta.

## 4. Subir no WSL

No Ubuntu/WSL, dentro de `~/fontes/EasyClock`, execute uma linha por vez:

```bash
sudo docker compose down
```

```bash
sudo docker compose -f compose.tunnel.yaml config --quiet
```

```bash
sudo docker compose -f compose.tunnel.yaml up -d --build
```

```bash
sudo docker compose -f compose.tunnel.yaml ps
```

```bash
sudo docker compose -f compose.tunnel.yaml logs --tail=60
```

O primeiro comando para a instalação local anterior para evitar conflito de porta. Os dados em `data/` são preservados. Não inicie simultaneamente o Compose local, de VPS e de túnel. O Compose de túnel reutiliza somente o serviço da aplicação do arquivo de produção e não inicia o Caddy. O token fica no ambiente do conector, em vez de aparecer como argumento de linha de comando.

Abra `https://easyclock.pro`. Confira também o estado Healthy do túnel no painel Cloudflare. Teste login, confirmação/recuperação de senha, isolamento das contas e consulta ao EasyMOB. Use simulação na automação. O healthcheck apenas confirma resposta HTTP do painel; não verifica SMTP, banco nem registro de ponto.

## 5. Continuar usando

- Mantenha o computador ligado, sem suspensão, com o Docker e a distribuição WSL rodando. A configuração não garante que o WSL será iniciado automaticamente após reiniciar o Windows; confira isso manualmente.
- Use uma única instância com `data/` persistente. Preserve backups privados desses dados junto da chave de criptografia.
- Para parar o acesso público e a aplicação: `sudo docker compose -f compose.tunnel.yaml down`. Não apaga `data/`.
- Para atualizar: `git pull --ff-only`, seguido de `sudo docker compose -f compose.tunnel.yaml up -d --build`.
- Se o computador cair, as execuções perdidas não são recuperadas depois. O site e a automação ficam indisponíveis durante a queda.

Referências: [criar um túnel e publicar a aplicação](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/), [nameservers](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/), [token por variável de ambiente](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/), [Hostinger: mudar nameservers](https://www.hostinger.com/support/1696789-how-to-change-nameservers-at-hostinger/).
