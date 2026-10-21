import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PlatformSelection } from '../../components/redesign/tokenization/PlatformSelection';
import { LaunchBatchProgress } from '../../components/redesign/tokenization/LaunchBatchProgress';
import { AgentTokens } from '../../components/redesign/profile/AgentTokens';
import styles from '../../components/redesign/tokenization/tokenization.module.css';

const tokens = [
  { platform: 'pons', network: 'robinhood', symbol: 'SAGE', address: '0x2222222222222222222222222222222222222222', transactionHash: '0x' + 'a'.repeat(64) },
  { platform: 'bags', network: 'solana', symbol: 'SAGE', address: '8CrDTtkdDr54LsB9vQi1PZzVNmAA1KHkcts2EAK9W11z', transactionHash: '2'.repeat(88) },
  { platform: 'pump', network: 'solana', symbol: 'SAGE', address: 'CmKcjG6tvNy26z5CVd58mgPTs5RPzeJvmjGDvqXxpwLF', transactionHash: '3'.repeat(88) },
];
const variant = new URLSearchParams(location.search).get('tokens');
const profileTokens = variant === 'none' ? [] : variant === 'single' ? tokens.slice(0, 1) : variant === 'distinct' ? tokens.map((token, i) => ({ ...token, symbol: i ? 'SAGEAI' : 'SAGE' })) : tokens;
function App() {
  const [selected, setSelected] = useState([]), [step, setStep] = useState('select'), [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  return <main style={{ maxWidth: 720, margin: 'auto' }}>
    <h1>Agent token review</h1>
    <section className={styles.card}>
      {step === 'select' ? <PlatformSelection selected={selected} onChange={setSelected} busy={busy}
        options={tokens.map(token => ({ platform: token.platform, available: true }))}
        onResume={() => {}} onContinue={() => { setBusy(true); setTimeout(() => { setBusy(false); setStep('progress'); }, 350); }} />
        : <LaunchBatchProgress busy={busy} session={{ targets: selected.map((platform, i) => ({
          terms: { platform }, phase: i === 0 ? 'confirmed' : i === 1 ? blocked ? 'blocked' : 'failed' : 'queued',
          token: i === 0 ? tokens.find(token => token.platform === platform) : undefined,
          error: i === 1 ? 'The transaction needs another check.' : undefined,
        })), paused: true }} onContinue={() => {}} onRetry={() => setBlocked(true)} onSkip={() => setStep('select')}
          onCheck={() => { setBusy(true); setTimeout(() => setBusy(false), 350); }} />}
    </section>
    <AgentTokens tokens={profileTokens} />
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
