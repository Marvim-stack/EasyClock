import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
type Status = { enabled: boolean; dryRun: boolean; busy: boolean; slots: string[]; days: string[]; excludedDates: string[]; timezone: string; history: { key: string; at: string; status: string; message: string }[] };
function App() {
  const [status, setStatus] = useState<Status>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function request(action = 'status') {
    try {
      const res = await fetch(`/api/${action}`, { method: action === 'status' ? 'GET' : 'POST', headers: { 'X-EasyClock': 'local' } });
      if (!res.ok) throw new Error('Não foi possível concluir a operação.');
      setStatus(await res.json()); setError('');
    } catch { setError('Servidor indisponível ou operação em andamento. Verifique o terminal.'); }
  }
  async function action(name: string) { setPending(true); try { await request(name); } finally { setPending(false); } }
  useEffect(() => { void request(); const timer = setInterval(() => void request(), 5000); return () => clearInterval(timer); }, []);
  return <main><header><span className="brand">◷ EasyClock</span><a href="https://easymob.metadados.com.br/Account/LoginColaborador" target="_blank" rel="noreferrer">Abrir EasyMOB ↗</a></header>
    <section><p className="eyebrow">SUA JORNADA, ORGANIZADA</p><h1>O ponto certo.<br/>Na hora certa.</h1><p>Quatro horários para acompanhar sua rotina de trabalho.</p></section>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="summary"><span className="pill">{status?.enabled ? 'Agendamento ativo' : 'Agendamento pausado'}</span><span>{status?.dryRun ? 'Modo simulação · sem registro real' : 'Modo real · registro automático'}</span></div>
    <div className="slots">{(status?.slots || ['09:00','12:00','13:00','18:20']).map((time, i) => <article key={time}><small>{['Entrada','Saída para almoço','Volta do almoço','Saída'][i]}</small><strong>{time}</strong><span>America/Sao_Paulo</span></article>)}</div>
    <div className="controls"><button disabled={!status || pending} onClick={() => void action('toggle')}>{status?.enabled ? 'Pausar agendamento' : 'Ativar agendamento'}</button><button className="secondary" disabled={!status || pending || status.busy} onClick={() => void action('test')}>{pending || status?.busy ? 'Executando…' : 'Testar login sem registrar'}</button></div>
    <p className="note">Dias ativos: {status?.days.join(', ') || '—'}. O computador e o servidor precisam permanecer ligados. Horários perdidos não são registrados depois.</p>
    <h2>Histórico de execuções</h2><div className="history">{!status?.history.length ? <p>Nenhuma execução ainda. Comece testando o acesso.</p> : status.history.map(item => <article key={item.key}><div><strong>{item.status}</strong><time>{new Date(item.at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time></div><p>{item.message}</p><small>{item.key}</small></article>)}</div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
