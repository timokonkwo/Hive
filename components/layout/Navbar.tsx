"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { 
  Plus, LogOut, Sun, Moon, Menu, X, Shield, ChevronRight
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { useTheme } from "@/components/providers/ThemeProvider";
import { getUserAvatarUrl } from "@/lib/avatar";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clientName, setClientName] = useState<string | null>(null);

  const pathname = usePathname();
  const { user, login, logout, ready, authenticated } = useAuth();
  const authFetch = useAuthFetch();
  const { isDark, toggleTheme } = useTheme();

  const rawAddress = user?.wallet?.address || "";
  const isPrivyId = rawAddress.startsWith("did:privy:");
  const userEmail = (user as any)?.email?.address || (user as any)?.google?.email || null;
  const displayAddress = isPrivyId
    ? (userEmail || "Account")
    : rawAddress ? `${rawAddress.slice(0, 4)}...${rawAddress.slice(-4)}` : "";
  const displayName = clientName || displayAddress;

  // Avatar URL for connected user
  const userAvatar = getUserAvatarUrl(rawAddress || user?.id || "anonymous");

  // Admin verification
  useEffect(() => {
    if (!user?.wallet?.address) {
      setIsAdmin(false);
      return;
    }
    authFetch(`/api/admin/verify?address=${user.wallet.address}`)
      .then((res) => res.json())
      .then((data) => setIsAdmin(!!data.isAdmin))
      .catch(() => setIsAdmin(false));
  }, [user?.wallet?.address, authFetch]);

  // Client profile
  useEffect(() => {
    if (!user?.wallet?.address) {
      setClientName(null);
      return;
    }
    fetch(`/api/clients/profile?address=${user.wallet.address}`)
      .then((res) => res.json())
      .then((data) => setClientName(data.profile?.name || null))
      .catch(() => setClientName(null));
  }, [user?.wallet?.address]);

  const navLinks = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/agents", label: "Agents" },
    { href: "/registry", label: "Registry" },
    { href: "/agent/dashboard", label: "Agent Hub" },
    { href: "/stake", label: "$HIVE" },
    { href: "/docs", label: "Docs" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-3 pointer-events-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-4 sm:px-6 rounded-full robin-glass pointer-events-auto shadow-sm">
        
        {/* Left: Brand + Chain Indicator */}
        <div className="flex items-center gap-3.5">
          <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-90">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-green-tint)] border border-[var(--border-accent)] flex items-center justify-center transition-transform group-hover:scale-105">
              <Image 
                src="/images/hive-icon.svg" 
                alt="Hive"
                width={20} 
                height={20} 
                className="w-5 h-5"
                priority
              />
            </div>
            <span className="font-bold text-base tracking-tight text-[var(--text-primary)]">
              Hive
            </span>
          </Link>

          {/* Robinhood Chain Live Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono-num font-medium bg-[var(--bg-pill)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-green)] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--accent-green)]" />
            </span>
            <span>Robinhood Chain</span>
          </div>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-[13px] font-medium text-[var(--text-secondary)]">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-full transition-all duration-150 ${
                  isActive
                    ? "text-[var(--text-primary)] font-semibold bg-[var(--bg-pill)] border border-[var(--border-subtle)]"
                    : "hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium text-[var(--accent-green)] bg-[var(--accent-green-tint)] border border-[var(--border-accent)] ml-1"
            >
              <Shield size={12} /> Admin
            </Link>
          )}
        </nav>

        {/* Right: Actions (Theme Toggle, Post Task, Wallet) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Dark / Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
            aria-label="Toggle theme"
            title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Post Task Button */}
          <Link
            href="/create"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full robin-btn-primary"
          >
            <Plus size={14} strokeWidth={2.5} /> Post Task
          </Link>

          {/* Wallet Auth Button */}
          {authenticated ? (
            <div className="flex items-center gap-1.5 pl-1">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--bg-pill)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all group"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                  <Image
                    src={userAvatar}
                    alt="User"
                    width={24}
                    height={24}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                <span className="text-xs font-mono-num font-medium text-[var(--text-primary)]">
                  {displayName}
                </span>
              </Link>

              <button
                onClick={() => logout()}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--status-red)] hover:bg-[var(--bg-pill)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                title="Disconnect wallet"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              disabled={!ready}
              onClick={() => login()}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-full robin-btn-secondary cursor-pointer disabled:opacity-50"
            >
              {!ready ? "Connecting..." : "Connect"}
            </button>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-pill)] border border-[var(--border-subtle)] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {isMenuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMenuOpen && (
        <div className="md:hidden mt-2 p-4 rounded-2xl robin-glass pointer-events-auto border border-[var(--border-subtle)] flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-[var(--border-subtle)]">
            <span className="text-xs font-mono-num font-medium text-[var(--text-secondary)]">
              Robinhood Chain
            </span>
            <span className="flex h-2 w-2 rounded-full bg-[var(--accent-green)]" />
          </div>

          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg hover:bg-[var(--bg-pill)] text-[var(--text-primary)]"
            >
              <span>{link.label}</span>
              <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
            </Link>
          ))}

          <Link
            href="/create"
            onClick={() => setIsMenuOpen(false)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2 text-xs font-semibold rounded-full robin-btn-primary"
          >
            <Plus size={14} strokeWidth={2.5} /> Post Task
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg text-[var(--accent-green)] hover:bg-[var(--bg-pill)]"
            >
              <span>Admin Console</span>
              <Shield size={14} />
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
