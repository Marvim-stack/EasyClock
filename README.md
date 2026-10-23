# EasyClock

Para publicar em **easyclock.pro**, veja o [guia de publicação em VPS com HTTPS](docs/deploy.md).
A configuração está em `compose.production.yaml`; o Compose padrão continua sendo local.

## Login e usuários

A página inicial `/` (também em `/acesso.html`) abre as telas de login e cadastro.
Cadastro, login, confirmação de e-mail e recuperação de senha usam Supabase Auth.
A sessão fica em cookie HttpOnly, renovado pelo servidor; não há contas fictícias.
Para começar, crie um projeto Supabase Free e configure o `.env` conforme o guia.
Veja o passo a passo abaixo; nenhum banco precisa rodar no seu computador.
O painel completo abre após o login: horários, configurações, conexão e histórico.
Sem assinatura, é possível configurar e testar a conexão; os controles de automação
ficam desabilitados. Admin tem acesso completo, incluindo a listagem de usuários.
Cobrança ainda depende da integração com o Stripe.
O painel antigo permanece em `/painel-local.html` e, com Supabase configurado,
usa a mesma sessão e os dados da conta autenticada.
Veja [como conectar o projeto gratuito e testar o login](docs/access-setup.md).

React + NestJS + Playwright para registrar ponto às **09:00, 12:00, 13:00 e 18:20**, no fuso **America/Sao_Paulo**. Começa pausado, em simulação e configurado para segunda a sexta.

## Rodar

Requer Node.js 22+ e dependências Linux do Chromium, ou Docker Compose.

```bash
# Se ainda não tiver .env: copie .env.example para .env e preencha as credenciais.
npm ci
npx playwright install --with-deps chromium
npm run dev
```

Abra http://localhost:5173 para o login; o painel local fica em http://localhost:5173/painel-local.html. A API fica em http://localhost:3000. As credenciais fornecidas foram gravadas somente no `.env` local, ignorado pelo Git. Não publique esse arquivo.

Para produção:

```bash
npm run build
npm start
```

O login fica em http://localhost:3000 e o painel local antigo em http://localhost:3000/painel-local.html. Execução contínua em Linux:

```bash
docker compose up -d --build
docker compose logs -f
```

O Compose usa rede do host Linux para manter o painel no localhost. Com Supabase
configurado, as APIs do painel exigem sessão. Sem Supabase, o modo local continua
restrito ao uso pessoal no localhost.

## Contas e permissões

Cada conta vê seus próprios horários, conexão e histórico. Sem assinatura, o painel
fica visível e permite salvar configurações e verificar o EasyMOB sem marcar ponto.
Assinatura em teste/ativa ou papel admin habilita a automação. O servidor consulta
o banco para ativar, executar o agendamento e confirmar permissão antes do clique;
vencimento ou indisponibilidade do banco impedem novos registros.

Os dados operacionais ficam em `data/accounts/<id>/`; configurações e credenciais
são criptografadas com `EASYCLOCK_CREDENTIALS_KEY`. Preserve o diretório e essa
chave ao trocar de computador/servidor. O agendador usa uma única instância com
disco persistente. A autenticação e as assinaturas ficam no Supabase.

As páginas públicas não anunciam o teste de sete dias; as condições aparecem na
área de assinatura, antes de cadastrar cartão. Após enviar confirmação/recuperação,
o destinatário aparece como texto e o reenvio mantém o mesmo endereço.
Os [e-mails com a identidade da marca](docs/emails/README.md) estão prontos para
colar no painel Supabase.

## Configurar e ativar

1. Abra **Configurações**, informe grupo, usuário e senha e clique em **Conectar**. O sistema confirma o acesso à área autenticada do EasyMOB, sem registrar ponto. O indicador “Conectado ao EasyMOB” exibe a data da última verificação de credenciais, salva entre reinícios. Não representa uma sessão de navegador aberta. Trocar as credenciais ou falhar em uma nova verificação remove a indicação. Conectar nunca registra ponto.
2. Confira o fluxo de ponto da sua conta no navegador. O HTML público do login foi verificado; o fluxo autenticado ainda precisa de validação. O botão padrão usa função de botão e texto “Registrar ponto”/“Registar ponto”. Se necessário, configure `EASYMOB_BUTTON_SELECTOR` com um seletor CSS exclusivo.
3. Configure `EASYMOB_SUCCESS_SELECTOR` com um seletor CSS de confirmação que apareça somente após registrar. Sem ele, o modo real não clica. Caso o fluxo tenha localização, CAPTCHA ou confirmação adicional, adapte `apps/api/src/browser.ts`. O programa não contorna essas etapas nem inventa localização.
4. Em **Configurações**, desmarque a simulação e salve. Na página **Horários**, clique em **Ativar marcações automáticas**. Confira antes os seletores e a jornada efetivamente trabalhada.

Os dias ativos são definidos por `WORK_DAYS=Mon,Tue,Wed,Thu,Fri`. Configure férias, folgas e feriados em `EXCLUDED_DATES=2026-12-25,2027-01-01`. Não há calendário automático de feriados. Reinicie ao mudar o `.env`.

O computador deve permanecer ligado, conectado e sem suspensão, com o servidor executando. O painel pode ficar fechado. O relógio é consultado a cada cinco segundos; só há disparos dentro do minuto previsto, sem recuperação de horários perdidos. Use apenas para horários correspondentes à jornada efetivamente trabalhada.

## Histórico e falhas

O botão **Ativar marcações automáticas** / **Pausar marcações automáticas** controla o agendamento imediatamente, separado do formulário de horários. O estado ligado/desligado fica salvo em `data/state.json`, fora do Git, e é restaurado após recarregar a página ou reiniciar o servidor. Salvar horários e preferências preserva esse estado; trocar credenciais ou migrar uma rotina antiga pausa o agendamento. Cada horário é salvo antes de abrir o navegador e não recebe nova tentativa automática, inclusive se falhar. Após clique sem confirmação, o status será **incerto**: confira diretamente no EasyMOB. Após interrupção abrupta, estados **iniciando** ou **enviado** também exigem conferência.

Execute uma instância com o mesmo diretório de dados. `data/instance.lock` usa a trava de sistema `flock` (pacote Linux `util-linux`). O arquivo pode permanecer no disco: a trava é liberada automaticamente quando o processo termina, inclusive após interrupção abrupta. Não remova o arquivo enquanto uma instância estiver rodando. Preserve o histórico do dia: ele evita disparos duplicados. Estado corrompido exige intervenção, sem recuperação que descarte silenciosamente o histórico.

## Validação

```bash
npm test
npm run build
```

Os testes verificam horários, fuso, fins de semana e datas excluídas. Não registram ponto real. A integração autenticada precisa ser conferida no ambiente de uso.

## Configurações pelo painel

A página **Horários** mostra somente quatro marcações recorrentes editáveis: entrada, almoço, volta do almoço e saída, além dos dias da semana, ativação e últimas marcações consultadas no portal. Não há extras nem datas específicas. Os quatro horários devem estar em ordem, no mesmo dia. Configurações antigas são adaptadas aos quatro tipos recorrentes e o agendamento é pausado para revisão; o histórico é preservado.

**Configurações** reúne credenciais, simulação, folgas, localização e a jornada mínima da humanização. O botão **Humanizar marcações** fica na primeira página: verde quando ligado, vermelho quando desligado. A mudança é salva imediatamente, sem salvar outras edições pendentes. Com a humanização ligada, o sistema sorteia atrasos entre zero e dez minutos para cada marcação, mantendo a ordem e uma jornada mínima planejada (oito horas por padrão). Se a jornada não couber nessa margem, o salvamento é rejeitado com orientação para ajustar os horários ou a jornada. Os horários sorteados aparecem nos cartões do painel e ficam em `data/daily-plan.json`, persistindo após reinícios. Um novo dia ou alteração dos horários/jornada gera outro plano. O relógio considera apenas os minutos previstos: não recupera horários perdidos e não garante a duração real diante de falhas ou atrasos do portal.

Depois do primeiro salvamento, `data/settings.json` passa a ter prioridade sobre as credenciais, calendário e modo do `.env`. O arquivo tem permissão 600 e não entra no Git. Deixar a senha vazia no formulário mantém a senha anterior para a mesma conta; trocar grupo ou usuário exige informar a senha; a API nunca devolve a senha salva. Trocar grupo ou usuário pausa o agendamento e limpa o cache de marcações. O histórico de execuções local é preservado.

**Execuções** é uma página separada com paginação. O painel consulta dados autenticados do EasyMOB e mostra as primeiras dez linhas da tabela retornada, mantendo a última consulta em disco. Não transforma execuções em comprovantes de ponto. Se uma consulta falhar, o cache anterior é mantido com sua data original.

Por padrão, a consulta abre o botão `#btnConsultar` e lê a tabela em `#ModalConsultasMarcacoes`. Opcionalmente, configure `EASYMOB_PUNCHES_URL` (mesmo domínio do EasyMOB) e `EASYMOB_PUNCHES_SELECTOR` (seletor de tabela). Esses seletores ainda precisam ser conferidos na área autenticada da conta. A consulta traz as linhas presentes nessa tabela; não navega por páginas ou períodos adicionais do portal.

Para selecionar efetivamente um tipo no portal, configure `EASYMOB_TYPE_SELECTOR` para o elemento `select` e `EASYMOB_TYPE_VALUES` com os valores reais das opções, por exemplo um objeto com chaves `entrada`, `saida_almoco`, `retorno_almoco`, `saida`. Não invente valores: confira os existentes no portal. Sem mapeamento, os tipos servem como rótulos locais e o portal determina a marcação. O teste de login não comprova o tipo nem o sucesso de um registro real.

A consulta de localização usa a permissão do navegador e exibe a posição real, precisão e instante de captura, apenas na sessão atual. Não altera a localização do Chromium no servidor. A variação diária altera somente o planejamento dos horários e não modifica localização nem registros já realizados.

Após atualizar o código, reconstrua o container:

```bash
sudo docker compose up -d --build
```
