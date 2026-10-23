export function validateProductionEnvironment(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== 'production') return;
  for (const name of ['APP_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'DATABASE_URL', 'EASYCLOCK_CREDENTIALS_KEY']) {
    if (!env[name]?.trim()) throw new Error(`Configuração de produção ausente: ${name}`);
  }
  for (const name of ['APP_URL', 'SUPABASE_URL']) {
    let url: URL;
    try { url = new URL(env[name]!); }
    catch { throw new Error(`URL de produção inválida: ${name}`); }
    if (url.protocol !== 'https:' || url.username || url.password || url.origin !== env[name]) {
      throw new Error(`Use uma origem HTTPS sem caminho em ${name}`);
    }
  }
  if (Buffer.from(env.EASYCLOCK_CREDENTIALS_KEY!, 'base64').length !== 32) {
    throw new Error('EASYCLOCK_CREDENTIALS_KEY precisa conter 32 bytes em base64.');
  }
}
