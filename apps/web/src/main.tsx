import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const labels: Record<string, string> = {
  entrada: 'Entrada', saida_almoco: 'Saída para almoço', retorno_almoco: 'Volta do almoço',
  saida: 'Saída', inicio_extra: 'Início de extra', fim_extra: 'Fim de extra',
};
const weekdays = [['Mon','Seg'],['Tue','Ter'],['Wed','Qua'],['Thu','Qui'],['Fri','Sex'],['Sat','Sáb'],['Sun','Dom']];
type Slot = { time: string; kind: string; date?: string };
type Settings = { group: string; user: string; password?: string; hasPassword: boolean; dryRun: boolean; days: string[]; excludedDates: string[]; slots: Slot[] };
type Status = { enabled: boolean; dryRun: boolean; busy: boolean; slots: Slot[]; days: string[] };
type History = { entries: { key: string; at: string; status: string; message: string; kind?: string }[]; total: number; page: number };
type Punches = { fetchedAt: string | null; rows: string[][] };
const dateTime = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-EasyClock': 'local', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(typeof result.message === 'string' ? result.message : 'Não foi possível concluir a operação.');
  return result;
}
function Emblem() {
  return <svg viewBox="0 0 100 100" aria-hidden="true" className="emblem"><path d="M50 5 86 22 90 60 50 94 10 60 14 22Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="m25 34 12-10 11 10-3 29-16-7Z" fill="currentColor"/><path d="m53 32 12-9 12 12-4 23-17 10Z" fill="none" stroke="currentColor" strokeWidth="3"/><path d="m31 37 5 3m5-3 3 3" stroke="#131313" strokeWidth="3"/><path d="m32 46 9 5" stroke="#131313" strokeWidth="3"/><path d="m59 37 4 3m5-3 4 3m-12 12q6-8 11-1" fill="none" stroke="currentColor" strokeWidth="3"/><text x="50" y="82" textAnchor="middle" fontSize="14" fontWeight="900" fill="currentColor">244</text></svg>;
}
function App() {
  const [page, setPage] = useState(location.hash.slice(1) || 'inicio');
  const [status, setStatus] = useState<Status>();
  const [settings, setSettings] = useState<Settings>();
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState<History>({ entries: [], total: 0, page: 1 });
  const [punches, setPunches] = useState<Punches>({ fetchedAt: null, rows: [] });
  const [filter, setFilter] = useState('');
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
  async function action(fn: () => Promise<void>) {
    setPending(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { report(e); } finally { setPending(false); }
  }
  const blocked = pending || Boolean(status?.busy);
  function edit(patch: Partial<Settings>) {
    if (settings) { setSettings({ ...settings, ...patch }); setDirty(true); }
  }
  function updateSlot(i: number, patch: Partial<Slot>) {
    if (settings) edit({ slots: settings.slots.map((s, j) => j === i ? { ...s, ...patch } : s) });
  }
  async function save() {
    const saved = await api<Settings>('settings', settings);
    setSettings({ ...saved, password: '' }); setDirty(false);
    setStatus(await api<Status>('status'));
    setPunches(await api<Punches>('punches'));
    setNotice('Tudo salvo. Seus horários já estão atualizados.');
  }
  return <main>
    <header><a className="brand" href="#inicio"><span className="brand-mark">E<span>★</span>C</span><span>EasyClock<small>NA SUA HORA.</small></span></a>
      <nav aria-label="Navegação principal"><a href="#inicio" aria-current={page !== 'historico' ? 'page' : undefined}>Painel</a><a href="#historico" aria-current={page === 'historico' ? 'page' : undefined}>Execuções</a><a className="portal-link" href="https://easymob.metadados.com.br/Account/LoginColaborador" target="_blank" rel="noreferrer">EasyMOB ↗</a></nav>
    </header>
    {error && <p role="alert" className="message error">{error}</p>}
    {notice && <p role="status" className="message success">{notice}</p>}
    {page !== 'historico' ? <>
      <section className="hero"><div><p className="eyebrow">INDEPENDENTE. DO SEU JEITO.</p><h1>SUA ROTINA.<br/><span>SUAS REGRAS.</span></h1><p>Edite os horários. Salve. Siga o corre.</p></div><div className="stamp"><Emblem/><span>CHORA AGORA · RI DEPOIS</span></div></section>
      <div className="status-bar"><span className={`pill ${status?.enabled ? 'live' : ''}`}><i/>{status?.enabled ? 'Ativo' : 'Pausado'}</span><span>{status?.dryRun ? 'Simulação · não registra ponto' : 'Modo real · registro nos horários ativos'}</span><span className="timezone">HORÁRIO DE SÃO PAULO</span></div>
      {settings ? <form onSubmit={e => { e.preventDefault(); void action(save); }}>
        <div className="section-title"><div><p className="eyebrow">01 / SEU CORRE</p><h2>Horários</h2></div><button type="button" className="secondary" disabled={blocked || settings.slots.length >= 32} onClick={() => edit({ slots: [...settings.slots, { time: '', kind: 'inicio_extra' }] })}>+ Horário / extra</button></div>
        <fieldset className="plain" disabled={blocked}><legend className="sr-only">Editar horários</legend><div className="slots">{settings.slots.map((s, i) => <article className="slot" key={i}>
          <div className="slot-top"><span>{String(i + 1).padStart(2, '0')}</span><button type="button" className="icon-button" aria-label={`Remover horário ${s.time || i + 1}`} onClick={() => edit({ slots: settings.slots.filter((_, j) => i !== j) })}>×</button></div>
          <label><span className="sr-only">Tipo do horário {i + 1}</span><select value={s.kind} onChange={e => updateSlot(i, { kind: e.target.value })}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label><span className="sr-only">Hora {i + 1}</span><input className="time-input" required type="text" inputMode="numeric" placeholder="09:00" maxLength={5} pattern="([01][0-9]|2[0-3]):[0-5][0-9]" value={s.time} onChange={e => { const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 4); updateSlot(i, { time: digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits }); }}/></label>
          <label className="date-label">{s.kind.includes('extra') ? 'Data da extra (opcional)' : 'Data específica (opcional)'}<input type="date" value={s.date || ''} onChange={e => updateSlot(i, { date: e.target.value || undefined })}/></label>
        </article>)}</div>
          <div className="days" aria-label="Dias ativos">{weekdays.map(([id, label]) => <label key={id} className={settings.days.includes(id) ? 'selected' : ''}><input type="checkbox" checked={settings.days.includes(id)} onChange={e => edit({ days: e.target.checked ? [...settings.days, id] : settings.days.filter(d => d !== id) })}/>{label}</label>)}</div>
        </fieldset>
        <div className="action-bar"><div className="controls"><button type="submit" disabled={blocked || !dirty}>{pending ? 'Aguarde…' : dirty ? 'Salvar alterações' : 'Tudo salvo ✓'}</button><button type="button" className="secondary" disabled={!status || blocked || dirty} onClick={() => void action(async () => setStatus(await api<Status>('toggle', {})))}>{status?.enabled ? 'Pausar' : 'Ativar horários'}</button><button type="button" className="text-button" disabled={!status || blocked || dirty} onClick={() => void action(async () => { setStatus(await api<Status>('test', {})); const result = await api<History>('history'); setNotice(result.entries[0]?.message || 'Confira o teste em Execuções.'); })}>Testar acesso ↗</button></div><p>{dirty ? 'Salve antes de ativar ou testar.' : 'Servidor ligado. Rotina em dia.'}</p></div>
        <details className="settings-panel" open={page === 'configuracoes' || !settings.group || !settings.user ? true : undefined}><summary>Acesso e ajustes <span>Grupo, senha, modo de execução e folgas</span></summary>
          <fieldset className="plain" disabled={blocked}><legend className="sr-only">Acesso e ajustes</legend><div className="form-grid"><label>Grupo<input maxLength={200} autoComplete="organization" value={settings.group} onChange={e => edit({ group: e.target.value })}/></label><label>Usuário<input maxLength={200} autoComplete="username" value={settings.user} onChange={e => edit({ user: e.target.value })}/></label><label>Senha<input type="password" maxLength={500} autoComplete="new-password" placeholder={settings.hasPassword ? 'Salva · vazio para manter' : 'Sua senha'} value={settings.password || ''} onChange={e => edit({ password: e.target.value })}/></label></div>
            <div className="adjustments"><label className="check"><input type="checkbox" checked={settings.dryRun} onChange={e => edit({ dryRun: e.target.checked })}/><span>Modo de simulação<small>Testa sem registrar ponto.</small></span></label><label>Folgas e feriados · uma data por linha<textarea rows={2} placeholder="2026-12-25" value={settings.excludedDates.join('\n')} onChange={e => edit({ excludedDates: e.target.value.split('\n') })}/></label></div><div className="controls"><button type="submit" disabled={blocked || !dirty}>Salvar ajustes</button><button type="button" className="text-button" onClick={() => { if (!navigator.geolocation) { setError('Localização indisponível.'); return; } navigator.geolocation.getCurrentPosition(p => setGeo(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)} · precisão de ${Math.round(p.coords.accuracy)} m`), () => setError('Autorize a localização no navegador.'), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }); }}>Consultar localização real ↗</button></div>{geo && <p className="note">Sua localização: {geo}. A consulta não altera a localização do EasyMOB.</p>}
          </fieldset>
        </details>
      </form> : <p>Carregando seus horários…</p>}
      <section className="punches"><div className="section-title"><div><p className="eyebrow">02 / NO PORTAL</p><h2>Seus pontos</h2></div><button className="secondary" disabled={blocked || dirty} onClick={() => void action(async () => { setPunches(await api<Punches>('punches/sync', {})); setNotice('Marcações consultadas no EasyMOB.'); })}>{pending ? 'Aguarde…' : 'Buscar marcações ↻'}</button></div>
        <p className="note">{punches.fetchedAt ? `Última consulta: ${dateTime(punches.fetchedAt)}.` : 'Consulte os horários registrados no EasyMOB.'}</p>
        {punches.rows.length > 0 ? <><label className="filter">Filtrar<input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Data ou horário"/></label><div className="table-wrap"><table><tbody>{punches.rows.filter(r => r.join(' ').toLowerCase().includes(filter.toLowerCase())).map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div></> : <div className="empty"><span>— : —</span><p>{punches.fetchedAt ? 'A consulta não encontrou marcações.' : 'Suas marcações aparecem aqui depois da consulta.'}</p></div>}
      </section>
      <p className="footnote">O servidor precisa permanecer ligado. Datas de extras também respeitam os dias ativos e as folgas.</p>
    </> : <>
      <div className="section-title history-title"><div><p className="eyebrow">O QUE ROLOU</p><h1>Execuções</h1></div><button className="secondary" disabled={pending} onClick={() => void action(async () => setHistory(await api<History>(`history?page=${history.page}`)))}>Atualizar ↻</button></div>
      <p className="note">Tentativas do EasyClock. Consulte “Seus pontos” para ver as marcações do portal.</p>
      <div className="history">{history.entries.length ? history.entries.map(item => <article key={item.key}><div><strong>{item.status} {item.kind ? `· ${labels[item.kind] || item.kind}` : ''}</strong><time>{dateTime(item.at)}</time></div><p>{item.message}</p><small>{item.key}</small></article>) : <div className="empty"><p>Nenhuma execução nesta página.</p></div>}</div>
      <div className="pagination"><button className="secondary" disabled={pending || history.page <= 1} onClick={() => void action(async () => setHistory(await api<History>(`history?page=${history.page - 1}`)))}>← Anterior</button><span>{history.page} · {history.total} execuções</span><button className="secondary" disabled={pending || history.page * 25 >= history.total} onClick={() => void action(async () => setHistory(await api<History>(`history?page=${history.page + 1}`)))}>Próxima →</button></div>
    </>}
    <footer><span>EASYCLOCK / 244</span><span>SEM PRESSA. SEM PERDER A HORA.</span><span>244 / SUL</span></footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
