import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export type AuthUser = { id: number; email: string; admin?: boolean };

/** Authorization: Bearer <token> ni tekshiradi va req.user ni qo'yadi */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const [type, token] = String(req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Kirish talab qilinadi');
    try {
      const p = await this.jwt.verifyAsync<{ sub: number; email: string; admin?: boolean }>(token);
      req.user = { id: p.sub, email: p.email, admin: !!p.admin } satisfies AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException('Sessiya tugagan, qayta kiring');
    }
  }
}

export const User = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
