import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
const labels: Record<string, string> = { entrada: 'Entrada', saida_almoco: 'Saída para almoço', retorno_almoco: 'Retorno do almoço', saida: 'Saída', inicio_extra: 'Início de hora extra', fim_extra: 'Fim de hora extra' };
const weekdays = [['Mon','Seg'],['Tue','Ter'],['Wed','Qua'],['Thu','Qui'],['Fri','Sex'],['Sat','Sáb'],['Sun','Dom']];
type Slot = {time: string; kind: string; date?: string};
type Settings = {group: string; user: string; password?: string; hasPassword: boolean; dryRun: boolean; days: string[]; excludedDates: string[]; slots: Slot[]};
type Status = {enabled: boolean; dryRun: boolean; busy: boolean; slots: Slot[]; days: string[]};
type History = {entries: {key: string; at: string; status: string; message: string; kind?: string}[]; total: number; page: number};
type Punches = {fetchedAt: string | null; rows: string[][]};
const dateTime = (s: string) => new Date(s).toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo'});
async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {method: body === undefined ? 'GET' : 'POST', headers: {'X-EasyClock':'local','Content-Type':'application/json'}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  const result = await res.json();
  if (!res.ok) throw new Error(typeof result.message === 'string' ? result.message : 'Não foi possível concluir a operação.');
  return result;
}
function App() {
  const [page, setPage] = useState(location.hash.slice(1) || 'inicio');
  const [status, setStatus] = useState<Status>();
  const [settings, setSettings] = useState<Settings>();
  const [history, setHistory] = useState<History>({entries: [], total: 0, page: 1});
  const [punches, setPunches] = useState<Punches>({fetchedAt:null,rows:[]});
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [geo, setGeo] = useState('');
  const report = (e: unknown) => setError(e instanceof Error ? e.message : 'Falha de conexão.');
  useEffect(() => {
    const change = () => {setPage(location.hash.slice(1) || 'inicio');setError('');setNotice('');};
    addEventListener('hashchange', change);
    void api<Settings>('settings').then(s=>setSettings({...s,password:''})).catch(report);
    const refresh = () => void api<Status>('status').then(setStatus).catch(report);
    refresh(); const timer = setInterval(refresh,5000);
    return () => {removeEventListener('hashchange',change);clearInterval(timer);};
  }, []);
  useEffect(() => {
    if(page === 'historico') void api<History>('history').then(setHistory).catch(report);
    if(page === 'marcacoes') void api<Punches>('punches').then(setPunches).catch(report);
  },[page]);
  async function action(fn: () => Promise<void>) {
    setPending(true);setError('');setNotice('');
    try {await fn();} catch(e) {report(e);} finally {setPending(false);}
  }
  const blocked = pending || status?.busy;
  function updateSlot(i: number, patch: Partial<Slot>) {
    if(settings) setSettings({...settings,slots:settings.slots.map((s,j)=>j===i?{...s,...patch}:s)});
  }
  return <main><header><span className="brand">◷ EasyClock</span><a href="https://easymob.metadados.com.br/Account/LoginColaborador" target="_blank" rel="noreferrer">Abrir EasyMOB ↗</a></header>
    <nav aria-label="Navegação principal">{[['inicio','Minha jornada'],['configuracoes','Configurações'],['marcacoes','Marcações no portal'],['historico','Execuções']].map(([id,label])=><a key={id} href={`#${id}`} aria-current={page===id?'page':undefined}>{label}</a>)}</nav>
    {error && <p role="alert" className="error">{error}</p>}{notice && <p role="status" className="success">{notice}</p>}
    {page==='inicio' && <><section><p className="eyebrow">SUA JORNADA, ORGANIZADA</p><h1>O ponto certo.<br/>Na hora certa.</h1><p>Sua rotina, seus horários. Fuso de São Paulo.</p></section>
      <div className="summary"><span className="pill">{status?.enabled?'Agendamento ativo':'Agendamento pausado'}</span><span>{status?.dryRun?'Modo simulação · sem registro real':'Modo real · registro automático'}</span></div>
      <div className="slots">{status?.slots.map((s,i)=><article key={i}><small>{labels[s.kind]}</small><strong>{s.time}</strong><span>{s.date || 'Dias da semana configurados'}</span></article>)}</div>
      <div className="controls"><button disabled={!status||blocked} onClick={()=>void action(async()=>setStatus(await api<Status>('toggle',{})))}>{status?.enabled?'Pausar agendamento':'Ativar agendamento'}</button><button className="secondary" disabled={!status||blocked} onClick={()=>void action(async()=>{setStatus(await api<Status>('test',{}));setNotice('Teste concluído. Consulte o resultado em Execuções.');})}>{blocked?'Executando…':'Testar login sem registrar'}</button></div>
      <p className="note">O computador e o servidor precisam estar ligados. Horários perdidos não são registrados depois. Horas extras também respeitam os dias ativos e as datas excluídas.</p></>}
    {page==='configuracoes' && <><h1 className="page-title">Sua configuração</h1>{settings?<form onSubmit={e=>{e.preventDefault();void action(async()=>{const saved=await api<Settings>('settings',settings);setSettings({...saved,password:''});setStatus(await api<Status>('status'));setNotice('Configurações salvas.');});}}>
      <fieldset disabled={blocked}><legend>Acesso ao EasyMOB</legend><div className="form-grid"><label>Grupo<input required maxLength={200} autoComplete="organization" value={settings.group} onChange={e=>setSettings({...settings,group:e.target.value})}/></label><label>Usuário<input required maxLength={200} autoComplete="username" value={settings.user} onChange={e=>setSettings({...settings,user:e.target.value})}/></label><label>Senha<input type="password" maxLength={500} autoComplete="new-password" placeholder={settings.hasPassword?'Senha salva · deixe vazio para manter':'Informe a senha'} value={settings.password||''} onChange={e=>setSettings({...settings,password:e.target.value})}/></label></div><p className="note">Trocar grupo ou usuário pausa o agendamento e limpa as marcações consultadas da conta anterior.</p></fieldset>
      <fieldset disabled={blocked}><legend>Horários e horas extras</legend>{settings.slots.map((s,i)=><div className="schedule-row" key={i}><label>Hora<input required type="time" value={s.time} onChange={e=>updateSlot(i,{time:e.target.value})}/></label><label>Tipo<select value={s.kind} onChange={e=>updateSlot(i,{kind:e.target.value})}>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Data específica (opcional)<input type="date" value={s.date||''} onChange={e=>updateSlot(i,{date:e.target.value||undefined})}/></label><button type="button" className="secondary" aria-label={`Remover horário ${s.time}`} onClick={()=>setSettings({...settings,slots:settings.slots.filter((_,j)=>i!==j)})}>Remover</button></div>)}<button type="button" className="secondary" disabled={settings.slots.length>=32} onClick={()=>setSettings({...settings,slots:[...settings.slots,{time:'19:00',kind:'inicio_extra'}]})}>+ Adicionar horário</button><p className="note">Use uma data para extras pontuais; sem data, o horário se repete nos dias ativos. O tipo no portal depende das opções disponíveis na sua conta.</p></fieldset>
      <fieldset disabled={blocked}><legend>Calendário e execução</legend><div className="days">{weekdays.map(([id,label])=><label key={id}><input type="checkbox" checked={settings.days.includes(id)} onChange={e=>setSettings({...settings,days:e.target.checked?[...settings.days,id]:settings.days.filter(d=>d!==id)})}/>{label}</label>)}</div><label>Folgas, férias e feriados (uma data por linha)<textarea rows={4} placeholder="2026-12-25" value={settings.excludedDates.join('\n')} onChange={e=>setSettings({...settings,excludedDates:e.target.value.split('\n')})}/></label><label className="check"><input type="checkbox" checked={settings.dryRun} onChange={e=>setSettings({...settings,dryRun:e.target.checked})}/>Simulação: verificar o acesso sem registrar ponto</label></fieldset>
      <button disabled={blocked}>Salvar configurações</button></form>:<p>Carregando configurações…</p>}
      <h2>Localização real</h2><p className="note">Consulte sua posição atual com autorização do navegador. Esta consulta não altera a localização enviada ao EasyMOB pelo servidor.</p><button className="secondary" disabled={pending} onClick={()=>{if(!navigator.geolocation){setError('Geolocalização indisponível neste navegador.');return;}navigator.geolocation.getCurrentPosition(p=>setGeo(`Latitude ${p.coords.latitude.toFixed(6)}, longitude ${p.coords.longitude.toFixed(6)} · precisão ${Math.round(p.coords.accuracy)} m · ${dateTime(new Date(p.timestamp).toISOString())}`),()=>setError('Não foi possível obter sua localização. Confira a permissão do navegador.'),{enableHighAccuracy:true,maximumAge:0,timeout:15000});}}>Consultar minha localização</button>{geo&&<p role="status">{geo}</p>}
    </>}
    {page==='historico' && <><h1 className="page-title">Execuções</h1><p className="note">Tentativas do EasyClock. A confirmação da jornada deve ser consultada nas marcações do portal.</p><button className="secondary" disabled={pending} onClick={()=>void action(async()=>setHistory(await api<History>(`history?page=${history.page}`)))}>Atualizar</button><div className="history">{history.entries.length?history.entries.map(item=><article key={item.key}><div><strong>{item.status} {item.kind?`· ${labels[item.kind]||item.kind}`:''}</strong><time>{dateTime(item.at)}</time></div><p>{item.message}</p><small>{item.key}</small></article>):<p>Nenhuma execução nesta página.</p>}</div><div className="controls"><button className="secondary" disabled={pending||history.page<=1} onClick={()=>void action(async()=>setHistory(await api<History>(`history?page=${history.page-1}`)))}>Anterior</button><span>Página {history.page} · {history.total} execuções</span><button className="secondary" disabled={pending||history.page*25>=history.total} onClick={()=>void action(async()=>setHistory(await api<History>(`history?page=${history.page+1}`)))}>Próxima</button></div></>}
    {page==='marcacoes' && <><h1 className="page-title">Marcações no portal</h1><p className="note">Dados consultados no EasyMOB. Última consulta: {punches.fetchedAt?dateTime(punches.fetchedAt):'ainda não realizada'}.</p><div className="controls"><button disabled={blocked} onClick={()=>void action(async()=>{setPunches(await api<Punches>('punches/sync',{}));setNotice('Marcações atualizadas do portal.');})}>{blocked?'Consultando…':'Buscar marcações'}</button><label>Filtrar dados<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Data ou horário"/></label></div><div className="table-wrap">{punches.rows.length?<table><tbody>{punches.rows.filter(r=>r.join(' ').toLowerCase().includes(filter.toLowerCase())).map((r,i)=><tr key={i}>{r.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table>:<p>Nenhuma marcação consultada. Use o botão para buscar no portal.</p>}</div></>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
