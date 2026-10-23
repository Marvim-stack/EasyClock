export function validateProductionEnvironment(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== 'production') return;
  const required = ['APP_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'DATABASE_URL', 'EASYCLOCK_CREDENTIALS_KEY'];
  const missing = required.filter(name => !env[name]?.trim());
  if (missing.length) throw new Error(`Configure o ambiente de produção: ${missing.join(', ')}.`);
  let url: URL;
  try { url = new URL(env.APP_URL!); }
  catch { throw new Error('APP_URL precisa ser um endereço HTTPS público.'); }
  if (url.protocol !== 'https:' || url.origin !== env.APP_URL || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('APP_URL precisa ser um endereço HTTPS público, sem caminho nem barra final.');
  if (Buffer.from(env.EASYCLOCK_CREDENTIALS_KEY!, 'base64').length !== 32)
    throw new Error('EASYCLOCK_CREDENTIALS_KEY precisa conter 32 bytes em base64.');
}
