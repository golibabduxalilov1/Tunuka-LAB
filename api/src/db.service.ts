import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';

const DATA_DIR = resolve(process.env.DATA_DIR ?? 'data');

/** JWT kaliti: JWT_SECRET muhit o'zgaruvchisi yoki data/jwt.secret (birinchi ishga tushishda yaratiladi) */
export function jwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = resolve(DATA_DIR, 'jwt.secret');
  if (!existsSync(file)) {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(file, randomBytes(48).toString('hex'), { mode: 0o600 });
  }
  return readFileSync(file, 'utf8').trim();
}

/** SQLite (Node 24 ichki node:sqlite) — foydalanuvchilar va buyurtmalar */
@Injectable()
export class DbService implements OnModuleDestroy {
  readonly db: DatabaseSync;

  constructor() {
    const file = resolve(DATA_DIR, 'tunukalab.db');
    mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        pass TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS projects_user ON projects(user_id);
    `);
  }

  onModuleDestroy() {
    this.db.close();
  }
}
