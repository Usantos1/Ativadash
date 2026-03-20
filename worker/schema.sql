-- D1 (SQLite). Execute: npx wrangler d1 execute ativadash-db --remote --file=./schema.sql
-- Ou crie o banco no dashboard e rode as migrations.

CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Organization (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Membership (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  organizationId TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(userId, organizationId),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  FOREIGN KEY (organizationId) REFERENCES Organization(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS RefreshToken (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  userId TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Integration (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  platform TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  config TEXT,
  lastSyncAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organizationId, slug),
  FOREIGN KEY (organizationId) REFERENCES Organization(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS OAuthState (
  state TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_membership_org ON Membership(organizationId);
CREATE INDEX IF NOT EXISTS idx_membership_user ON Membership(userId);
CREATE INDEX IF NOT EXISTS idx_integration_org ON Integration(organizationId);
CREATE INDEX IF NOT EXISTS idx_oauthstate_expires ON OAuthState(expiresAt);
