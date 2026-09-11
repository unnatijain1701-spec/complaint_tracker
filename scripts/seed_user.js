// Interactive CLI to add or update a team member's login. Real names,
// emails, and passwords are the sales ops team's own — this script just
// hashes and stores whatever you give it. Run with: npm run seed:user
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcrypt');
const db = require('../db');

function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function run() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const name = await prompt(rl, 'Name: ');
  const email = await prompt(rl, 'Email: ');
  console.log('(password will be echoed to the terminal — run this somewhere private)');
  const password = await prompt(rl, 'Password: ');
  rl.close();

  if (!name || !email || !password) {
    console.error('Name, email, and password are all required.');
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash`,
    [name, email.toLowerCase(), passwordHash]
  );

  console.log(`Saved login for ${email}.`);
}

run()
  .catch((err) => {
    console.error('Failed to seed user:', err);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
