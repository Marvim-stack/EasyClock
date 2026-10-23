import { Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AccessRequestGuard } from './access.controller';
import { SupabaseAccess } from './supabase-access';
import { accountDatabase } from './account-database';
import { Clocks, hasAccounts } from './clocks';
import type { Clock } from './clock';
import type { User } from './accounts';

type ClockRequest = IncomingMessage & { clock: Clock; user?: User };
export class ClockGuard implements CanActivate {
  constructor(@Inject(Clocks) private readonly clocks: Clocks) {}
  async canActivate(context: ExecutionContext) {
    new AccessRequestGuard().canActivate(context);
    const http = context.switchToHttp();
    const req = http.getRequest<ClockRequest>();
    if (hasAccounts()) {
      req.user = await new SupabaseAccess(req, http.getResponse<ServerResponse>()).user();
      req.clock = this.clocks.forUser(req.user.id);
    } else {
      if (req.headers['x-easyclock'] !== 'local') throw new ForbiddenException();
      req.clock = this.clocks.local();
    }
    return true;
  }
}

@UseGuards(ClockGuard)
@Controller('api')
export class ClockController {
  @Get('status') async status(@Req() req: ClockRequest) {
    const automationAllowed = req.user ? await accountDatabase.canAutomate(req.user.id) : true;
    if (!automationAllowed && req.clock.status().enabled) req.clock.pause();
    return { ...req.clock.status(), automationAllowed };
  }
  @Post('toggle') toggle(@Req() req: ClockRequest) { return req.clock.toggle(); }
  @Post('test') test(@Req() req: ClockRequest) { return req.clock.test(); }
  @Post('connect') connect(@Req() req: ClockRequest) { return req.clock.connect(); }
  @Post('variation') variation(@Req() req: ClockRequest, @Body() input: unknown) { return req.clock.setVariation(input); }
  @Get('settings') settings(@Req() req: ClockRequest) { return req.clock.getSettings(); }
  @Post('settings') update(@Req() req: ClockRequest, @Body() input: unknown) { return req.clock.updateSettings(input); }
  @Get('history') history(@Req() req: ClockRequest, @Query('page') page: string) { return req.clock.getHistory(page); }
  @Get('punches') punches(@Req() req: ClockRequest) { return req.clock.getPunches(); }
  @Post('punches/sync') sync(@Req() req: ClockRequest) { return req.clock.syncPunches(); }
}
