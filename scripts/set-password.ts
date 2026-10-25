import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index';
import { users } from '../src/db/schema';

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error('Uso: npm run security:set-password -- <usuario> "<nueva_contraseña>"');
  process.exit(1);
}

if (password.length < 12) {
  console.error('La contraseña debe tener al menos 12 caracteres.');
  process.exit(1);
}

const user = db.select().from(users).where(eq(users.username, username)).get();

if (!user) {
  console.error(`No existe el usuario "${username}".`);
  process.exit(1);
}

db.update(users)
  .set({ passwordHash: bcrypt.hashSync(password, 12) })
  .where(eq(users.id, user.id))
  .run();

console.log(`Contraseña actualizada para "${username}".`);
