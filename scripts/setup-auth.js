#!/usr/bin/env node
// scripts/setup-auth.js
// Uso: node setup-auth.js <senha>
//      ou: node setup-auth.js (vai pedir interativamente)

const crypto = require('crypto');
const { execSync } = require('child_process');
const readline = require('readline');

function pbkdf2Hex(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
}

function randomSaltHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

async function promptPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question('Nova senha para Dra. Fernanda: ', answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const password = process.argv[2] || await promptPassword();
  if (!password || password.length < 6) {
    console.error('❌ Senha precisa ter ao menos 6 caracteres.');
    process.exit(1);
  }

  const salt = randomSaltHex(16);
  const hash = pbkdf2Hex(password, salt);
  const now = Date.now();

  const sql = `INSERT INTO auth (id, password_hash, salt, updated_at) VALUES (1, '${hash}', '${salt}', ${now}) ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, salt = excluded.salt, updated_at = excluded.updated_at;`;

  console.log('\n📝 SQL gerado:\n');
  console.log(sql);
  console.log('\n🚀 Executando via wrangler...\n');

  const isRemote = process.argv.includes('--remote') || !process.argv.includes('--local');
  const flag = isRemote ? '--remote' : '--local';

  try {
    execSync(`wrangler d1 execute laudosdafer-db ${flag} --command "${sql.replace(/"/g, '\\"')}"`, {
      stdio: 'inherit'
    });
    console.log(`\n✅ Senha configurada no ambiente ${isRemote ? 'PRODUÇÃO' : 'LOCAL'}`);
    console.log('A Dra. Fernanda já pode fazer login com essa senha.\n');
  } catch (err) {
    console.error('\n❌ Erro ao executar wrangler. Confira que está logado (wrangler login) e que o banco existe.');
    console.error('\nVocê também pode copiar o SQL acima e executar manualmente.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
