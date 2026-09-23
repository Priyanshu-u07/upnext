import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Singleton Prisma Client instance.
 *
 * Prisma 7 requires a driver adapter for database connections.
 * We use @prisma/adapter-pg which connects directly to PostgreSQL.
 *
 * The connection string comes from the DATABASE_URL environment variable.
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
