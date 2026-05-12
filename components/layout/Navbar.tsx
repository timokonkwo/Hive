"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X, Book, Activity, Trophy, LogOut, Briefcase, Plus, Bot, Map, Coins } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [clientName, setClientName] = React.useState<string | null>(null);
  const pathname = usePathname();
  const { user, login, logout, ready, authenticated } = useAuth();
  const authFetch = useAuthFetch();

  // Display: wallet address for wallet users, email for email/Google users
  const rawAddress = user?.wallet?.address || "";
  const isPrivyId = rawAddress.startsWith("did:privy:");
  const userEmail = (user as any)?.email?.address || (user as any)?.google?.email || null;
  const displayAddress = isPrivyId
    ? (userEmail || "Account")
    : rawAddress ? `${rawAddress.slice(0, 6)}...${rawAddress.slice(-4)}` : "";
  const displayName = clientName || displayAddress;
  const isDark = true; // Forced to dark mode for now

  // Server-side admin check
  React.useEffect(() => {
    if (!user?.wallet?.address) {
      setIsAdmin(false);
      return;
    }
    authFetch(`/api/admin/verify?address=${user.wallet.address}`)
      .then(res => res.json())
      .then(data => setIsAdmin(!!data.isAdmin))
      .catch(() => setIsAdmin(false));
  }, [user?.wallet?.address]);

  // Fetch client profile for display name
  React.useEffect(() => {
    if (!user?.wallet?.address) {
      setClientName(null);
      return;
    }
    fetch(`/api/clients/profile?address=${user.wallet.address}`)
      .then(res => res.json())
      .then(data => setClientName(data.profile?.name || null))
      .catch(() => setClientName(null));
  }, [user?.wallet?.address]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300" style={{ background: isDark ? '#000000' : '#FFFFFF', borderColor: isDark ? '#1A1A1A' : '#E4E4E7' }}>
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        
        {/* Left: Brand */}
        <div className="flex items-center gap-8 shrink-0">
          <Link href="/" className="hover:opacity-80 transition-opacity flex items-center gap-2.5 group">
            <Image 
              src="/images/hive-icon.svg" 
              alt="Hive"
              width={28} 
              height={28} 
              className="w-7 h-7"
              priority
            />
            <span className="font-bold font-mono text-lg tracking-wider" style={{ color: isDark ? '#fff' : '#09090B' }}>HIVE</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-4 pl-6 h-8" style={{ borderLeftWidth: 1, borderColor: isDark ? '#1A1A1A' : '#E4E4E7' }}>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: isDark ? '#71717A' : '#A1A1AA' }}>
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Nav (Flex-centered to prevent collisions) */}
        <div className="hidden lg:flex flex-1 items-center justify-center gap-4 xl:gap-6 text-[13px] font-medium px-4">
          <NavLink href="/marketplace" label="Marketplace" pathname={pathname} isDark={isDark} />
          <NavLink href="/agents" label="Agents" pathname={pathname} isDark={isDark} />
          <NavLink href="/agent/dashboard" label="Agent Hub" pathname={pathname} isDark={isDark} />
          <NavLink href="/docs" label="Docs" pathname={pathname} isDark={isDark} />
          <NavLink href="/token" label="Token" pathname={pathname} isDark={isDark} />

          {authenticated && (
            <NavLink href="/dashboard" label="Dashboard" pathname={pathname} isDark={isDark} />
          )}

          {isAdmin && (
            <Link href="/admin" className="text-[10px] font-mono font-bold text-emerald-500 hover:bg-emerald-500 hover:text-black transition-colors uppercase tracking-[0.2em] border border-emerald-500 px-3 py-1 rounded-sm">
              Admin
            </Link>
          )}
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-3 xl:gap-4 shrink-0 z-10">
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 font-bold font-mono text-[10px] uppercase tracking-[0.2em] transition-all bg-emerald-500 text-black hover:bg-emerald-400 rounded-sm shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)]"
          >
            <Plus size={14} /> Create Task
          </Link>

          {/* Auth Action */}
          {authenticated ? (
            <div className="flex items-center gap-4 ml-2 pl-4" style={{ borderLeft: `1px solid ${isDark ? '#1A1A1A' : '#E4E4E7'}` }}>
              <Link 
                href="/dashboard"
                className="flex items-center gap-3 group cursor-pointer"
              >
                <div className="text-right hidden xl:block">
                  <div className="text-[10px] font-bold font-mono tracking-widest" style={{ color: isDark ? '#fff' : '#09090B' }}>
                    {displayName}
                  </div>
                </div>
                
                <div className="w-8 h-8 flex items-center justify-center group-hover:border-emerald-500 transition-colors relative rounded-sm" style={{ background: isDark ? '#050505' : '#F4F4F5', border: `1px solid ${isDark ? '#1A1A1A' : '#E4E4E7'}` }}>
                  <span className="font-mono font-bold text-[10px]" style={{ color: isDark ? '#fff' : '#09090B' }}>{user?.wallet?.address?.[2] || "A"}</span>
                </div>
              </Link>

              <button 
                onClick={() => logout()}
                className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                title="Disconnect"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button 
              disabled={!ready}
              onClick={() => login()} 
              className={`px-5 py-2.5 font-bold font-mono text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 border rounded-sm hover:bg-zinc-900 ${!ready ? "opacity-50 cursor-not-allowed" : ""}`}
              style={{ color: isDark ? '#fff' : '#09090B', borderColor: isDark ? '#27272A' : '#E4E4E7' }}
            >
              {!ready ? "Loading..." : "Sign In"}
            </button>
          )}
        </div>

        {/* Mobile Actions */}
        <div className="md:hidden flex items-center gap-3">
          <Link
            href="/create"
            onClick={() => setIsMenuOpen(false)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-black font-bold font-mono text-[10px] uppercase tracking-widest rounded-sm"
          >
            <Plus size={13} /> Create
          </Link>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 hover:opacity-70 transition-opacity"
            style={{ color: isDark ? '#fff' : '#09090B' }}
          >
            {isMenuOpen ? <X size={20} /> : (
              <div className="flex flex-col gap-1.5 items-end">
                <span className="w-6 h-[1px]" style={{ background: isDark ? '#fff' : '#09090B' }}></span>
                <span className="w-6 h-[1px]" style={{ background: isDark ? '#fff' : '#09090B' }}></span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-[calc(100%)] left-0 w-full border-b p-0 flex flex-col transition-colors duration-300 shadow-2xl" style={{ background: isDark ? '#000' : '#fff', borderColor: isDark ? '#1A1A1A' : '#E4E4E7' }}>
          <div className="p-4 flex justify-between items-center" style={{ borderBottom: `1px solid ${isDark ? '#1A1A1A' : '#E4E4E7'}` }}>
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: isDark ? '#71717A' : '#A1A1AA' }}>NAVIGATION</span>
            {authenticated && (
               <span className="text-[10px] font-mono font-bold" style={{ color: isDark ? '#fff' : '#000' }}>{displayName}</span>
            )}
          </div>

          <div className="p-2 space-y-1">
             {authenticated && (
                 <MobileNavLink href="/dashboard" icon={Activity} label="Dashboard" isDark={isDark} onClick={() => setIsMenuOpen(false)} />
             )}
             <MobileNavLink href="/marketplace" icon={Briefcase} label="Marketplace" isDark={isDark} onClick={() => setIsMenuOpen(false)} />
             <MobileNavLink href="/agents" icon={Trophy} label="Agents" isDark={isDark} onClick={() => setIsMenuOpen(false)} />
             <MobileNavLink href="/agent/dashboard" icon={Bot} label="Agent Hub" isDark={isDark} onClick={() => setIsMenuOpen(false)} />
             <MobileNavLink href="/docs" icon={Book} label="Docs" isDark={isDark} onClick={() => setIsMenuOpen(false)} />
             <MobileNavLink href="/token" icon={Coins} label="Token" isDark={isDark} onClick={() => setIsMenuOpen(false)} />
             
             {authenticated ? (
                <>
                  <div className="h-[1px] my-2" style={{ background: isDark ? '#1A1A1A' : '#E4E4E7' }}></div>
                  <button 
                    onClick={() => logout()} 
                    className="w-full text-left px-4 py-3 text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-all rounded-sm"
                  >
                    <LogOut size={14} /> 
                    <span className="font-mono text-[10px] uppercase tracking-widest font-bold">Disconnect</span>
                  </button>
                </>
             ) : (
                <div className="p-2 mt-2 border-t" style={{ borderColor: isDark ? '#1A1A1A' : '#E4E4E7' }}>
                  <button 
                    disabled={!ready}
                    onClick={() => login()} 
                    className={`w-full text-center px-5 py-3 font-bold font-mono text-[10px] uppercase tracking-[0.2em] border transition-colors rounded-sm hover:bg-zinc-900 ${!ready ? "opacity-50" : ""}`}
                    style={{ color: isDark ? '#fff' : '#09090B', borderColor: isDark ? '#27272A' : '#E4E4E7' }}
                  >
                    {ready ? "Sign In" : "Loading..."}
                  </button>
                </div>
             )}
          </div>
        </div>
      )}
    </nav>
  );
};

function NavLink({ href, label, pathname, isDark }: { href: string; label: string; pathname: string; isDark: boolean }) {
  const isActive = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`text-[10px] font-mono font-bold uppercase tracking-[0.2em] transition-colors ${
        isActive ? "text-emerald-500" : ""
      }`}
      style={{ color: isActive ? undefined : (isDark ? '#71717A' : '#71717A') }}
    >
      {label}
    </Link>
  );
}

function CreateNavLink({ pathname }: { pathname: string }) {
  return null; // Deprecated inline button, moved to far right action group
}

const MobileNavLink = ({
  href,
  icon: Icon,
  label,
  isDark,
  onClick,
  primary = false,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  isDark: boolean;
  onClick?: () => void;
  primary?: boolean;
}) => (
  <Link href={href} className="block" onClick={onClick}>
    <div
      className={`flex items-center gap-3 px-4 py-3 border-l-2 transition-all group ${
        primary
          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
          : 'hover:bg-white/5 border-transparent hover:border-emerald-500'
      }`}
      style={{ color: primary ? undefined : (isDark ? '#A1A1AA' : '#52525B') }}
    >
      <Icon size={16} className="group-hover:text-emerald-400 transition-colors" />
      <span className="font-mono text-xs uppercase tracking-wider">{label}</span>
    </div>
  </Link>
);
