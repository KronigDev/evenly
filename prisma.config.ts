import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7: connection config lives here (no `url` in the schema).
// The application client uses the node-postgres driver adapter (see src/lib/db.ts);
// the CLI (migrate/db) connects via this datasource url.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
