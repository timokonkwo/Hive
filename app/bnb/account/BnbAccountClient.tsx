"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useModalStatus, useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { ArrowRight, CircleUserRound, LogOut, Unplug, WalletCards } from "lucide-react";
import { BnbButtonLoader } from "@/app/bnb/_components/BnbButtonLoader";
import { BnbContainer } from "@/app/bnb/_components/BnbUi";
import { CopyValueButton } from "@/app/bnb/_components/CopyValueButton";
import { useAuth } from "@/hooks/useAuth";
import { getClientBnbChainId, getClientBnbNativeSymbol } from "@/lib/bnb/client-chain";
import styles from "./account.module.css";

type AuthUserView = {
  email?: { address?: string };
};

export function BnbAccountClient() {
  const { authenticated, connectWallet, login, logout, ready, user } = useAuth();
  const { address, chainId } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { isOpen: privyModalOpen } = useModalStatus();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [authReadyTimedOut, setAuthReadyTimedOut] = useState(false);

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
    if (!privyModalOpen && (action === "login" || action === "connect")) setAction("");
  }, [action, privyModalOpen]);

  useEffect(() => {
    if (ready || authenticated || address) {
      setAuthReadyTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => setAuthReadyTimedOut(true), 5_000);
    return () => window.clearTimeout(timeoutId);
  }, [address, authenticated, ready]);

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
    login({ loginMethods: ["wallet"], walletChainType: "ethereum-only" });
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

  async function signOut() {
    setAction("logout");
    setError("");
    try {
      await clearWalletSession();
      await logout();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Could not sign out.");
    } finally {
      setAction("");
    }
  }

  async function disconnectWallet() {
    setAction("disconnect");
    setError("");
    try {
      await clearWalletSession();
      const activeWallet = evmWallets.find((wallet) => wallet.address.toLowerCase() === address?.toLowerCase());
      activeWallet?.disconnect();
      await disconnectAsync();
      if (authenticated) await logout();
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Could not disconnect wallet.");
    } finally {
      setAction("");
    }
  }

  if (!ready && !authenticated && !address && !authReadyTimedOut) {
    return <BnbContainer className={styles.body}><div className={styles.loadingState} role="status"><BnbButtonLoader size={20} /><span>Loading account</span></div></BnbContainer>;
  }

  if (!authenticated && !address) {
    return (
      <BnbContainer className={styles.body}>
        <section className={styles.authState}>
          <CircleUserRound aria-hidden="true" size={21} />
          <h2>Sign in to Hive</h2>
          <p>Sign in with a wallet to view jobs and manage payments.</p>
          <button type="button" className="bnb-button bnb-focus" onClick={signInWithBnbWallet} disabled={signingIn} aria-busy={signingIn}>
            {signingIn ? <BnbButtonLoader /> : null}
            {signingIn ? "Opening wallet..." : "Sign in"}
          </button>
        </section>
      </BnbContainer>
    );
  }

  return (
    <BnbContainer className={styles.body}>
      {error ? <div className={styles.errorBand} role="alert">{error}</div> : null}

      <section className={styles.readiness} aria-labelledby="wallet-readiness-title">
        <div className={styles.readinessTitle}>
          <span className={styles.readinessIcon} data-state={address && onBnb ? "connected" : address ? "wrong-network" : "not-connected"} aria-hidden="true"><WalletCards size={18} /></span>
          <div>
            <span>Active wallet</span>
            <div className={styles.walletHeading}>
              <h2 id="wallet-readiness-title">{address ? shortAddress(address) : "Not connected"}</h2>
              {address ? <CopyValueButton value={address} label="wallet address" /> : null}
            </div>
          </div>
        </div>
        <dl className={styles.readinessFacts}>
          <AccountFact label="Network" value={address ? onBnb ? "BNB Smart Chain" : "Wrong network" : "Not connected"} />
          <AccountFact label="Signed in as" value={email || (address ? "Wallet session" : "Not signed in")} />
        </dl>
        <div className={styles.readinessActions}>
          <button type="button" className="bnb-button-dark bnb-focus" onClick={connectBnbWallet} disabled={connectingWallet} aria-busy={connectingWallet}>
            {connectingWallet ? <BnbButtonLoader /> : null}
            {connectingWallet ? "Opening wallet..." : address ? "Change wallet" : "Connect wallet"}
          </button>
          {address && !onBnb ? (
            <button type="button" className="bnb-button bnb-focus" onClick={switchToBnb} disabled={action === "switch"} aria-busy={action === "switch"}>
              {action === "switch" ? <BnbButtonLoader /> : null}
              {action === "switch" ? "Switching..." : "Switch network"}
            </button>
          ) : null}
          {address ? (
            <button type="button" className={`${styles.disconnect} bnb-focus`} onClick={() => void disconnectWallet()} disabled={action === "disconnect"} aria-busy={action === "disconnect"}>
              {action === "disconnect" ? <BnbButtonLoader /> : <Unplug aria-hidden="true" size={15} />}
              {action === "disconnect" ? "Disconnecting..." : "Disconnect wallet"}
            </button>
          ) : null}
        </div>
      </section>

      <aside className={styles.accountLinks} aria-labelledby="account-links-title">
        <div className={styles.sectionHeading}><div><span>Account</span><h2 id="account-links-title">Links</h2></div></div>
        <nav aria-label="Account links">
          <Link href="/bnb/activity" className="bnb-focus"><span><strong>Activity</strong><small>Jobs, requests, and alerts</small></span><ArrowRight aria-hidden="true" size={16} /></Link>
          <Link href={address ? `/bnb/status?address=${address}` : "/bnb/status"} className="bnb-focus"><span><strong>Verify wallet</strong><small>Check BNB Chain activity</small></span><ArrowRight aria-hidden="true" size={16} /></Link>
        </nav>
        {authenticated ? (
          <button type="button" className={styles.signOut} onClick={() => void signOut()} disabled={action === "logout"} aria-busy={action === "logout"}>
            {action === "logout" ? <BnbButtonLoader /> : <LogOut aria-hidden="true" size={15} />}
            {action === "logout" ? "Signing out..." : "Sign out"}
          </button>
        ) : null}
      </aside>
    </BnbContainer>
  );
}

function AccountFact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd><span>{value}</span></dd></div>;
}

function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

async function clearWalletSession() {
  const response = await fetch("/api/bnb/auth/session", { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error("Could not clear the wallet session.");
}
