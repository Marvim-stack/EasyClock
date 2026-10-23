# EasyClock

React + NestJS + Playwright para registrar ponto às **09:00, 12:00, 13:00 e 18:20**, no fuso **America/Sao_Paulo**. Começa pausado, em simulação e configurado para segunda a sexta.

## Rodar

Requer Node.js 22+ e dependências Linux do Chromium, ou Docker Compose.

```bash
# Se ainda não tiver .env: copie .env.example para .env e preencha as credenciais.
npm ci
npx playwright install --with-deps chromium
npm run dev
```

Abra http://localhost:5173. A API fica em http://localhost:3000. As credenciais fornecidas foram gravadas somente no `.env` local, ignorado pelo Git. Não publique esse arquivo.

Para produção:

```bash
npm run build
npm start
```

O painel fica em http://localhost:3000. Execução contínua em Linux:

```bash
docker compose up -d --build
docker compose logs -f
```

O Compose usa rede do host Linux para manter o painel no localhost. A API local não tem autenticação; não a exponha à internet.

## Configurar e ativar

1. Com `DRY_RUN=true`, clique em **Testar login sem registrar**. O teste autentica e procura o botão, sem clicar.
2. Confira o fluxo de ponto da sua conta no navegador. O HTML público do login foi verificado; o fluxo autenticado ainda precisa de validação. O botão padrão usa função de botão e texto “Registrar ponto”/“Registar ponto”. Se necessário, configure `EASYMOB_BUTTON_SELECTOR` com um seletor CSS exclusivo.
3. Configure `EASYMOB_SUCCESS_SELECTOR` com um seletor CSS de confirmação que apareça somente após registrar. Sem ele, o modo real não clica. Caso o fluxo tenha localização, CAPTCHA ou confirmação adicional, adapte `apps/api/src/browser.ts`. O programa não contorna essas etapas nem inventa localização.
4. Defina `DRY_RUN=false`, reinicie e clique em **Ativar agendamento**. No Docker, aplique o novo ambiente com `docker compose up -d --force-recreate`.

Os dias ativos são definidos por `WORK_DAYS=Mon,Tue,Wed,Thu,Fri`. Configure férias, folgas e feriados em `EXCLUDED_DATES=2026-12-25,2027-01-01`. Não há calendário automático de feriados. Reinicie ao mudar o `.env`.

O computador deve permanecer ligado, conectado e sem suspensão, com o servidor executando. O painel pode ficar fechado. O relógio é consultado a cada cinco segundos; só há disparos dentro do minuto previsto, sem recuperação de horários perdidos. Use apenas para horários correspondentes à jornada efetivamente trabalhada.

## Histórico e falhas

O estado fica em `data/state.json`, fora do Git. Cada horário é salvo antes de abrir o navegador e não recebe nova tentativa automática, inclusive se falhar. Após clique sem confirmação, o status será **incerto**: confira diretamente no EasyMOB. Após interrupção abrupta, estados **iniciando** ou **enviado** também exigem conferência.

Execute uma instância com o mesmo diretório de dados. `data/instance.lock` usa a trava de sistema `flock` (pacote Linux `util-linux`). O arquivo pode permanecer no disco: a trava é liberada automaticamente quando o processo termina, inclusive após interrupção abrupta. Não remova o arquivo enquanto uma instância estiver rodando. Preserve o histórico do dia: ele evita disparos duplicados. Estado corrompido exige intervenção, sem recuperação que descarte silenciosamente o histórico.

## Validação

```bash
npm test
npm run build
```

Os testes verificam horários, fuso, fins de semana e datas excluídas. Não registram ponto real. A integração autenticada precisa ser conferida no ambiente de uso.

## Configurações pelo painel

A página **Configurações** permite informar credenciais, escolher simulação, dias ativos, folgas e até 32 horários com tipo. Uma data específica limita o horário àquele dia (inclusive extras). Datas específicas continuam respeitando dias ativos e folgas. Sem data, o horário é recorrente. Horários sobrepostos são rejeitados.

Depois do primeiro salvamento, `data/settings.json` passa a ter prioridade sobre as credenciais, calendário e modo do `.env`. O arquivo tem permissão 600 e não entra no Git. Deixar a senha vazia no formulário mantém a senha anterior; a API nunca devolve a senha salva. Trocar grupo ou usuário pausa o agendamento e limpa o cache de marcações. O histórico de execuções local é preservado.

**Execuções** é uma página separada com paginação. **Marcações no portal** consulta dados autenticados do EasyMOB, mantém a última consulta em disco e permite filtrar seu conteúdo. Não transforma execuções em comprovantes de ponto. Se uma consulta falhar, o cache anterior é mantido com sua data original.

A integração de consulta exige `EASYMOB_PUNCHES_URL` (opcional, mesmo domínio do EasyMOB) e `EASYMOB_PUNCHES_SELECTOR` (seletor de uma tabela com linhas e células). Esses seletores ainda precisam ser conferidos na área autenticada da conta. A consulta traz as linhas presentes nessa tabela; não navega por páginas ou períodos adicionais do portal.

Para selecionar efetivamente um tipo no portal, configure `EASYMOB_TYPE_SELECTOR` para o elemento `select` e `EASYMOB_TYPE_VALUES` com os valores reais das opções, por exemplo um objeto com chaves `entrada`, `saida_almoco`, `retorno_almoco`, `saida`, `inicio_extra`, `fim_extra`. Não invente valores: confira os existentes no portal. Sem mapeamento, os tipos regulares servem como rótulos locais e o portal determina a marcação; registros extras reais são bloqueados. O teste de login não comprova o tipo nem o sucesso de um registro real.

A consulta de localização usa a permissão do navegador e exibe a posição real, precisão e instante de captura, apenas na sessão atual. Não altera a localização do Chromium no servidor. Não há localização falsa nem horários aleatórios para disfarçar registros automáticos.

Após atualizar o código, reconstrua o container:

```bash
sudo docker compose up -d --build
```
