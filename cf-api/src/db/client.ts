import { drizzle } from 'drizzle-orm/d1';
import type { Env } from '../types';
import * as schema from './schema';

export function createDb(env: Pick<Env, 'DB'>) {
  return drizzle(env.DB, { schema });
}

export type AppDb = ReturnType<typeof createDb>;

