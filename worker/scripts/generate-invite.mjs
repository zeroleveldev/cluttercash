import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DEFAULT_API_URL = 'https://cluttercash-api.zeroleveldev.workers.dev';

function readVariable(text, name) {
  const line = text
    .split(/\r?\n/)
    .find((candidate) => candidate.trim().startsWith(`${name}=`));
  if (!line) return '';
  const value = line.slice(line.indexOf('=') + 1).trim();
  return value.replace(/^(['"])(.*)\1$/, '$2');
}

export async function generateInvite({
  email,
  envText,
  apiUrl = DEFAULT_API_URL,
  fetcher = fetch,
}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Pass the approved tester email: npm run invite -- tester@example.com');
  }
  const adminKey = readVariable(envText, 'ADMIN_API_KEY');
  if (adminKey.length < 32) {
    throw new Error('ADMIN_API_KEY is missing from worker/.dev.vars.');
  }
  const response = await fetcher(
    `${apiUrl.replace(/\/$/, '')}/v1/admin/invites`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminKey}`,
      },
      body: JSON.stringify({ email: normalizedEmail }),
    },
  );
  let body = {};
  try {
    body = await response.json();
  } catch {
    // The status-specific error below is safer than printing an unknown body.
  }
  if (!response.ok || typeof body.inviteCode !== 'string') {
    throw new Error(body.error || `Invite generation failed (${response.status}).`);
  }
  return { inviteCode: body.inviteCode, email: normalizedEmail };
}

async function main() {
  const email = process.argv[2];
  const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const envText = await readFile(path.join(workerRoot, '.dev.vars'), 'utf8');
  const result = await generateInvite({ email, envText });
  console.log(`Approved tester: ${result.email}`);
  console.log(`Invite code: ${result.inviteCode}`);
  console.log('Send this code to the tester privately. It is shown only this once.');
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Invite generation failed.');
    process.exitCode = 1;
  });
}
