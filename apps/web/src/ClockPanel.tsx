import { useEffect, useState } from 'react';
import './style.css';

const labels: Record<string, string> = {
  entrada: 'Entrada', saida_almoco: 'Almoço', retorno_almoco: 'Volta do almoço',
  saida: 'Saída',
};
const weekdays = [['Mon','Seg'],['Tue','Ter'],['Wed','Qua'],['Thu','Qui'],['Fri','Sex'],['Sat','Sáb'],['Sun','Dom']];
type Slot = { time: string; kind: string };
type Settings = { group: string; user: string; password?: string; hasPassword: boolean; dryRun: boolean; days: string[]; excludedDates: string[]; slots: Slot[]; variation: boolean; minWorkMinutes: number };
type Status = { automationAllowed?: boolean; enabled: boolean; dryRun: boolean; busy: boolean; slots: Slot[]; days: string[]; connectedAt: string | null; todaySlots: Slot[] };
type History = { entries: { key: string; at: string; status: string; message: string; kind?: string }[]; total: number; page: number };
type Punches = { fetchedAt: string | null; rows: string[][] };
const dateTime = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    headers: { 'X-EasyClock': 'local', 'X-EasyClock-Request': '1', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(typeof result.message === 'string' ? result.message : 'Não foi possível concluir a operação.');
  return result;
}
export function ClockPanel({ embedded = false, page: accountPage }: { embedded?: boolean; page?: string }) {
  const [localPage, setPage] = useState(location.hash.slice(1) || 'inicio');
  const page = accountPage === 'painel' ? 'inicio' : accountPage || localPage;
  const Frame = embedded ? 'div' : 'main';
  const [status, setStatus] = useState<Status>();
  const [settings, setSettings] = useState<Settings>();
  const [dirty, setDirty] = useState(false);
  const [credentialsDirty, setCredentialsDirty] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [history, setHistory] = useState<History>({ entries: [], total: 0, page: 1 });
  const [punches, setPunches] = useState<Punches>({ fetchedAt: null, rows: [] });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [geo, setGeo] = useState('');
  const report = (e: unknown) => setError(e instanceof Error ? e.message : 'Falha de conexão.');
  useEffect(() => {
    const change = () => { setPage(location.hash.slice(1) || 'inicio'); setError(''); setNotice(''); };
    addEventListener('hashchange', change);
    void api<Settings>('settings').then(s => setSettings({ ...s, password: '' })).catch(report);
    void api<Punches>('punches').then(setPunches).catch(report);
    const refresh = () => void api<Status>('status').then(setStatus).catch(report);
    refresh(); const timer = setInterval(refresh, 5000);
    return () => { removeEventListener('hashchange', change); clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (page === 'historico') void api<History>('history').then(setHistory).catch(report);
  }, [page]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function action(fn: () => Promise<void>) {
    setPending(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { report(e); } finally { setPending(false); }
  }
  const blocked = pending || Boolean(status?.busy);
  const automationAllowed = status?.automationAllowed ?? !embedded;
  const connected = Boolean(status?.connectedAt);
  function edit(patch: Partial<Settings>) {
    if (settings) { setSettings({ ...settings, ...patch }); setDirty(true); }
  }
  async function save() {
    const saved = await api<Settings>('settings', settings);
    setSettings({ ...saved, password: '' }); setDirty(false); setCredentialsDirty(false);
    setStatus(await api<Status>('status'));
    setPunches(await api<Punches>('punches'));
    setNotice('Tudo salvo. Seus horários já estão atualizados.');
  }
  async function connect() {
    setConnecting(true);
    try {
      await save();
      setNotice('');
      await api('connect', {});
      setNotice('Conectado ao EasyMOB. Credenciais válidas. Nenhum ponto foi registrado.');
    } finally { setConnecting(false); setStatus(await api<Status>('status')); }
  }
  async function toggleVariation() {
    const saved = await api<Settings>('variation', { enabled: !settings?.variation });
    setSettings(current => current ? { ...current, variation: saved.variation } : saved);
    setStatus(await api<Status>('status'));
    setNotice(saved.variation ? 'Humanização ativada e salva. Confira os horários de hoje nos cartões.' : 'Humanização desligada. Os horários fixos serão usados.');
  }
  return <Frame>
    {!embedded && <header><a className="brand" href="#inicio" aria-label="EasyClock · início"><img className="brand-logo" src="/easyclock-logo.png" alt="EasyClock — Chora agora, ri depois. Palhaços chorando e sorrindo." width="300" height="100"/></a>
      <nav aria-label="Navegação principal">{[['inicio','Horários'],['configuracoes','Configurações'],['historico','Execuções']].map(([id, title]) => <a key={id} href={`#${id}`} aria-current={page === id ? 'page' : undefined}>{title}</a>)}</nav>
    </header>}
    <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`} role="status">
      <span><strong>{connecting ? 'Verificando acesso ao EasyMOB…' : connected ? 'Conectado ao EasyMOB' : 'EasyMOB não conectado'}</strong><small>{connected && status?.connectedAt ? `Credenciais verificadas em ${dateTime(status.connectedAt)} · nenhum ponto registrado pela conexão.` : 'Conectar verifica o acesso sem registrar ponto.'}</small></span>
      {!connected && !connecting && <a href="#configuracoes">Conectar</a>}
    </div>
    {error && <p role="alert" className="message error">{error}</p>}
    {notice && <div role="status" className="toast"><span>{notice}</span><button type="button" aria-label="Fechar notificação" onClick={() => setNotice('')}>×</button></div>}
    {page === 'inicio' && <>
      {status && !automationAllowed && <div className="subscription-notice" role="status"><strong>Explore seu painel.</strong><p>Configure seus horários e teste a conexão com o EasyMOB. As marcações automáticas ficam disponíveis com a assinatura.</p><a href={embedded ? '#conta' : '/#conta'}>Ver minha assinatura</a></div>}
      <div className="section-title page-title"><h1>Seus horários</h1></div>
      <section className="automation" aria-label="Marcações automáticas">
        <div><span className={`pill ${status?.enabled ? 'live' : ''}`}><i/>{!status ? 'Carregando agendamento…' : status.enabled ? 'Agendamento automático ligado' : 'Agendamento automático desligado'}</span>
          <p id="automation-description" className="note">{!status ? 'Consultando o estado salvo.' : status.enabled ? status.dryRun ? 'Executa os quatro horários em simulação, sem registrar ponto.' : 'Registra os quatro pontos nos horários e dias selecionados.' : 'Nenhum ponto será iniciado automaticamente.'}</p>
        </div>
        <button type="button" className={`state-toggle ${status?.enabled ? 'on' : 'off'}`} aria-pressed={Boolean(status?.enabled)} aria-describedby="automation-description automation-persistence" disabled={!status || pending || (!automationAllowed && !status.enabled) || (!status.enabled && (Boolean(status.busy) || dirty))} onClick={() => void action(async () => setStatus(await api<Status>('toggle', {})))}>{status?.enabled ? 'Pausar marcações automáticas' : 'Ativar marcações automáticas'}</button>
        <small id="automation-persistence" className="note">A escolha é salva automaticamente e mantida ao reiniciar. O servidor precisa permanecer ligado.</small>
      </section>
      {settings && <section className="automation variation-control" aria-label="Humanizar marcações">
        <div><strong>Humanizar marcações</strong><p className="note" id="variation-description">{settings.variation ? 'Ligado: sorteia um atraso de até 10 minutos em cada ponto, respeitando a jornada mínima.' : 'Desligado: usa os quatro horários exatamente como você definiu.'}</p></div>
        <button type="button" role="switch" aria-checked={settings.variation} aria-label="Humanizar marcações" aria-describedby="variation-description" className={`state-toggle ${settings.variation ? 'on' : 'off'}`} disabled={blocked || !automationAllowed} onClick={() => void action(toggleVariation)}>{settings.variation ? 'Ativado' : 'Desligado'}</button>
      </section>}
      {settings ? <form onSubmit={e => { e.preventDefault(); void action(save); }}>
        <fieldset className="plain" disabled={blocked}><legend className="sr-only">Quatro horários fixos</legend>
          <div className="slots">{settings.slots.map((s, i) => <label className="slot" key={s.kind}><span>{labels[s.kind]}</span>
            <input className="time-input" aria-label={labels[s.kind]} required type="text" inputMode="numeric" maxLength={5} pattern="([01][0-9]|2[0-3]):[0-5][0-9]" value={s.time} onChange={e => {
              const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
              edit({ slots: settings.slots.map((slot, j) => j === i ? { ...slot, time: digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits } : slot) });
            }}/>
            {settings.variation && !dirty && status?.todaySlots[i] && <small>Hoje: {status.todaySlots[i].time}</small>}
          </label>)}</div>
          <div className="days" role="group" aria-label="Dias da semana">{weekdays.map(([id, label]) => <label key={id} className={settings.days.includes(id) ? 'selected' : ''}><input type="checkbox" checked={settings.days.includes(id)} onChange={e => edit({ days: e.target.checked ? [...settings.days, id] : settings.days.filter(d => d !== id) })}/>{label}</label>)}</div>
        </fieldset>
        <div className="action-bar"><div className="controls"><button type="submit" disabled={blocked || !dirty}>Salvar horários</button></div>
          <span className="note">{dirty ? 'Salve para aplicar.' : status?.dryRun ? 'Simulação ligada' : 'Modo real'}</span>
        </div>
      </form> : <p>Carregando…</p>}
      <section className="punches"><div className="section-title"><h2>Últimas marcações</h2><button className="secondary" disabled={blocked || dirty} onClick={() => void action(async () => { setPunches(await api<Punches>('punches/sync', {})); })}>{pending ? 'Consultando…' : 'Atualizar'}</button></div>
        {punches.fetchedAt && <p className="note">Atualizado em {dateTime(punches.fetchedAt)}</p>}
        {punches.rows.length ? <div className="table-wrap"><table aria-label="Últimas marcações no EasyMOB"><tbody>{punches.rows.slice(0, 10).map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div> : <p className="empty">{punches.fetchedAt ? 'Nenhuma marcação encontrada.' : 'Clique em Atualizar para consultar o EasyMOB.'}</p>}
      </section>
    </>}
    {page === 'configuracoes' && <>
      <div className="section-title page-title"><h1>Configurações</h1></div>
      {settings && <form onSubmit={e => { e.preventDefault(); void action(connect); }}>
        <fieldset className="plain" disabled={blocked}><legend><h2>Acesso ao EasyMOB</h2></legend>
          <p className="note">{credentialsDirty ? 'Credenciais alteradas. Clique em Conectar para verificar e salvar.' : connected && status?.connectedAt ? `Credenciais válidas · verificadas em ${dateTime(status.connectedAt)}` : 'Informe as credenciais e clique em Conectar.'}</p>
          <div className="form-grid"><label>Grupo<input maxLength={200} autoComplete="organization" value={settings.group} onChange={e => { edit({ group: e.target.value }); setCredentialsDirty(true); }}/></label><label>Usuário<input maxLength={200} autoComplete="username" value={settings.user} onChange={e => { edit({ user: e.target.value }); setCredentialsDirty(true); }}/></label><label>Senha<input type="password" maxLength={500} autoComplete="current-password" placeholder={settings.hasPassword ? 'Vazio para manter a senha salva' : 'Sua senha'} value={settings.password || ''} onChange={e => { edit({ password: e.target.value }); setCredentialsDirty(true); }}/></label></div>
          <div className="controls settings-actions"><button type="submit">{connecting ? 'Verificando credenciais…' : connected && !credentialsDirty ? 'Verificar acesso novamente' : 'Conectar sem marcar ponto'}</button></div>
          <div className="section-title"><h2>Preferências</h2></div>
          <div className="adjustments">
            <label>Jornada mínima para humanização (horas por dia)<input type="number" min={0.25} max={23.75} step={0.25} value={settings.minWorkMinutes / 60} onChange={e => edit({ minWorkMinutes: Math.round(Number(e.target.value) * 60) })}/></label>
            <label className="check"><input type="checkbox" checked={settings.dryRun} onChange={e => edit({ dryRun: e.target.checked })}/><span>Modo de simulação<small>Testa sem registrar ponto.</small></span></label>
            <label>Folgas e feriados · uma data por linha<textarea rows={3} placeholder="2026-12-25" value={settings.excludedDates.join('\n')} onChange={e => edit({ excludedDates: e.target.value.split('\n') })}/></label>
          </div>
          <div className="controls"><button type="button" disabled={!dirty} onClick={() => void action(save)}>Salvar configurações</button><button type="button" className="text-button" onClick={() => {
            if (!navigator.geolocation) { setError('Localização indisponível.'); return; }
            navigator.geolocation.getCurrentPosition(p => setGeo(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)} · precisão de ${Math.round(p.coords.accuracy)} m`), () => setError('Autorize a localização no navegador.'), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
          }}>Consultar localização</button></div>{geo && <p className="note">{geo} · não altera a localização do EasyMOB.</p>}
        </fieldset>
      </form>}
    </>}
    {page === 'historico' && <>
      <div className="section-title page-title"><h1>Execuções</h1><button className="secondary" disabled={pending} onClick={() => void action(async () => setHistory(await api<History>(`history?page=${history.page}`)))}>Atualizar</button></div>
      <p className="note">Tentativas da automação. As marcações do portal ficam na página Horários.</p>
      <div className="history">{history.entries.length ? history.entries.map(item => <article key={item.key}><div><strong>{item.status} {item.kind ? `· ${labels[item.kind] || item.kind}` : ''}</strong><time>{dateTime(item.at)}</time></div><p>{item.message}</p></article>) : <p className="empty">Nenhuma execução nesta página.</p>}</div>
      <div className="pagination"><button className="secondary" disabled={pending || history.page <= 1} onClick={() => void action(async () => setHistory(await api<History>(`history?page=${history.page - 1}`)))}>Anterior</button><span>Página {history.page}</span><button className="secondary" disabled={pending || history.page * 25 >= history.total} onClick={() => void action(async () => setHistory(await api<History>(`history?page=${history.page + 1}`)))}>Próxima</button></div>
    </>}
    {!embedded && <footer><span>EasyClock</span><span>Horário de São Paulo</span></footer>}
  </Frame>;
}
