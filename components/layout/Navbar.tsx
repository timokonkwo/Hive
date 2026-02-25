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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-[#1A1A1A]">
      
      {/* Top Status Bar (Removed gradient line for cleaner look) */}
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-8">
          <Link href="/" className="hover:opacity-80 transition-opacity flex items-center gap-2 group">
            <div className="relative h-14 w-auto flex items-center justify-center">
              <Image 
                src="/images/logo.svg" 
                alt="Hive"
                width={160} 
                height={56} 
                className="w-auto h-full object-contain"
                priority
              />
            </div>
          </Link>
          
          <div className="hidden md:flex items-center gap-4 pl-6 border-l border-[#1A1A1A] h-8">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                BASE SEPOLIA
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
          
          {/* Public Links (Always Visible) */}
          <Link href="/marketplace" className="text-[10px] font-mono font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-[0.2em]"> Marketplace </Link>
          <Link href="/feed" className="text-[10px] font-mono font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-[0.2em]"> Feed </Link>
          <Link href="/create" className="text-[10px] font-mono font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-[0.2em]"> New Task </Link>
          <Link href="/leaderboard" className="text-[10px] font-mono font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-[0.2em]"> Leaderboard </Link>
          <Link href="/docs" className="text-[10px] font-mono font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-[0.2em]"> Docs </Link>

          {/* Protected Links (Auth Only) */}
          {authenticated && (
            <Link href="/dashboard" className="text-[10px] font-mono font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-[0.2em]">
              Dashboard
            </Link>
          )}

          {/* Admin Link */}
          {isOwner && (
            <Link href="/admin" className="text-[10px] font-mono font-bold text-emerald-500 hover:bg-emerald-500 hover:text-black transition-colors uppercase tracking-[0.2em] border border-emerald-500 px-3 py-1">
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
                  <div className="text-[10px] font-bold text-white font-mono tracking-widest">
                    {displayAddress}
                  </div>
                </div>
                
                <div className="w-8 h-8 bg-[#050505] border border-[#1A1A1A] group-hover:border-emerald-500 flex items-center justify-center text-white transition-colors relative">
                  <span className="font-mono font-bold text-[10px]">{user?.wallet?.address?.[2] || "A"}</span>
                </div>
              </Link>

              <button 
                onClick={() => logout()}
                className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                title="Disconnect Wallet"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <button 
                disabled={!ready}
                onClick={() => login()} 
                className={`px-4 py-2 bg-white text-black font-bold font-mono text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 hover:bg-emerald-400 ${!ready ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {!ready ? "Loading..." : "Connect Wallet"}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Toggle */}
        <div className="md:hidden text-white">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 hover:bg-white/10 transition-colors"
          >
            {isMenuOpen ? <X size={20} /> : (
              <div className="flex flex-col gap-1.5 items-end">
                <span className="w-6 h-[1px] bg-white"></span>
                <span className="w-6 h-[1px] bg-white"></span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-[calc(100%)] left-0 w-full bg-black border-b border-[#1A1A1A] p-0 flex flex-col">
          <div className="p-4 border-b border-[#1A1A1A] flex justify-between items-center">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">MENU</span>
          </div>

          {authenticated ? (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <MobileNavLink href="/marketplace" icon={Shield} label="Marketplace" />
                <MobileNavLink href="/feed" icon={Rss} label="Live Feed" />
                <MobileNavLink href="/create" icon={Shield} label="New Task" />
                <MobileNavLink href="/leaderboard" icon={Trophy} label="Leaderboard" />
                <MobileNavLink href="/dashboard" icon={Activity} label="Validator Dashboard" />
                <MobileNavLink href="/docs" icon={Book} label="Documentation" />
              </div>

              <div className="h-[1px] bg-[#1A1A1A] my-2"></div>

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
              <Link href="/marketplace" className="flex items-center justify-between text-zinc-400 hover:text-white p-3 border-b border-[#1A1A1A] transition-all">
                <span className="font-mono text-[10px] uppercase tracking-widest">Marketplace</span> 
              </Link>
              <Link href="/leaderboard" className="flex items-center justify-between text-zinc-400 hover:text-white p-3 border-b border-[#1A1A1A] transition-all">
                <span className="font-mono text-[10px] uppercase tracking-widest">Leaderboard</span> 
              </Link>
              <Link href="/docs" className="flex items-center justify-between text-zinc-400 hover:text-white p-3 border-b border-[#1A1A1A] transition-all">
                <span className="font-mono text-[10px] uppercase tracking-widest">Documentation</span> 
              </Link>
              
              <button 
                disabled={!ready}
                onClick={() => login()} 
                className={`w-full text-center px-5 py-3 bg-white text-black font-bold font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-400 transition-colors ${!ready ? "opacity-50" : ""}`}
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
