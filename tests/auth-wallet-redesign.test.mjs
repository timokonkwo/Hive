import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../hooks/useAuth.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const evm = { type: 'wallet', chainType: 'ethereum', address: `0x${'a'.repeat(40)}`, chainId: '4663', walletClientType: 'metamask' };
const solana = { type: 'wallet', chainType: 'solana', address: 'SolanaAccountAddress', walletClientType: 'phantom' };
function auth(user, { address = evm.address, stabilized = false } = {}) {
  const effects = [];
  let stateIndex = 0, logouts = 0;
  const imports = {
    '@privy-io/react-auth': { usePrivy: () => ({ user, authenticated: !!user, logout: async () => { logouts++; } }) },
    react: { useMemo: fn => fn(), useEffect: fn => effects.push(fn), useState: value => [stabilized ? (++stateIndex === 1 ? address : true) : value, () => {}] },
    wagmi: { useAccount: () => ({ address, isConnected: true }) },
    sonner: { toast: { info() {} } },
  };
  const m = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => imports[name], m, m.exports);
  const result = m.exports.useAuth();
  return { result, checkSwitch: () => effects.forEach(effect => effect()), logouts: () => logouts };
}

test('dual-wallet accounts prefer EVM while preserving canonical identity and linked Solana', () => {
  const user = { id: 'did:privy:owner', wallet: solana, linkedAccounts: [solana, evm] };
  const { result } = auth(user);
  assert.equal(result.user.id, user.id);
  assert.equal(result.user.wallet.address, evm.address);
  assert.equal(result.user.wallet.chainId, '4663');
  assert.equal(result.user.linkedAccounts[0].address, solana.address);
});
test('active primary EVM wallet wins over an older linked EVM wallet', () => {
  const current = { ...evm, address: `0x${'b'.repeat(40)}` };
  assert.equal(auth({ id: 'owner', wallet: current, linkedAccounts: [evm, current] }).result.user.wallet.address, current.address);
});
test('Solana-only, email-only and signed-out identities remain supported', () => {
  assert.equal(auth({ id: 'owner', linkedAccounts: [solana] }).result.user.wallet.address, solana.address);
  assert.equal(auth({ id: 'did:privy:email', linkedAccounts: [] }).result.user.wallet.address, 'did:privy:email');
  assert.equal(auth(null).result.user, null);
});
test('a Solana primary record does not sign out the matching linked EVM wallet', () => {
  const run = auth({ id: 'owner', wallet: solana, linkedAccounts: [solana, evm] }, { stabilized: true });
  run.checkSwitch();
  assert.equal(run.logouts(), 0);
});
test('switching the connected wallet preserves the signed-in account', () => {
  const run = auth({ id: 'owner', wallet: solana, linkedAccounts: [solana, evm] }, { address: `0x${'c'.repeat(40)}`, stabilized: true });
  run.checkSwitch();
  assert.equal(run.logouts(), 0);
});

test('wallet disconnect does not schedule logout or an auth stabilization timer', () => {
  const run = auth({id:'did:privy:owner',wallet:evm,linkedAccounts:[evm]}, {address:undefined,stabilized:true});
  run.checkSwitch();
  assert.equal(run.result.user.id,'did:privy:owner');
  assert.equal(run.logouts(),0);
});
