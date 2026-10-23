# Primeira publicação: VPS + Docker + HTTPS

O piloto usa uma VPS para site/API/Chromium, Supabase Free para autenticação e
banco e um subdomínio gratuito do DuckDNS. Cobrança e personalização dos e-mails
podem continuar pendentes. O cadastro de outras pessoas depende do envio de
e-mails; primeiro teste com sua conta admin já confirmada.

## 1. Criar o servidor

No [Hetzner Cloud](https://console.hetzner.com/), crie uma VPS:

- Ubuntu **24.04**, arquitetura **x86/amd64**.
- **4 GB de RAM**, 2 vCPUs e pelo menos 40 GB de disco para este primeiro piloto.
- IPv4 público e sua chave pública SSH cadastrada.
- Um exemplo de plano é o **CX23**, se disponível na localização escolhida.

Esse tamanho é um ponto de partida; a capacidade com vários navegadores ainda
precisa ser medida. Confira o preço no resumo antes de contratar. O servidor é
cobrado enquanto existir, mesmo desligado.

No firewall do provedor, permita TCP **80 e 443** e acesso SSH na **22** a partir
do seu IP. A porta 3000 fica apenas no localhost; não abra essa porta na internet.

## 2. Criar o endereço gratuito

Em [DuckDNS](https://www.duckdns.org/), entre e escolha um nome disponível, por
exemplo `easyclock-seunome.duckdns.org`. Aponte o IPv4 desse nome para o **IP da
VPS**, não para o IP do seu computador. Aguarde a resolução do DNS.

O Caddy vai emitir e renovar o certificado HTTPS automaticamente quando o nome
apontar para a VPS e as portas 80/443 estiverem acessíveis. O token do DuckDNS
não precisa ser enviado nem configurado no EasyClock para um IP fixo.

## 3. Instalar Docker no servidor

No seu computador, conecte-se (substitua `IP_DA_VPS`):

```bash
ssh root@IP_DA_VPS
```

Na VPS Ubuntu 24.04, instale pelo repositório oficial do Docker:

```bash
apt-get update
apt-get install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<'EOF'
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
docker compose version
```

## 4. Baixar o código e levar a configuração privada

Ainda na VPS:

```bash
git clone --branch feat/saas-access-shell --single-branch https://github.com/Marvim-stack/EasyClock.git /opt/easyclock
```

Antes de transferir os dados, **pause as marcações no painel e pare a instância
local**. Execute os comandos seguintes no computador que tem seu `.env` e `data/`,
a partir da pasta do projeto:

```bash
scp .env root@IP_DA_VPS:/opt/easyclock/.env
scp -r data root@IP_DA_VPS:/opt/easyclock/
```

Não execute a automação simultaneamente nos dois computadores. A trava do
programa protege uma única pasta no mesmo servidor; ela não coordena duas VPS.

## 5. Ajustar o endereço da aplicação

Na VPS:

```bash
cd /opt/easyclock
chmod 600 .env
nano .env
```

Troque apenas o endereço da aplicação pelo seu nome real, sem barra final:

```dotenv
APP_URL=https://easyclock-seunome.duckdns.org
```

Preserve `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL` (Session
pooler) e **a mesma `EASYCLOCK_CREDENTIALS_KEY`**. Gerar outra chave impede ler os
arquivos criptografados existentes. Nenhum banco é instalado na VPS.

No Supabase → **Authentication → URL Configuration**, defina:

- **Site URL:** o mesmo endereço HTTPS do `APP_URL`.
- **Redirect URLs:** esse endereço seguido de `/**`.

Pode manter os endereços locais autorizados para desenvolver depois. Os HTMLs
personalizados continuam opcionais; para testar o admin já confirmado, use o
login normal. O remetente padrão do Supabase continua restrito à equipe do projeto.

## 6. Publicar

Na pasta `/opt/easyclock`, na VPS:

```bash
docker compose -f compose.yaml -f compose.production.yaml config --quiet
docker compose -f compose.yaml -f compose.production.yaml up -d --build
docker compose -f compose.yaml -f compose.production.yaml ps
docker compose -f compose.yaml -f compose.production.yaml logs --tail=100
```

O primeiro build baixa o Chromium e pode demorar alguns minutos. Abra o endereço
HTTPS, entre como admin e use **Conectar sem marcar ponto**. Confira a sessão e
o estado salvo antes de ativar a automação. Fechar seu computador não encerra a VPS.

O arquivo de produção mantém a API em `127.0.0.1:3000`, define modo de produção,
usa o diretório persistente e adiciona o Caddy. O Caddy recebe somente `APP_URL`,
sem as senhas do banco ou a chave de criptografia. Certificados ficam em volumes
persistentes do Docker. A inicialização recusa configuração de produção incompleta
ou endereço público sem HTTPS, para impedir publicação acidental do modo pessoal.

## Atualizar e guardar os dados

Para atualizar, na VPS e na mesma pasta:

```bash
git pull --ff-only
docker compose -f compose.yaml -f compose.production.yaml up -d --build
```

Mantenha uma cópia privada do `.env` e de `data/` fora da VPS. Para copiar dados
consistentes, pause as marcações e pare a aplicação durante o backup. O disco
persiste em reinícios, mas não substitui um backup.

Os arquivos de deploy foram preparados para este fluxo. A emissão do certificado,
o DNS, a conexão com o EasyMOB a partir do datacenter e a capacidade com vários
usuários precisam ser validados na VPS real.

Fontes: [Docker no Ubuntu](https://docs.docker.com/engine/install/ubuntu/),
[Caddy com Docker Compose](https://caddyserver.com/docs/running#docker-compose),
[HTTPS automático](https://caddyserver.com/docs/automatic-https),
[DuckDNS](https://www.duckdns.org/about.jsp),
[tipos de servidor Hetzner](https://www.hetzner.com/cloud/).
