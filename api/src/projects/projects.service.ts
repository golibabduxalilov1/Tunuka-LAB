import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db.service';

type Row = { id: number; name: string; data: string; updated_at: string };

/** Buyurtmalar: har biri foydalanuvchiga tegishli, ma'lumot JSON ko'rinishida saqlanadi */
@Injectable()
export class ProjectsService {
  constructor(private readonly dbs: DbService) {}

  private clean(name: unknown, data: unknown) {
    const n = String(name ?? '').trim().slice(0, 120) || 'Buyurtma';
    if (!data || typeof data !== 'object' || !Array.isArray((data as { items?: unknown }).items)) throw new BadRequestException('Buyurtma maʼlumoti notoʻgʻri');
    return { name: n, json: JSON.stringify(data) };
  }

  list(userId: number) {
    return this.dbs.db.prepare('SELECT id, name, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC, id DESC').all(userId);
  }

  get(userId: number, id: number) {
    const r = this.dbs.db.prepare('SELECT id, name, data, updated_at FROM projects WHERE id = ? AND user_id = ?').get(id, userId) as Row | undefined;
    if (!r) throw new NotFoundException('Buyurtma topilmadi');
    return { id: r.id, name: r.name, updated_at: r.updated_at, data: JSON.parse(r.data) };
  }

  create(userId: number, name: unknown, data: unknown) {
    const v = this.clean(name, data);
    const r = this.dbs.db.prepare('INSERT INTO projects (user_id, name, data) VALUES (?, ?, ?)').run(userId, v.name, v.json);
    return { id: Number(r.lastInsertRowid) };
  }

  update(userId: number, id: number, name: unknown, data: unknown) {
    const v = this.clean(name, data);
    const r = this.dbs.db.prepare("UPDATE projects SET name = ?, data = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?").run(v.name, v.json, id, userId);
    if (!r.changes) throw new NotFoundException('Buyurtma topilmadi');
    return { ok: true };
  }

  remove(userId: number, id: number) {
    const r = this.dbs.db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(id, userId);
    if (!r.changes) throw new NotFoundException('Buyurtma topilmadi');
    return { ok: true };
  }
}
