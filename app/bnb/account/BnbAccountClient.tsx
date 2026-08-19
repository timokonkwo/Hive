"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useModalStatus, useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useAccount, useSwitchChain } from "wagmi";
import { CheckCircle2, LogOut, UserRound, Wallet } from "lucide-react";
import { BnbButtonLoader } from "@/app/bnb/_components/BnbButtonLoader";
import { BnbContainer, BnbPanel } from "@/app/bnb/_components/BnbUi";
import { CopyValueButton } from "@/app/bnb/_components/CopyValueButton";
import { useAuth } from "@/hooks/useAuth";
import { getClientBnbChainId, getClientBnbNativeSymbol } from "@/lib/bnb/client-chain";

type AuthUserView = {
  email?: {
    address?: string;
  };
};

export function BnbAccountClient() {
  const { authenticated, connectWallet, login, logout, ready, user } = useAuth();
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { isOpen: privyModalOpen } = useModalStatus();
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
  const targetChainId = getClientBnbChainId();
  const nativeSymbol = getClientBnbNativeSymbol();
  const onBnb = chainId === targetChainId;
  const signingIn = action === "login" || privyModalOpen;
  const connectingWallet = action === "connect" || privyModalOpen;

  useEffect(() => {
    if (!privyModalOpen && (action === "login" || action === "connect")) {
      setAction("");
    }
  }, [action, privyModalOpen]);

  useEffect(() => {
    if (!authenticated || address || evmWallets.length === 0) return;
    setActiveWallet(evmWallets[0]).catch(() => undefined);
  }, [address, authenticated, evmWallets, setActiveWallet]);

  function connectBnbWallet() {
    setAction("connect");
    setError("");
    connectWallet({
      walletChainType: "ethereum-only",
      description: `Connect the wallet you want to use for ${nativeSymbol}.`,
    });
  }

  function signInWithBnbWallet() {
    setAction("login");
    setError("");
    login({
      loginMethods: ["wallet"],
      walletChainType: "ethereum-only",
    });
  }

  async function switchToBnb() {
    setAction("switch");
    setError("");

    try {
      await switchChainAsync({ chainId: targetChainId });
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

  async function signOut() {
    setAction("logout");
    setError("");

    try {
      await logout();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Could not sign out.");
    } finally {
      setAction("");
    }
  }

  if (!ready && !address) {
    return (
      <BnbContainer className="bnb-section">
        <BnbPanel className="bnb-account-panel">
          <p>Loading account...</p>
        </BnbPanel>
      </BnbContainer>
    );
  }

  if (!authenticated && !address) {
    return (
      <BnbContainer className="bnb-section">
        <BnbPanel className="bnb-account-panel bnb-account-auth">
          <div className="bnb-account-icon">
            <UserRound aria-hidden="true" size={20} />
          </div>
          <h2>Sign in to Hive</h2>
          <p>View your wallet, hires, requests, alerts, and payments from one account.</p>
          <button type="button" className="bnb-button bnb-focus" onClick={signInWithBnbWallet} disabled={signingIn} aria-busy={signingIn}>
            {signingIn ? <BnbButtonLoader /> : null}
            {signingIn ? "Opening wallet..." : "Sign in"}
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
            <p>Use this wallet for BNB hires, alerts, and payments.</p>
          </div>
          <span className={`bnb-chip ${address && onBnb ? "bnb-chip-active" : ""}`}>
            {address && onBnb ? "Ready" : address ? "Wrong network" : "No wallet"}
          </span>
        </div>

        <dl className="mt-5">
          {email ? <AccountRow label="Signed in as" value={email} /> : null}
          {!authenticated && address ? <AccountRow label="Signed in as" value="Wallet session" /> : null}
          <AccountRow label="BNB wallet" value={address ? shortAddress(address) : "Not connected"} copyValue={address} />
          <AccountRow label="Network" value={address ? onBnb ? `${nativeSymbol} network` : `Switch to ${nativeSymbol}` : "No wallet connected"} />
        </dl>

        <div className="bnb-account-actions">
          <button type="button" className="bnb-button bnb-focus" onClick={connectBnbWallet} disabled={connectingWallet} aria-busy={connectingWallet}>
            {connectingWallet ? <BnbButtonLoader /> : null}
            {connectingWallet ? "Opening wallet..." : address ? "Change wallet" : "Connect wallet"}
          </button>
          {address && !onBnb ? (
            <button type="button" className="bnb-button bnb-button-secondary bnb-focus" onClick={switchToBnb} disabled={action === "switch"} aria-busy={action === "switch"}>
              {action === "switch" ? <BnbButtonLoader /> : null}
              {action === "switch" ? "Switching..." : "Switch network"}
            </button>
          ) : null}
          {authenticated ? (
            <button type="button" className="bnb-button-dark bnb-focus" onClick={() => void signOut()} disabled={action === "logout"} aria-busy={action === "logout"}>
              {action === "logout" ? <BnbButtonLoader /> : <LogOut aria-hidden="true" size={15} />}
              {action === "logout" ? "Signing out..." : "Sign out"}
            </button>
          ) : null}
        </div>

        {error ? <p className="bnb-error mt-4 p-3 text-sm">{error}</p> : null}
      </BnbPanel>

      <BnbPanel className="bnb-account-panel">
        <div className="bnb-account-panel-head">
          <div>
            <h2>Wallets</h2>
            <p>Choose the wallet Hive should use for {nativeSymbol} transactions.</p>
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
                  aria-busy={action === `wallet:${wallet.address}`}
                >
                  <span>
                    <strong>{wallet.meta?.name || wallet.walletClientType || "Wallet"}</strong>
                    <small>{shortAddress(wallet.address)}</small>
                  </span>
                  <span>{active ? <><CheckCircle2 aria-hidden="true" size={15} /> Active</> : action === `wallet:${wallet.address}` ? <><BnbButtonLoader /> Switching...</> : "Use"}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bnb-account-empty">
            <p>No BNB wallet connected.</p>
            <button type="button" className="bnb-button-dark bnb-focus" onClick={connectBnbWallet} disabled={connectingWallet} aria-busy={connectingWallet}>
              {connectingWallet ? <BnbButtonLoader /> : null}
              {connectingWallet ? "Opening wallet..." : "Connect wallet"}
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
