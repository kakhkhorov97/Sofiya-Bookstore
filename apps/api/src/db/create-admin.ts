// There is no public way to become an admin. Create one from the command line:
//   npm run db:create-admin -w @sofiya/api -- you@example.com "a long password" "Your Name"
import bcrypt from 'bcryptjs';
import { SignUpInput } from '@sofiya/shared';
import { sql } from 'drizzle-orm';
import { createDb } from './client';
import { users } from './schema';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const [email, password, displayName = 'Store admin'] = process.argv.slice(2);
  const input = SignUpInput.parse({ email, password, displayName });

  const { db, close } = createDb(url, { max: 1 });
  try {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const updated = await db
      .update(users)
      .set({
        role: 'ADMIN',
        passwordHash,
        // The admin chose this address on the command line: it counts as confirmed.
        emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`,
        updatedAt: sql`now()`,
      })
      .where(sql`lower(${users.email}) = ${input.email}`)
      .returning({ id: users.id });
    if (updated.length === 0) {
      await db.insert(users).values({
        ...input,
        passwordHash,
        role: 'ADMIN',
        emailVerifiedAt: sql`now()`,
      });
    }
    console.log(`Admin ready: ${input.email}`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
