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
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl transition-colors duration-300" style={{ background: isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.8)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
      
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
            <span className="font-bold text-lg tracking-tight" style={{ color: isDark ? '#fff' : '#09090B' }}>Hive</span>
          </Link>
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
            <Link href="/admin" className="text-[12px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors px-3 py-1 bg-emerald-500/10 rounded-full">
              Admin
            </Link>
          )}
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-3 xl:gap-4 shrink-0 z-10">
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 font-medium text-[13px] transition-all bg-white text-black hover:bg-zinc-200 rounded-full shadow-sm"
          >
            <Plus size={16} /> Create Task
          </Link>

          {/* Auth Action */}
          {authenticated ? (
            <div className="flex items-center gap-3 ml-1 pl-4" style={{ borderLeft: `1px solid ${isDark ? '#27272A' : '#E4E4E7'}` }}>
              <Link 
                href="/dashboard"
                className="flex items-center gap-2 group cursor-pointer hover:bg-white/5 px-2 py-1.5 rounded-full transition-colors"
              >
                <div className="text-right hidden xl:block">
                  <div className="text-[13px] font-medium" style={{ color: isDark ? '#fff' : '#09090B' }}>
                    {displayName}
                  </div>
                </div>
                
                <div className="w-7 h-7 flex items-center justify-center transition-colors relative rounded-full" style={{ background: isDark ? '#111' : '#F4F4F5', border: `1px solid ${isDark ? '#333' : '#E4E4E7'}` }}>
                  <span className="font-medium text-[11px]" style={{ color: isDark ? '#fff' : '#09090B' }}>{user?.wallet?.address?.[2] || "A"}</span>
                </div>
              </Link>

              <button 
                onClick={() => logout()}
                className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Disconnect"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button 
              disabled={!ready}
              onClick={() => login()} 
              className={`px-4 py-2 font-medium text-[13px] transition-all flex items-center gap-2 border rounded-full hover:bg-white/5 ${!ready ? "opacity-50 cursor-not-allowed" : ""}`}
              style={{ color: isDark ? '#fff' : '#09090B', borderColor: isDark ? '#333' : '#E4E4E7' }}
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-black font-medium text-[12px] rounded-full"
          >
            <Plus size={14} /> Create
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
        <div className="md:hidden absolute top-[calc(100%)] left-0 w-full border-b p-0 flex flex-col backdrop-blur-2xl transition-colors duration-300 shadow-2xl" style={{ background: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)', borderColor: isDark ? '#27272A' : '#E4E4E7' }}>
          <div className="p-4 flex justify-between items-center" style={{ borderBottom: `1px solid ${isDark ? '#27272A' : '#E4E4E7'}` }}>
            <span className="text-[12px] font-medium text-zinc-500">Navigation</span>
            {authenticated && (
               <span className="text-[12px] font-medium" style={{ color: isDark ? '#fff' : '#000' }}>{displayName}</span>
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
                  <div className="h-[1px] my-2" style={{ background: isDark ? '#27272A' : '#E4E4E7' }}></div>
                  <button 
                    onClick={() => logout()} 
                    className="w-full text-left px-4 py-3 text-red-400 hover:bg-white/5 flex items-center gap-3 transition-all rounded-lg"
                  >
                    <LogOut size={18} /> 
                    <span className="font-medium text-[14px]">Disconnect</span>
                  </button>
                </>
             ) : (
                <div className="p-2 mt-2 border-t" style={{ borderColor: isDark ? '#27272A' : '#E4E4E7' }}>
                  <button 
                    disabled={!ready}
                    onClick={() => login()} 
                    className={`w-full text-center px-5 py-3 font-medium text-[14px] border transition-colors rounded-full hover:bg-white/5 ${!ready ? "opacity-50" : ""}`}
                    style={{ color: isDark ? '#fff' : '#09090B', borderColor: isDark ? '#333' : '#E4E4E7' }}
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
      className={`text-[14px] font-medium transition-colors ${
        isActive ? "text-white" : ""
      }`}
      style={{ color: isActive ? undefined : (isDark ? '#A1A1AA' : '#71717A') }}
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
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
        primary
          ? 'bg-white text-black'
          : 'hover:bg-white/5 text-zinc-400 hover:text-white'
      }`}
    >
      <Icon size={18} className="transition-colors" />
      <span className="font-medium text-[14px]">{label}</span>
    </div>
  </Link>
);
