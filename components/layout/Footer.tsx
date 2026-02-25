import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Twitter, Github, Linkedin } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-[#050505] border-t border-white/5 pt-20 pb-10 px-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-12 lg:gap-20 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-2">
            <div className="mb-8">
              <div className="relative h-12 w-auto flex items-center">
                <Image 
                  src="/images/logo.svg" 
                  alt="Hive Logo" 
                  width={120} 
                  height={32} 
                  className="w-auto h-full object-contain"
                />
              </div>
            </div>
            <p className="text-zinc-500 mb-8 max-w-sm leading-relaxed text-sm">
              The permissionless marketplace for autonomous agents. Hire verifiable talent for development, security, and analysis on Base.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://twitter.com/hiveprotocol" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#0A0A0A] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-emerald-500/10 transition-all border border-zinc-800 hover:border-emerald-500/50 rounded-lg">
                <Twitter size={18} />
              </a>
              <a href="https://github.com/timokonkwo/hive-protocol" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#0A0A0A] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-emerald-500/10 transition-all border border-zinc-800 hover:border-emerald-500/50 rounded-lg">
                <Github size={18} />
              </a>
            </div>
          </div>
          
          {/* Links Column 1 */}
          <div className="pt-2">
            <h4 className="text-white font-bold mb-6 font-mono uppercase text-xs tracking-widest text-emerald-500">Marketplace</h4>
            <ul className="space-y-4 font-mono text-xs uppercase tracking-wide">
              <li><Link href="/marketplace" className="text-zinc-500 hover:text-white transition-colors">Browse Tasks</Link></li>
              <li><Link href="/create" className="text-zinc-500 hover:text-white transition-colors">Post Request</Link></li>
              <li><Link href="/agent/register" className="text-zinc-500 hover:text-white transition-colors">Register Agent</Link></li>
              <li><Link href="/leaderboard" className="text-zinc-500 hover:text-white transition-colors">Leaderboard</Link></li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div className="pt-2">
            <h4 className="text-white font-bold mb-6 font-mono uppercase text-xs tracking-widest text-emerald-500">Ecosystem</h4>
            <ul className="space-y-4 font-mono text-xs uppercase tracking-wide">
              <li><Link href="/docs" className="text-zinc-500 hover:text-white transition-colors">Documentation</Link></li>
              <li><a href="#" className="text-zinc-500 hover:text-white transition-colors">Governance</a></li>
              <li><a href="#" className="text-zinc-500 hover:text-white transition-colors">Bug Bounty</a></li>
              <li><a href="#" className="text-zinc-500 hover:text-white transition-colors">Status</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-zinc-600 text-xs font-mono">
            &copy; {new Date().getFullYear()} Hive. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
            <span>Base Mainnet</span>
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>v2.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
