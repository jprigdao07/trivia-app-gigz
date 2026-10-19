// Usename: Admin
// Email: jprigdao076@gmail.com
// Password: 5star-trivia

require('dotenv').config();

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const readline = require('readline');

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Read the password without displaying it in the terminal.
function askHidden(question) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    let password = '';

    readline.emitKeypressEvents(input);
    process.stdout.write(question);

    if (input.isTTY) {
      input.setRawMode(true);
    }

    input.resume();

    function cleanup() {
      input.removeListener('keypress', onKeypress);

      if (input.isTTY) {
        input.setRawMode(false);
      }

      input.pause();
      process.stdout.write('\n');
    }

    function onKeypress(character, key) {
      if (key && key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Account creation cancelled.'));
        return;
      }

      if (key && (key.name === 'return' || key.name === 'enter')) {
        cleanup();
        resolve(password);
        return;
      }

      if (key && key.name === 'backspace') {
        password = password.slice(0, -1);
        return;
      }

      if (character && !(key && (key.ctrl || key.meta))) {
        password += character;
      }
    }

    input.on('keypress', onKeypress);
  });
}

async function main() {
  let connection;

  try {

    const username = await ask('Admin username: ');
    const email = await ask('Admin email: ');
    const password = await askHidden('Admin password (hidden): ');

    if (!username || !email || !password) {
      throw new Error('Username, email, and password are required.');
    }

    if (password.length < 12) {
      throw new Error('Use a password with at least 12 characters.');
    }

    if (password.length > 72) {
      throw new Error('Password must not exceed 72 characters.');
    }

    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!emailIsValid) {
      throw new Error('Please enter a valid email address.');
    }

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'trivia_quiz_app'
    });

    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, email]
    );

    if (existing.length > 0) {
      throw new Error('That username or email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await connection.execute(
      `INSERT INTO users
       (username, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'admin', 1)`,
      [username, email, passwordHash]
    );

    console.log('\nAdmin account created successfully.');
    console.log('Username:', username);
    console.log('Email:', email);
    console.log('Role: admin');
    console.log('You can now sign in through the Quiz App login page.');
  } catch (error) {
    console.error('\nAccount creation failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
