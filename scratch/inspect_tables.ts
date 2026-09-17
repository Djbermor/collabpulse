import { pool } from '../src/db/index';

async function main() {
  const tables = ['conversations', 'conversation_members', 'messages', 'message_reactions', 'files'];
  for (const table of tables) {
    const cols = await pool.query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position;",
      [table]
    );
    console.log(`\n--- TABLE: ${table} ---`);
    console.log(cols.rows.map(c => `${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`).join('\n'));
  }
  process.exit(0);
}

main().catch(console.error);
