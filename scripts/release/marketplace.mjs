// Publishes to the Visual Studio Marketplace with Trusted Publishing (GitHub Actions OIDC).
//
//   node scripts/release/marketplace.mjs check            verify the policy works (no publish)
//   node scripts/release/marketplace.mjs publish <vsix>   publish a packaged extension
//
// The GitHub OIDC token (audience "marketplace.visualstudio.com") is exchanged for a
// Marketplace credential that lives 15 minutes; each OIDC token can be exchanged once, so
// every run asks for a fresh one. This is the same exchange `vsce publish --oidc` makes
// (microsoft/vscode-vsce src/oidc.ts); tfx-cli has no built-in OIDC support yet, so the
// credential is handed to `tfx extension publish` as a token, exactly like vsce uses it.
//
// Requirements: run inside GitHub Actions with `permissions: id-token: write`, and a
// Trusted Publishing policy on the Marketplace publisher for this repository + workflow.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKETPLACE = 'https://marketplace.visualstudio.com';
const AUDIENCE = 'marketplace.visualstudio.com';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'vss-extension.json'), 'utf8'));
const [command, vsix] = process.argv.slice(2);

async function requestJson(label, url, init) {
  const res = await fetch(url, init);
  const body = await res.text();
  if (!res.ok) {
    let detail = body.trim().slice(0, 500);
    try {
      const parsed = JSON.parse(body);
      detail = parsed.message ?? parsed.error_description ?? parsed.error ?? detail;
    } catch {
      // keep the raw body
    }
    throw new Error(`${label} failed with ${res.status} ${res.statusText}${detail ? `: ${detail}` : ''}`);
  }
  return JSON.parse(body);
}

async function getCredential(publisher) {
  const { ACTIONS_ID_TOKEN_REQUEST_URL: requestUrl, ACTIONS_ID_TOKEN_REQUEST_TOKEN: requestToken } = process.env;
  if (!requestUrl || !requestToken) {
    throw new Error(
      'No GitHub Actions OIDC token available. Run this in GitHub Actions with `permissions: id-token: write`.',
    );
  }

  const tokenUrl = new URL(requestUrl);
  tokenUrl.searchParams.set('audience', AUDIENCE);
  const { value: oidcToken } = await requestJson('GitHub OIDC token request', tokenUrl, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${requestToken}` },
  });
  if (!oidcToken) throw new Error('GitHub returned an empty OIDC token.');

  const { credential } = await requestJson(
    'Marketplace token exchange (is the Trusted Publishing policy configured for this repository and workflow?)',
    `${MARKETPLACE}/_apis/gallery/token?api-version=7.2-preview.1`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `FederatedToken ${oidcToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publisherName: publisher }),
    },
  );
  if (!credential) throw new Error('The Marketplace returned an empty credential.');
  // Never let the credential show up in logs.
  console.log(`::add-mask::${credential}`);
  return credential;
}

async function main() {
  const publisher = manifest.publisher;
  switch (command) {
    case 'check': {
      if (!process.env.GITHUB_ACTIONS) {
        // Local `semantic-release --dry-run`: nothing to verify against.
        console.log('Not running in GitHub Actions; skipping the Trusted Publishing check.');
        return;
      }
      await getCredential(publisher);
      console.log(`Trusted Publishing works for publisher "${publisher}".`);
      return;
    }
    case 'publish': {
      if (!vsix || !fs.existsSync(vsix)) throw new Error(`Package not found: ${vsix ?? '(none given)'}`);
      const token = await getCredential(publisher);
      execFileSync(
        'npx',
        ['--no-install', 'tfx', 'extension', 'publish', '--vsix', vsix, '--auth-type', 'pat', '--token', token, '--no-prompt'],
        { cwd: root, stdio: 'inherit' },
      );
      console.log(`Published ${path.basename(vsix)} to the Visual Studio Marketplace.`);
      return;
    }
    default:
      throw new Error('Usage: marketplace.mjs check | publish <vsix>');
  }
}

main().catch((err) => {
  console.error(`::error::${err.message}`);
  process.exit(1);
});
