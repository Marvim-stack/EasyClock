import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { TRIAL_DAYS, type User, type Subscription } from '../../../api/src/accounts';
import { access } from './api';
import { ClockPanel } from '../ClockPanel';
import '../style.css';
import './style.css';

const titles: Record<string, string> = { login: 'Bem-vindo de volta.', cadastro: 'Crie sua conta.', 'confirmar-email': 'Confirme seu e-mail.', 'recuperar-senha': 'Recupere seu acesso.', 'nova-senha': 'Defina uma nova senha.' };
const readPage = () => location.hash.slice(1).split('?')[0] || 'login';
const readToken = () => new URLSearchParams(location.hash.split('?')[1] || location.search).get('token') || '';
const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const subscriptionLabels = { pending_payment_method: 'Aguardando cartão', trialing: 'Período de teste', active: 'Assinatura ativa', past_due: 'Pagamento pendente', canceled: 'Assinatura cancelada' };

function App() {
  const [page, setPage] = useState(readPage);
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>();
  const [users, setUsers] = useState<User[] | null>(null);
  const [email, setEmail] = useState('');
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  function route(next: string) { setError(''); location.hash = next; }
  useEffect(() => {
    const change = () => { setPage(readPage()); setToken(readToken()); setEmailConfirmed(false); setResetSent(false); setError(''); setLoadFailed(false); };
    addEventListener('hashchange', change);
    return () => removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (titles[page] || user) return;
    let current = true;
    access.session().then(result => { if (current) setUser(result.user); }).catch(() => { if (current) route('login'); });
    return () => { current = false; };
  }, [page, user]);
  useEffect(() => {
    if (!user) return;
    let current = true;
    access.subscription().then(result => { if (current) setSubscription(result.subscription); }).catch(() => { if (current) setLoadFailed(true); });
    return () => { current = false; };
  }, [user]);
  useEffect(() => {
    if (!user) return;
    let current = true;
    const fail = () => { if (current) setLoadFailed(true); };
    if (page === 'admin' && user.role === 'admin') access.users().then(result => { if (current) setUsers(result.users); }).catch(fail);
    return () => { current = false; };
  }, [page, user]);
  useEffect(() => {
    if (page !== 'confirmar-email' || !token) return;
    let current = true;
    access.confirmEmail(token).then(() => { if (current) { setEmailConfirmed(true); setToken(''); history.replaceState(null, '', '#confirmar-email'); } }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [page, token]);
  async function action(work: () => Promise<void>) {
    setPending(true); setError(''); setNotice('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir a solicitação.'); }
    finally { setPending(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>, work: (data: FormData) => Promise<void>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void action(async () => { await work(data); form.reset(); });
  }
  async function openBilling(portal = false) {
    const result = await (portal ? access.billingPortal() : access.checkout());
    const url = new URL(result.url);
    if (url.protocol !== 'https:') throw new Error('Não foi possível abrir a página de pagamento.');
    location.assign(url.href);
  }
  return <main className="access-app">
    <header><a className="brand" href={user ? '#painel' : '#login'} aria-label="EasyClock Pro · início"><img className="brand-logo" src="/easyclock-logo.svg" width="360" height="72" alt="EasyClock Pro"/></a>
      {user && <nav aria-label="Sua conta"><a href="#painel" aria-current={page === 'painel' ? 'page' : undefined}>Horários</a><a href="#configuracoes" aria-current={page === 'configuracoes' ? 'page' : undefined}>Configurações</a><a href="#historico" aria-current={page === 'historico' ? 'page' : undefined}>Execuções</a><a href="#conta" aria-current={page === 'conta' ? 'page' : undefined}>Minha conta</a>{user.role === 'admin' && <a href="#admin">Admin</a>}<button className="text-button" disabled={pending} onClick={() => void action(async () => { await access.logout(); setUser(null); setSubscription(undefined); setUsers(null); route('login'); })}>Sair</button></nav>}
    </header>
    {error && <p role="alert" className="message error">{error}</p>}
    {notice && <div role="status" className="toast"><span>{notice}</span><button aria-label="Fechar notificação" onClick={() => setNotice('')}>×</button></div>}
    {titles[page] ? <div className="access-layout">
      <aside className="access-intro"><p className="eyebrow">SUA ROTINA, NO SEU TEMPO</p><h1>Seu acesso.<br/><span>Seu controle.</span></h1><p>Seus horários e marcações, em um só lugar.</p></aside>
      <section className="access-card" aria-labelledby="access-title"><h2 id="access-title">{page === 'confirmar-email' && emailConfirmed ? 'E-mail confirmado.' : titles[page]}</h2>
        {page === 'login' && <>
          <form onSubmit={e => submit(e, async data => {
            const result = await access.login(String(data.get('email')).trim().toLowerCase(), String(data.get('password')));
            setUser(result.user); setEmail(result.user.email); route(result.user.emailVerifiedAt ? 'painel' : 'confirmar-email');
          })}><fieldset className="plain" disabled={pending}>
            <label>E-mail<input name="email" type="email" autoComplete="username" placeholder="Seu e-mail" required maxLength={254}/></label>
            <label>Senha<input name="password" type="password" autoComplete="current-password" placeholder="Sua senha" required maxLength={128}/></label>
            <a className="access-link" href="#recuperar-senha">Esqueci minha senha</a><button type="submit">{pending ? 'Entrando…' : 'Entrar'}</button>
          </fieldset></form><p className="access-bottom">Ainda não tem conta? <a href="#cadastro">Criar conta</a></p>
        </>}
        {page === 'cadastro' && <>
          <form onSubmit={e => submit(e, async data => {
            const input = { name: String(data.get('name')), email: String(data.get('email')), password: String(data.get('password')), confirmation: String(data.get('confirmation')) };
            const result = await access.register(input);
            setEmail(result.email); setEmailConfirmed(false); route('confirmar-email');
          })}><fieldset className="plain" disabled={pending}>
            <label>Nome<input name="name" autoComplete="name" placeholder="Seu nome" required maxLength={100}/></label>
            <label>E-mail<input name="email" type="email" autoComplete="email" placeholder="Seu e-mail" required maxLength={254}/></label>
            <label>Senha<input name="password" type="password" autoComplete="new-password" placeholder="Crie uma senha" required maxLength={128}/></label>
            <label>Confirme a senha<input name="confirmation" type="password" autoComplete="new-password" placeholder="Repita sua senha" required maxLength={128}/></label>
            <button type="submit">{pending ? 'Criando conta…' : 'Criar conta'}</button>
          </fieldset></form><p className="access-bottom">Já tem conta? <a href="#login">Entrar</a></p>
        </>}
        {page === 'confirmar-email' && (emailConfirmed ? <><p>Seu endereço foi verificado. Você já pode entrar na sua conta.</p><a className="button-link" href="#login">Ir para o login</a></> : <>
          <p>Abra o link de confirmação recebido por e-mail para concluir seu cadastro.</p>
          {email && <><p className="email-recipient"><strong>{email}</strong></p><button type="button" className="secondary" disabled={pending} onClick={() => void action(async () => { await access.resendEmail(email); setNotice('E-mail de confirmação reenviado.'); })}>{pending ? 'Enviando…' : 'Reenviar confirmação'}</button></>}
          <p className="access-bottom"><a href="#login">Voltar ao login</a></p>
        </>)}
        {page === 'recuperar-senha' && <>
          {!resetSent ? <><p className="note">Informe seu e-mail para receber o link de recuperação.</p>
          <form onSubmit={e => submit(e, async data => { const address = String(data.get('email')).trim().toLowerCase(); await access.forgotPassword(address); setEmail(address); setResetSent(true); })}><fieldset className="plain" disabled={pending}>
            <label>E-mail<input name="email" type="email" autoComplete="email" placeholder="Seu e-mail" required maxLength={254}/></label><button type="submit">{pending ? 'Enviando…' : 'Enviar link de recuperação'}</button>
          </fieldset></form></> : <><p role="status" className="account-state">Se houver uma conta com esse e-mail, você receberá as instruções de recuperação.</p><p className="email-recipient"><strong>{email}</strong></p><button type="button" className="secondary" disabled={pending} onClick={() => void action(async () => { await access.forgotPassword(email); setNotice('Solicitação de recuperação reenviada.'); })}>{pending ? 'Enviando…' : 'Reenviar link de recuperação'}</button></>}
          <p className="access-bottom"><a href="#login">Voltar ao login</a></p>
        </>}
        {page === 'nova-senha' && <>
          <form onSubmit={e => submit(e, async data => { const password = String(data.get('password')); const confirmation = String(data.get('confirmation')); await access.resetPassword(password, confirmation, token); route('login'); setNotice('Senha atualizada. Entre com sua nova senha.'); })}><fieldset className="plain" disabled={pending}>
            <label>Nova senha<input name="password" type="password" autoComplete="new-password" required maxLength={128}/></label>
            <label>Confirme a nova senha<input name="confirmation" type="password" autoComplete="new-password" required maxLength={128}/></label><button type="submit">{pending ? 'Salvando…' : 'Salvar nova senha'}</button>
          </fieldset></form><p className="access-bottom"><a href="#recuperar-senha">Solicitar outro link</a></p>
        </>}
      </section>
    </div> : !user ? <p className="note">Carregando sua conta…</p> : <>
      {page === 'admin' ? user.role === 'admin' ? <>
        <div className="section-title page-title"><h1>Usuários</h1></div>
        {users === null ? <p className="empty">{loadFailed ? 'Não foi possível carregar os usuários.' : 'Carregando usuários…'}</p> : users.length ? <div className="table-wrap"><table aria-label="Usuários"><thead><tr><th>Nome</th><th>E-mail</th><th>Permissão</th><th>E-mail confirmado</th></tr></thead><tbody>{users.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td>{item.role === 'admin' ? 'Admin' : 'Usuário'}</td><td>{item.emailVerifiedAt ? 'Sim' : 'Não'}</td></tr>)}</tbody></table></div> : <p className="empty">Nenhum usuário encontrado.</p>}
      </> : <section className="access-card access-denied"><h1>Acesso restrito</h1><p>Você não tem permissão para acessar esta página.</p><a href="#conta">Voltar para minha conta</a></section> : ['painel', 'configuracoes', 'historico'].includes(page) ? <ClockPanel key={user.id} embedded page={page}/> : <>
        <div className="section-title page-title"><h1>Minha conta</h1></div>
        <div className="account-grid"><section className="access-card"><h2>{user.name}</h2><p>{user.email}</p><p className="account-state">{user.emailVerifiedAt ? 'E-mail confirmado' : 'Confirmação de e-mail pendente'}</p>{!user.emailVerifiedAt && <a href="#confirmar-email">Confirmar e-mail</a>}</section>
          <section className="access-card"><h2>Assinatura</h2>
            {user.role === 'admin' ? <p>Acesso administrativo.</p> : subscription === undefined ? <p>{loadFailed ? 'Não foi possível carregar a assinatura.' : 'Carregando assinatura…'}</p> : subscription ? <><p className="account-state">{subscriptionLabels[subscription.status]}</p>{subscription.trialEndsAt && subscription.status === 'trialing' && <p>Teste até {dateTime(subscription.trialEndsAt)}.</p>}{subscription.currentPeriodEndsAt && <p>Período atual até {dateTime(subscription.currentPeriodEndsAt)}.</p>}<button className="secondary" disabled={pending} onClick={() => void action(() => openBilling(true))}>Gerenciar assinatura</button></> : <><p>{TRIAL_DAYS} dias para conhecer a plataforma.</p><p className="note">O teste começa após cadastrar o cartão. Confira a mensalidade e a primeira cobrança antes de confirmar.</p><button disabled={pending || !user.emailVerifiedAt} onClick={() => void action(() => openBilling())}>{pending ? 'Abrindo…' : 'Cadastrar cartão e começar'}</button></>}
          </section></div>
      </>}
    </>}
    <footer><span>EasyClock Pro</span><span>Horário de São Paulo</span></footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App/>);
