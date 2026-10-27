import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DbService } from '../db.service';

type UserRow = { id: number; email: string; pass: string };

function hashPassword(pass: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pass, salt, 64).toString('hex')}`;
}

function checkPassword(pass: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex'), b = scryptSync(pass, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly adminEmail = String(process.env.SUPERADMIN_EMAIL ?? '').trim().toLowerCase();

  constructor(private readonly dbs: DbService, private readonly jwt: JwtService) {}

  /** .env dagi SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD bo'yicha superadmin foydalanuvchini yaratadi yoki parolini yangilaydi */
  onModuleInit() {
    const pass = String(process.env.SUPERADMIN_PASSWORD ?? '');
    if (!this.adminEmail && !pass) return;
    if (!this.adminEmail || !pass) {
      console.warn('SUPERADMIN_EMAIL va SUPERADMIN_PASSWORD ikkalasi ham berilishi kerak — superadmin o‘tkazib yuborildi');
      return;
    }
    const u = this.dbs.db.prepare('SELECT id, pass FROM users WHERE email = ?').get(this.adminEmail) as Pick<UserRow, 'id' | 'pass'> | undefined;
    if (!u) this.dbs.db.prepare('INSERT INTO users (email, pass) VALUES (?, ?)').run(this.adminEmail, hashPassword(pass));
    else if (!checkPassword(pass, u.pass)) this.dbs.db.prepare('UPDATE users SET pass = ? WHERE id = ?').run(hashPassword(pass), u.id);
  }

  private token(u: { id: number; email: string }) {
    const admin = !!this.adminEmail && u.email === this.adminEmail;
    return this.jwt.signAsync({ sub: u.id, email: u.email, admin }).then(token => ({ token, user: { id: u.id, email: u.email, admin } }));
  }

  login(email: unknown, pass: unknown) {
    const e = String(email ?? '').trim().toLowerCase();
    const u = this.dbs.db.prepare('SELECT id, email, pass FROM users WHERE email = ?').get(e) as UserRow | undefined;
    if (!u || !checkPassword(String(pass ?? ''), u.pass)) throw new UnauthorizedException('Email yoki parol notoʻgʻri');
    return this.token(u);
  }
}
