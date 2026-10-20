import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT NOT NULL, affected_hand TEXT NOT NULL,
  plan_sessions_per_week INTEGER NOT NULL DEFAULT 5, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, channel TEXT NOT NULL, status TEXT NOT NULL,
  creator TEXT NOT NULL, created_at TEXT NOT NULL, track_json TEXT NOT NULL, assets_json TEXT NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, lesson_id TEXT NOT NULL, started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL, gates_passed INTEGER NOT NULL, gates_total INTEGER NOT NULL, reps INTEGER NOT NULL,
  best_hold_sec REAL NOT NULL, avg_bpm REAL, sway_stops INTEGER NOT NULL, coach_tips INTEGER NOT NULL,
  easier_mode INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_profile ON sessions(profile_id, started_at);
CREATE TABLE IF NOT EXISTS gate_attempts (
  session_id TEXT NOT NULL, gate_id TEXT NOT NULL, type TEXT NOT NULL, ms_to_pass INTEGER,
  coached INTEGER NOT NULL, passed INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS coach_cache (
  key TEXT PRIMARY KEY, tip TEXT NOT NULL, lang TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  token TEXT PRIMARY KEY, profile_id TEXT NOT NULL, days INTEGER NOT NULL, created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
`;

/** Opens (and migrates) the SQLite database. Pass ":memory:" for tests. */
export function openDb(file: string): DatabaseSync {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

export type Db = DatabaseSync;
