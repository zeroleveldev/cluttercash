import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateInvite } from '../scripts/generate-invite.mjs';

test('owner invite command reads the private admin key and prints only the newly generated code', async () => {
  let request;
  const result = await generateInvite({
    email: 'tester@example.com',
    envText: 'ADMIN_API_KEY=private-admin-key-at-least-32-bytes\n',
    apiUrl: 'https://api.example',
    fetcher: async (url, options) => {
      request = { url, options };
      return Response.json({
        inviteCode: 'CC-NEW-VALID-CODE',
        email: 'tester@example.com',
      }, { status: 201 });
    },
  });

  assert.equal(request.url, 'https://api.example/v1/admin/invites');
  assert.equal(
    request.options.headers.Authorization,
    'Bearer private-admin-key-at-least-32-bytes',
  );
  assert.deepEqual(JSON.parse(request.options.body), {
    email: 'tester@example.com',
  });
  assert.deepEqual(result, {
    inviteCode: 'CC-NEW-VALID-CODE',
    email: 'tester@example.com',
  });
});
