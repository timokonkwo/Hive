"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function BnbAccountButton({ active = false }: { active?: boolean }) {
  const { authenticated, login, ready } = useAuth();
  const { address } = useAccount();

  if (!ready) {
    return (
      <button type="button" className="bnb-account-button bnb-focus" disabled>
        <UserRound aria-hidden="true" size={15} />
        <span className="bnb-account-desktop-label">Account</span>
        <span className="bnb-account-mobile-label">Account</span>
      </button>
    );
  }

  if (!authenticated) {
    return (
      <button type="button" className="bnb-account-button bnb-focus" onClick={login}>
        <UserRound aria-hidden="true" size={15} />
        <span className="bnb-account-desktop-label">Sign in</span>
        <span className="bnb-account-mobile-label">Sign in</span>
      </button>
    );
  }

  return (
    <Link href="/bnb/account" className="bnb-account-button bnb-focus" data-active={active ? "true" : undefined}>
      <UserRound aria-hidden="true" size={15} />
      <span className="bnb-account-desktop-label">{address ? shortAddress(address) : "Account"}</span>
      <span className="bnb-account-mobile-label">Account</span>
    </Link>
  );
}

function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}
