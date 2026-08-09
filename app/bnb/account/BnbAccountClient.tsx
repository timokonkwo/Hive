"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { bsc } from "wagmi/chains";
import { useAccount, useSwitchChain } from "wagmi";
import { CheckCircle2, LogOut, UserRound, Wallet } from "lucide-react";
import { BnbContainer, BnbPanel } from "@/app/bnb/_components/BnbUi";
import { CopyValueButton } from "@/app/bnb/_components/CopyValueButton";
import { useAuth } from "@/hooks/useAuth";

type AuthUserView = {
  email?: {
    address?: string;
  };
};

export function BnbAccountClient() {
  const { authenticated, connectWallet, login, logout, ready, user } = useAuth();
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { wallets, ready: walletsReady } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const [action, setAction] = useState("");
  const [error, setError] = useState("");

  const evmWallets = useMemo(
    () => wallets.filter((wallet): wallet is ConnectedWallet => wallet.type === "ethereum"),
    [wallets],
  );
  const account = user as AuthUserView | undefined;
  const email = account?.email?.address || "";
  const onBnb = chainId === bsc.id;

  useEffect(() => {
    if (!authenticated || address || evmWallets.length === 0) return;
    setActiveWallet(evmWallets[0]).catch(() => undefined);
  }, [address, authenticated, evmWallets, setActiveWallet]);

  function connectBnbWallet() {
    setError("");
    connectWallet({
      walletChainType: "ethereum-only",
      description: "Connect the wallet you want to use on BNB Smart Chain.",
    });
  }

  async function switchToBnb() {
    setAction("switch");
    setError("");

    try {
      await switchChainAsync({ chainId: bsc.id });
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "Could not switch to BNB Smart Chain.");
    } finally {
      setAction("");
    }
  }

  async function selectWallet(wallet: ConnectedWallet) {
    setAction(`wallet:${wallet.address}`);
    setError("");

    try {
      await setActiveWallet(wallet);
    } catch (walletError) {
      setError(walletError instanceof Error ? walletError.message : "Could not switch wallet.");
    } finally {
      setAction("");
    }
  }

  if (!ready) {
    return (
      <BnbContainer className="bnb-section">
        <BnbPanel className="bnb-account-panel">
          <p>Loading account...</p>
        </BnbPanel>
      </BnbContainer>
    );
  }

  if (!authenticated) {
    return (
      <BnbContainer className="bnb-section">
        <BnbPanel className="bnb-account-panel bnb-account-auth">
          <div className="bnb-account-icon">
            <UserRound aria-hidden="true" size={20} />
          </div>
          <h2>Sign in to Hive</h2>
          <p>View your wallet, hires, requests, alerts, and payments from one account.</p>
          <button type="button" className="bnb-button bnb-focus" onClick={login}>
            Sign in
          </button>
        </BnbPanel>
      </BnbContainer>
    );
  }

  return (
    <BnbContainer className="bnb-section bnb-account-layout">
      <BnbPanel className="bnb-account-panel">
        <div className="bnb-account-panel-head">
          <div>
            <h2>Wallet</h2>
            <p>Use this wallet for BNB Chain hires, alerts, and payments.</p>
          </div>
          <span className={`bnb-chip ${address && onBnb ? "bnb-chip-active" : ""}`}>
            {address && onBnb ? "Ready" : address ? "Wrong network" : "No wallet"}
          </span>
        </div>

        <dl className="mt-5">
          {email ? <AccountRow label="Signed in as" value={email} /> : null}
          <AccountRow label="BNB wallet" value={address ? shortAddress(address) : "Not connected"} copyValue={address} />
          <AccountRow label="Network" value={address ? onBnb ? "BNB Smart Chain" : "Switch to BNB Chain" : "No wallet connected"} />
        </dl>

        <div className="bnb-account-actions">
          <button type="button" className="bnb-button bnb-focus" onClick={connectBnbWallet}>
            {address ? "Change wallet" : "Connect wallet"}
          </button>
          {address && !onBnb ? (
            <button type="button" className="bnb-button bnb-button-secondary bnb-focus" onClick={switchToBnb} disabled={action === "switch"}>
              {action === "switch" ? "Switching..." : "Switch network"}
            </button>
          ) : null}
          <button type="button" className="bnb-button-dark bnb-focus" onClick={() => void logout()}>
            <LogOut aria-hidden="true" size={15} />
            Sign out
          </button>
        </div>

        {error ? <p className="bnb-error mt-4 p-3 text-sm">{error}</p> : null}
      </BnbPanel>

      <BnbPanel className="bnb-account-panel">
        <div className="bnb-account-panel-head">
          <div>
            <h2>Wallets</h2>
            <p>Choose the wallet Hive should use for BNB transactions.</p>
          </div>
          <Wallet aria-hidden="true" size={18} />
        </div>

        {walletsReady && evmWallets.length > 0 ? (
          <div className="bnb-account-wallets">
            {evmWallets.map((wallet) => {
              const active = sameAddress(wallet.address, address);
              return (
                <button
                  key={`${wallet.walletClientType}:${wallet.address}`}
                  type="button"
                  className="bnb-account-wallet-row bnb-focus"
                  data-active={active ? "true" : undefined}
                  onClick={() => selectWallet(wallet)}
                  disabled={action === `wallet:${wallet.address}`}
                >
                  <span>
                    <strong>{wallet.meta?.name || wallet.walletClientType || "Wallet"}</strong>
                    <small>{shortAddress(wallet.address)}</small>
                  </span>
                  <span>{active ? <><CheckCircle2 aria-hidden="true" size={15} /> Active</> : action === `wallet:${wallet.address}` ? "Switching..." : "Use"}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bnb-account-empty">
            <p>No BNB wallet connected.</p>
            <button type="button" className="bnb-button-dark bnb-focus" onClick={connectBnbWallet}>
              Connect wallet
            </button>
          </div>
        )}

        <div className="bnb-account-links">
          <Link href={address ? `/bnb/status?address=${address}` : "/bnb/status"} className="bnb-text-action bnb-focus">
            Check wallet
          </Link>
          <Link href="#activity" className="bnb-text-action bnb-focus">
            View activity
          </Link>
        </div>
      </BnbPanel>
    </BnbContainer>
  );
}

function AccountRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  return (
    <div className="bnb-data-row">
      <dt>{label}</dt>
      <dd className="bnb-data-value">
        <span>{value}</span>
        {copyValue ? <CopyValueButton value={copyValue} label={label} /> : null}
      </dd>
    </div>
  );
}

function sameAddress(left?: string, right?: string) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}
