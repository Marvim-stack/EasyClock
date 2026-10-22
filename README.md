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

Execute uma instância com o mesmo diretório de dados. `data/instance.lock` bloqueia outra instância. Depois de desligamento abrupto, confirme que o processo anterior acabou antes de remover esse lock e reiniciar. Preserve o histórico do dia: ele evita disparos duplicados. Estado corrompido exige intervenção, sem recuperação que descarte silenciosamente o histórico.

## Validação

```bash
npm test
npm run build
```

Os testes verificam horários, fuso, fins de semana e datas excluídas. Não registram ponto real. A integração autenticada precisa ser conferida no ambiente de uso.
