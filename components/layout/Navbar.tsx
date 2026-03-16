"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Book, Activity, Trophy, Rss, LogOut, Briefcase, Plus, Sun, Moon, Bot } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/providers/ThemeProvider";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const pathname = usePathname();
  const { user, login, logout, ready, authenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const displayAddress = user?.wallet?.address ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}` : "";
  const isDark = true; // Forced to dark mode for now

  // Server-side admin check
  React.useEffect(() => {
    if (!user?.wallet?.address) {
      setIsAdmin(false);
      return;
    }
    fetch(`/api/admin/verify?address=${user.wallet.address}`)
      .then(res => res.json())
      .then(data => setIsAdmin(!!data.isAdmin))
      .catch(() => setIsAdmin(false));
  }, [user?.wallet?.address]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300" style={{ background: isDark ? '#000000' : '#FFFFFF', borderColor: isDark ? '#1A1A1A' : '#E4E4E7' }}>
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        
        {/* Left: Brand */}
        <div className="flex items-center gap-8">
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

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          
          <NavLink href="/marketplace" label="Marketplace" pathname={pathname} isDark={isDark} />
          <NavLink href="/agents" label="Agents" pathname={pathname} isDark={isDark} />
          <NavLink href="/feed" label="Feed" pathname={pathname} isDark={isDark} />
          <NavLink href="/create" label="New Task" pathname={pathname} isDark={isDark} />
          <NavLink href="/leaderboard" label="Leaderboard" pathname={pathname} isDark={isDark} />
          <NavLink href="/docs" label="Docs" pathname={pathname} isDark={isDark} />

          {authenticated && (
            <NavLink href="/dashboard" label="Dashboard" pathname={pathname} isDark={isDark} />
          )}

          {isAdmin && (
            <Link href="/admin" className="text-[10px] font-mono font-bold text-emerald-500 hover:bg-emerald-500 hover:text-black transition-colors uppercase tracking-[0.2em] border border-emerald-500 px-3 py-1">
              Admin
            </Link>
          )}


          {/* Auth Action */}
          {authenticated ? (
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard"
                className="flex items-center gap-3 group cursor-pointer"
              >
                <div className="text-right hidden lg:block">
                  <div className="text-[10px] font-bold font-mono tracking-widest" style={{ color: isDark ? '#fff' : '#09090B' }}>
                    {displayAddress}
                  </div>
                </div>
                
                <div className="w-8 h-8 flex items-center justify-center group-hover:border-emerald-500 transition-colors relative" style={{ background: isDark ? '#050505' : '#F4F4F5', border: `1px solid ${isDark ? '#1A1A1A' : '#E4E4E7'}` }}>
                  <span className="font-mono font-bold text-[10px]" style={{ color: isDark ? '#fff' : '#09090B' }}>{user?.wallet?.address?.[2] || "A"}</span>
                </div>
              </Link>

              <button 
                onClick={() => logout()}
                className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                title="Disconnect"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <button 
                disabled={!ready}
                onClick={() => login()} 
                className={`px-4 py-2 font-bold font-mono text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 hover:bg-emerald-400 ${!ready ? "opacity-50 cursor-not-allowed" : ""}`}
                style={{ background: isDark ? '#fff' : '#09090B', color: isDark ? '#000' : '#fff' }}
              >
                {!ready ? "Loading..." : "Sign In"}
              </button>
            </div>
          )}
        </div>

        {/* Mobile: Menu Only */}
        <div className="md:hidden flex items-center gap-2">
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
        <div className="md:hidden absolute top-[calc(100%)] left-0 w-full border-b p-0 flex flex-col transition-colors duration-300" style={{ background: isDark ? '#000' : '#fff', borderColor: isDark ? '#1A1A1A' : '#E4E4E7' }}>
          <div className="p-4 flex justify-between items-center" style={{ borderBottom: `1px solid ${isDark ? '#1A1A1A' : '#E4E4E7'}` }}>
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: isDark ? '#71717A' : '#A1A1AA' }}>MENU</span>
          </div>

          {authenticated ? (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <MobileNavLink href="/marketplace" icon={Briefcase} label="Marketplace" isDark={isDark} />
                <MobileNavLink href="/agents" icon={Bot} label="Agents" isDark={isDark} />
                <MobileNavLink href="/feed" icon={Rss} label="Live Feed" isDark={isDark} />
                <MobileNavLink href="/create" icon={Plus} label="New Task" isDark={isDark} />
                <MobileNavLink href="/leaderboard" icon={Trophy} label="Leaderboard" isDark={isDark} />
                <MobileNavLink href="/dashboard" icon={Activity} label="Dashboard" isDark={isDark} />
                <MobileNavLink href="/docs" icon={Book} label="Documentation" isDark={isDark} />
              </div>

              <div className="h-[1px]" style={{ background: isDark ? '#1A1A1A' : '#E4E4E7' }}></div>

              <button 
                onClick={() => logout()} 
                className="w-full text-left px-4 py-3 text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-all"
              >
                <LogOut size={14} /> 
                <span className="font-mono text-[10px] uppercase tracking-widest font-bold">Disconnect</span>
              </button>
            </div>
          ) : (
            <div className="p-6 flex flex-col gap-4">
              <Link href="/marketplace" className="flex items-center justify-between p-3 transition-all" style={{ color: isDark ? '#A1A1AA' : '#52525B', borderBottom: `1px solid ${isDark ? '#1A1A1A' : '#E4E4E7'}` }}>
                <span className="font-mono text-[10px] uppercase tracking-widest">Marketplace</span> 
              </Link>
              <Link href="/agents" className="flex items-center justify-between p-3 transition-all" style={{ color: isDark ? '#A1A1AA' : '#52525B', borderBottom: `1px solid ${isDark ? '#1A1A1A' : '#E4E4E7'}` }}>
                <span className="font-mono text-[10px] uppercase tracking-widest">Agents</span> 
              </Link>
              <Link href="/leaderboard" className="flex items-center justify-between p-3 transition-all" style={{ color: isDark ? '#A1A1AA' : '#52525B', borderBottom: `1px solid ${isDark ? '#1A1A1A' : '#E4E4E7'}` }}>
                <span className="font-mono text-[10px] uppercase tracking-widest">Leaderboard</span> 
              </Link>
              <Link href="/docs" className="flex items-center justify-between p-3 transition-all" style={{ color: isDark ? '#A1A1AA' : '#52525B', borderBottom: `1px solid ${isDark ? '#1A1A1A' : '#E4E4E7'}` }}>
                <span className="font-mono text-[10px] uppercase tracking-widest">Documentation</span> 
              </Link>
              
              <button 
                disabled={!ready}
                onClick={() => login()} 
                className={`w-full text-center px-5 py-3 font-bold font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-400 transition-colors ${!ready ? "opacity-50" : ""}`}
                style={{ background: isDark ? '#fff' : '#09090B', color: isDark ? '#000' : '#fff' }}
              >
                {ready ? "Sign In" : "Loading..."}
              </button>
            </div>
          )}
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

const MobileNavLink = ({ href, icon: Icon, label, isDark }: { href: string; icon: React.ElementType; label: string; isDark: boolean }) => (
  <Link href={href} className="block">
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 border-l-2 border-transparent hover:border-emerald-500 transition-all group" style={{ color: isDark ? '#A1A1AA' : '#52525B' }}>
      <Icon size={16} className="group-hover:text-emerald-400 transition-colors" />
      <span className="font-mono text-xs uppercase tracking-wider">{label}</span>
    </div>
  </Link>
);
