import { BadRequestException, Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { validatePassword, validateRegistration } from './accounts';
import { appUrl, authError, SupabaseAccess, unavailable } from './supabase-access';
import { accountDatabase } from './account-database';

function fields(input: unknown, names: string[]): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Confira os dados informados.');
  const values = input as Record<string, unknown>;
  if (names.some(name => typeof values[name] !== 'string')) throw new BadRequestException('Confira os dados informados.');
  return values as Record<string, string>;
}
function email(value: string): string {
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new BadRequestException('Informe um e-mail válido.');
  return value.trim().toLowerCase();
}
function token(input: unknown): string {
  const value = fields(input, ['token']).token;
  if (!value || value.length > 4096) throw new BadRequestException('Este link é inválido. Solicite outro.');
  return value;
}

export class AccessRequestGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const req = http.getRequest<IncomingMessage>();
    http.getResponse<ServerResponse>().setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'GET') {
      // O cabeçalho exige preflight em outra origem; a API não habilita CORS.
      if (req.headers['x-easyclock-request'] !== '1') throw new ForbiddenException('Solicitação inválida. Recarregue a página.');
      if (req.headers.origin && req.headers.origin !== new URL(appUrl()).origin) throw new ForbiddenException('Origem da solicitação não permitida.');
    }
    return true;
  }
}

@UseGuards(AccessRequestGuard)
@Controller('api/access')
export class AccessController {
  @Get('session') async session(@Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    return { user: await new SupabaseAccess(req, res).user() };
  }
  @Post('login') async login(@Body() input: unknown, @Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    const value = fields(input, ['email', 'password']);
    const address = email(value.email);
    if (!value.password || value.password.length > 128) throw new BadRequestException('Informe sua senha.');
    const scope = new SupabaseAccess(req, res);
    const { error } = await scope.client.auth.signInWithPassword({ email: address, password: value.password });
    authError(error, 'Não foi possível entrar. Confira seu e-mail e sua senha.');
    return { user: await scope.user() };
  }
  @Post('register') async register(@Body() input: unknown, @Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    const value = fields(input, ['name', 'email', 'password', 'confirmation']);
    let registration: { name: string; email: string };
    try { registration = validateRegistration({ name: value.name, email: value.email, password: value.password, confirmation: value.confirmation }); }
    catch (error) { throw new BadRequestException((error as Error).message); }
    const client = new SupabaseAccess(req, res).emailClient();
    const { data, error } = await client.auth.signUp({ email: registration.email, password: value.password, options: { data: { name: registration.name }, emailRedirectTo: `${appUrl()}/#confirmar-email` } });
    authError(error, 'Não foi possível criar a conta. Tente novamente em breve.');
    // A confirmação de e-mail precisa estar habilitada também no Supabase.
    if (data.session) { await client.auth.signOut({ scope: 'local' }); throw unavailable(); }
    return { email: registration.email };
  }
  @HttpCode(204)
  @Post('email/confirm') async confirmEmail(@Body() input: unknown, @Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    const hash = token(input);
    const client = new SupabaseAccess(req, res).emailClient();
    const { error } = await client.auth.verifyOtp({ token_hash: hash, type: 'email' });
    authError(error, 'Não foi possível confirmar o e-mail. Solicite outro link.');
    await client.auth.signOut({ scope: 'local' });
  }
  @HttpCode(204)
  @Post('email/resend') async resendEmail(@Body() input: unknown, @Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    const address = email(fields(input, ['email']).email);
    const { error } = await new SupabaseAccess(req, res).emailClient().auth.resend({ type: 'signup', email: address, options: { emailRedirectTo: `${appUrl()}/#confirmar-email` } });
    if (error?.code !== 'user_not_found') authError(error, 'Não foi possível enviar as instruções. Tente novamente em breve.');
  }
  @HttpCode(204)
  @Post('password/forgot') async forgotPassword(@Body() input: unknown, @Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    const address = email(fields(input, ['email']).email);
    const { error } = await new SupabaseAccess(req, res).emailClient().auth.resetPasswordForEmail(address, { redirectTo: `${appUrl()}/#nova-senha` });
    if (error?.code !== 'user_not_found') authError(error, 'Não foi possível enviar as instruções. Tente novamente em breve.');
  }
  @HttpCode(204)
  @Post('password/reset') async resetPassword(@Body() input: unknown, @Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    const value = fields(input, ['password', 'confirmation', 'token']);
    const hash = token(value);
    try { validatePassword(value.password, value.confirmation); }
    catch (error) { throw new BadRequestException((error as Error).message); }
    const client = new SupabaseAccess(req, res).emailClient();
    const verification = await client.auth.verifyOtp({ token_hash: hash, type: 'recovery' });
    authError(verification.error, 'Este link é inválido. Solicite outro para redefinir sua senha.');
    const update = await client.auth.updateUser({ password: value.password });
    authError(update.error, 'Não foi possível atualizar a senha. Solicite um novo link e tente novamente.');
    const logout = await client.auth.signOut({ scope: 'global' });
    authError(logout.error, 'Senha atualizada. Não foi possível encerrar as sessões anteriores.');
  }
  @HttpCode(204)
  @Post('logout') async logout(@Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    const { error } = await new SupabaseAccess(req, res).client.auth.signOut({ scope: 'local' });
    authError(error, 'Não foi possível encerrar a sessão. Tente novamente.');
  }
  @Get('subscription') async subscription(@Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    const scope = new SupabaseAccess(req, res);
    return { subscription: await scope.subscription(await scope.user()) };
  }
  @Get('admin/users') async users(@Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    const user = await new SupabaseAccess(req, res).user();
    if (user.role !== 'admin') throw new ForbiddenException('Acesso restrito à administração.');
    return { users: await accountDatabase.users(user) };
  }
  @Post('billing/checkout') checkout() { throw unavailable(); }
  @Post('billing/portal') billingPortal() { throw unavailable(); }
}
