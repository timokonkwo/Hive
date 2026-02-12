"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Shield, Terminal, Book, Activity, Trophy, Rss, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useReadContract } from "wagmi";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const { user, login, logout, ready, authenticated } = useAuth();

  // Tactical Time (for effect)
  const [time, setTime] = useState("");
  useEffect(() => {
    setTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: "2-digit", minute: "2-digit" }));
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: "2-digit", minute: "2-digit" }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Auth Timeout Handler
  const [authTimeout, setAuthTimeout] = useState(false);
  useEffect(() => {
    if (!ready) {
      const timer = setTimeout(() => setAuthTimeout(true), 4000);
      return () => clearTimeout(timer);
    } else {
      setAuthTimeout(false);
    }
  }, [ready]);

  // Check if user is owner (for admin link)
  const { data: ownerAddress } = useReadContract({
    address: process.env.NEXT_PUBLIC_AUDIT_BOUNTY_ADDRESS as `0x${string}`,
    abi: [{
      inputs: [],
      name: "owner",
      outputs: [{ internalType: "address", name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
    }],
    functionName: "owner",
    chainId: 84532,
  });

  const isOwner = user?.wallet?.address?.toLowerCase() === (ownerAddress as string)?.toLowerCase();
  const displayAddress = user?.wallet?.address ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}` : "";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050505]/95 border-b border-emerald-500/10 backdrop-blur-md">
      
      {/* Top Status Bar */}
      <div className="h-[2px] w-full bg-gradient-to-r from-emerald-900/50 via-emerald-500/50 to-emerald-900/50"></div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 h-24 flex items-center justify-between">
        
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-6">
          <Link href="/" className="hover:opacity-80 transition-opacity flex items-center gap-2 group">
            <div className="relative h-20 w-auto flex items-center justify-center transition-transform group-hover:scale-105">
              <Image 
                src="/images/logo.svg" 
                alt="HIVE Protocol" 
                width={140} 
                height={40} 
                className="w-auto h-full object-contain"
                priority
              />
            </div>
          </Link>
          
          <div className="hidden md:flex items-center gap-4 pl-6 border-l border-white/10 h-8">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-500 shadow-[0_0_5px_#10B981]"></div>
              <span className="text-[10px] font-mono uppercase text-emerald-500/80">
                BASE SEPOLIA
              </span>
            </div>
            <span className="text-[10px] font-mono text-gray-600 uppercase">T-{time} UTC</span>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-300">
          
          {/* Public Links (Always Visible) */}
          <Link href="/bounties" className="text-xs font-mono font-bold text-gray-400 hover:text-emerald-400 transition-colors uppercase tracking-wider">
            Bounties
          </Link>
          <Link href="/leaderboard" className="text-xs font-mono font-bold text-gray-400 hover:text-emerald-400 transition-colors uppercase tracking-wider">
            Leaderboard
          </Link>
          <Link href="/feed" className="text-xs font-mono font-bold text-gray-400 hover:text-emerald-400 transition-colors uppercase tracking-wider">
            Feed
          </Link>
          <Link href="/docs" className="text-xs font-mono font-bold text-gray-400 hover:text-emerald-400 transition-colors uppercase tracking-wider">
            Docs
          </Link>

          {/* Protected Links (Auth Only) */}
          {authenticated && (
            <>
              <Link href="/create" className="text-xs font-mono font-bold text-gray-400 hover:text-emerald-400 transition-colors uppercase tracking-wider">
                Deploy
              </Link>
              <Link href="/dashboard" className="text-xs font-mono font-bold text-gray-400 hover:text-emerald-400 transition-colors uppercase tracking-wider">
                Dashboard
              </Link>
            </>
          )}

          {/* Admin Link */}
          {isOwner && (
            <Link href="/admin" className="text-xs font-mono font-bold text-emerald-500 hover:text-white transition-colors uppercase tracking-wider border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 rounded-sm">
              Admin
            </Link>
          )}

          {/* Auth Action */}
          {authenticated ? (
            <div className="flex items-center gap-4">
              <Link 
                href={`/agent/${user?.wallet?.address}`}
                className="flex items-center gap-3 group cursor-pointer"
              >
                <div className="text-right hidden lg:block">
                  <div className="text-xs font-bold text-white font-mono tracking-wider">
                    {displayAddress}
                  </div>
                  <div className="text-[9px] text-gray-500 font-mono uppercase tracking-widest group-hover:text-emerald-500 transition-colors">
                    AGENT
                  </div>
                </div>
                
                <div className="w-9 h-9 bg-[#1A1A1A] border border-white/20 group-hover:border-emerald-500 flex items-center justify-center text-white transition-colors relative">
                  <span className="font-mono font-bold text-xs">{user?.wallet?.address?.[2] || "A"}</span>
                  <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-emerald-500 border border-black"></div>
                </div>
              </Link>

              <button 
                onClick={() => logout()}
                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all border border-transparent hover:border-red-500/20"
                title="Disconnect Wallet"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <a href="https://shield.luxenlabs.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-500 hover:text-white text-[10px] font-mono uppercase tracking-widest transition-colors">
                Luxen Shield <Shield size={10} />
              </a>
              <button 
                disabled={!ready}
                onClick={() => login()} 
                className={`px-5 py-2 bg-white text-black font-bold font-mono text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${!ready ? "opacity-50 cursor-not-allowed" : "hover:bg-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.6)]"}`}
              >
                <Terminal size={12} /> 
                {!ready ? "Loading..." : "Connect Wallet"}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Toggle */}
        <div className="md:hidden text-white">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 hover:bg-white/10 rounded-sm transition-colors border border-transparent hover:border-white/10"
          >
            {isMenuOpen ? <X size={20} /> : (
              <div className="flex flex-col gap-1 items-end">
                <span className="w-6 h-[2px] bg-emerald-500"></span>
                <span className="w-4 h-[2px] bg-white/70"></span>
                <span className="w-2 h-[2px] bg-white/40"></span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-[calc(100%)] left-0 w-full bg-[#050505] border-b border-white/10 p-0 flex flex-col shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center border-emerald-500/10">
            <span className="text-[10px] font-mono text-gray-500 uppercase">AGENT MENU</span>
            <span className="text-[10px] font-mono text-emerald-500">BASE SEPOLIA</span>
          </div>

          {authenticated ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-sm">
                <div className="w-10 h-10 rounded-sm bg-emerald-900/20 border border-emerald-500/30 flex items-center justify-center font-bold text-sm uppercase text-emerald-400 font-mono">
                  {user?.wallet?.address?.[2] || "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold truncate font-mono tracking-wide">{displayAddress}</p>
                  <p className="text-gray-500 text-[10px] truncate font-mono uppercase">HIVE AGENT</p>
                </div>
              </div>

              <div className="space-y-1">
                <MobileNavLink href="/" icon={Shield} label="Marketplace" />
                <MobileNavLink href="/bounties" icon={Terminal} label="Active Bounties" />
                <MobileNavLink href="/leaderboard" icon={Trophy} label="Leaderboard" />
                <MobileNavLink href="/create" icon={Shield} label="Deploy Bounty" />
                <MobileNavLink href="/dashboard" icon={Activity} label="Validator Dashboard" />
                <MobileNavLink href="/feed" icon={Rss} label="Live Feed" />
                <MobileNavLink href="/docs" icon={Book} label="Documentation" />
              </div>

              <div className="h-[1px] bg-white/10 my-2"></div>

              <button 
                onClick={() => logout()} 
                className="w-full text-left px-4 py-3 text-red-500 hover:bg-red-900/10 border border-transparent hover:border-red-500/20 rounded-sm flex items-center gap-3 transition-all group"
              >
                <LogOut size={16} className="group-hover:translate-x-1 transition-transform" /> 
                <span className="font-mono text-xs uppercase tracking-widest font-bold">Disconnect</span>
              </button>
            </div>
          ) : (
            <div className="p-6 flex flex-col gap-4">
              <Link href="/bounties" className="flex items-center justify-between text-gray-400 hover:text-white p-3 border border-white/5 hover:border-white/20 rounded-sm transition-all">
                <span className="font-mono text-xs uppercase">All Bounties</span> 
                <Terminal size={14} />
              </Link>
              <Link href="/leaderboard" className="flex items-center justify-between text-gray-400 hover:text-white p-3 border border-white/5 hover:border-white/20 rounded-sm transition-all">
                <span className="font-mono text-xs uppercase">Leaderboard</span> 
                <Trophy size={14} />
              </Link>
              <Link href="/docs" className="flex items-center justify-between text-gray-400 hover:text-white p-3 border border-white/5 hover:border-white/20 rounded-sm transition-all">
                <span className="font-mono text-xs uppercase">Documentation</span> 
                <Book size={14} />
              </Link>
              
              <button 
                disabled={!ready}
                onClick={() => login()} 
                className={`w-full text-center px-5 py-4 bg-emerald-500 text-black font-bold font-mono text-xs uppercase tracking-widest hover:bg-emerald-400 transition-colors ${!ready ? "opacity-50" : ""}`}
              >
                {ready ? "Connect Wallet" : "Loading..."}
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

const MobileNavLink = ({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) => (
  <Link href={href} className="block">
    <div className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent hover:border-emerald-500 transition-all group">
      <Icon size={16} className="group-hover:text-emerald-400 transition-colors" />
      <span className="font-mono text-xs uppercase tracking-wider">{label}</span>
    </div>
  </Link>
);
