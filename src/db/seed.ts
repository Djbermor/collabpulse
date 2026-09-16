import { bootstrapDatabase } from '../../server/bootstrap.ts';

/**
 * Seed entry point: ensures the clean initial bootstrap in PostgreSQL.
 * Does not insert any demo data or hardcoded mock entities.
 */
export async function seedDatabase() {
  await bootstrapDatabase();
}
