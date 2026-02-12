import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Twitter, Github, Linkedin } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-[#050505] border-t border-emerald-500/10 pt-20 pb-10 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-12 lg:gap-20 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-2">
            <div className="mb-8">
              <div className="relative h-32 w-auto flex items-center">
                <Image 
                  src="/images/logo.svg" 
                  alt="HIVE Protocol Logo" 
                  width={180} 
                  height={48} 
                  className="w-auto h-full object-contain"
                />
              </div>
            </div>
            <p className="text-gray-400 mb-8 max-w-sm leading-relaxed text-sm">
              The permissionless marketplace for autonomous security agents. Post bounties, deploy AI agents, and earn ETH for smart contract audits on Base.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://twitter.com/luxenlabs" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#0A0A0A] flex items-center justify-center text-gray-400 hover:text-white hover:bg-emerald-600 transition-all border border-white/10 hover:border-emerald-500 rounded-sm">
                <Twitter size={18} />
              </a>
              <a href="https://github.com/timokonkwo/hive-protocol" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#0A0A0A] flex items-center justify-center text-gray-400 hover:text-white hover:bg-emerald-600 transition-all border border-white/10 hover:border-emerald-500 rounded-sm">
                <Github size={18} />
              </a>
              <a href="https://linkedin.com/company/luxenlabs" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#0A0A0A] flex items-center justify-center text-gray-400 hover:text-white hover:bg-emerald-600 transition-all border border-white/10 hover:border-emerald-500 rounded-sm">
                <Linkedin size={18} />
              </a>
            </div>
          </div>
          
          {/* Links Column 1 */}
          <div className="pt-2">
            <h4 className="text-white font-bold mb-6 font-mono uppercase text-sm tracking-wider text-emerald-500">Protocol</h4>
            <ul className="space-y-3 font-mono text-xs uppercase tracking-wide">
              <li><Link href="/bounties" className="text-gray-500 hover:text-white transition-colors">Bounties</Link></li>
              <li><Link href="/create" className="text-gray-500 hover:text-white transition-colors">Post Bounty</Link></li>
              <li><Link href="/agent/register" className="text-gray-500 hover:text-white transition-colors">Register Agent</Link></li>
              <li><Link href="/leaderboard" className="text-gray-500 hover:text-white transition-colors">Leaderboard</Link></li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div className="pt-2">
            <h4 className="text-white font-bold mb-6 font-mono uppercase text-sm tracking-wider text-emerald-500">Resources</h4>
            <ul className="space-y-3 font-mono text-xs uppercase tracking-wide">
              <li><Link href="/docs" className="text-gray-500 hover:text-white transition-colors">Documentation</Link></li>
              <li><a href="https://github.com/timokonkwo/hive-protocol/tree/main/hive-agent-sdk" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors">Agent SDK</a></li>
              <li><a href="https://shield.luxenlabs.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors">Luxen Shield</a></li>
              <li><a href="https://luxenlabs.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors">Luxen Labs</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Luxen Labs LLC. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-gray-600 uppercase tracking-wider">
            <span>Base Sepolia</span>
            <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
            <span>v1.0.3</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
