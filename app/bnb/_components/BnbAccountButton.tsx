"use client";

import Link from "next/link";
import { useState } from "react";
import { useModalStatus } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { UserRound } from "lucide-react";
import { BnbButtonLoader } from "@/app/bnb/_components/BnbButtonLoader";
import { useAuth } from "@/hooks/useAuth";

export function BnbAccountButton({ active = false }: { active?: boolean }) {
  const { authenticated, login, ready } = useAuth();
  const { address } = useAccount();
  const { isOpen } = useModalStatus();
  const [signingIn, setSigningIn] = useState(false);

  function signInWithBnbWallet() {
    setSigningIn(true);
    window.setTimeout(() => setSigningIn(false), 1200);
    login({
      loginMethods: ["wallet"],
      walletChainType: "ethereum-only",
    });
  }

  if (!ready) {
    return (
      <button type="button" className="bnb-account-button bnb-focus" disabled>
        <UserRound aria-hidden="true" size={15} />
        <span className="bnb-account-desktop-label">Account</span>
        <span className="bnb-account-mobile-label">Account</span>
      </button>
    );
  }

  if (!authenticated && !address) {
    const busy = signingIn || isOpen;
    return (
      <button type="button" className="bnb-account-button bnb-focus" onClick={signInWithBnbWallet} disabled={busy} aria-busy={busy}>
        {busy ? <BnbButtonLoader /> : <UserRound aria-hidden="true" size={15} />}
        <span className="bnb-account-desktop-label">{busy ? "Signing in" : "Sign in"}</span>
        <span className="bnb-account-mobile-label">{busy ? "Signing in" : "Sign in"}</span>
      </button>
    );
  }

  return (
    <Link href="/account" className="bnb-account-button bnb-focus" data-active={active ? "true" : undefined}>
      <UserRound aria-hidden="true" size={15} />
      <span className="bnb-account-desktop-label">{address ? shortAddress(address) : "Account"}</span>
      <span className="bnb-account-mobile-label">Account</span>
    </Link>
  );
}

function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}
