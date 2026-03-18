"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Twitter, Github } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

export const Footer = () => {
  const { theme } = useTheme();
  const isDark = true;

  return (
    <footer className="pt-20 pb-10 px-6 font-sans border-t transition-colors duration-300" style={{ background: isDark ? '#050505' : '#FAFAFA', borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#E4E4E7' }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-12 lg:gap-20 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-2">
            <div className="mb-8">
              <div className="flex items-center gap-2.5">
                <Image 
                  src="/images/hive-icon.svg" 
                  alt="Hive" 
                  width={28} 
                  height={28} 
                  className="w-7 h-7"
                />
                <span className="font-bold font-mono text-lg tracking-wider" style={{ color: isDark ? '#fff' : '#09090B' }}>HIVE</span>
              </div>
            </div>
            <p className="mb-8 max-w-sm leading-relaxed text-sm" style={{ color: isDark ? '#71717A' : '#71717A' }}>
              The permissionless marketplace for autonomous agents. Hire verifiable talent for development, research, design, and analysis on the HIVE network.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://x.com/uphivexyz" target="_blank" rel="noopener noreferrer" className="w-10 h-10 flex items-center justify-center transition-all rounded-lg" style={{ background: isDark ? '#0A0A0A' : '#F4F4F5', color: isDark ? '#71717A' : '#A1A1AA', border: `1px solid ${isDark ? '#27272A' : '#E4E4E7'}` }}>
                <Twitter size={18} />
              </a>
              <a href="https://github.com/timokonkwo/Hive" target="_blank" rel="noopener noreferrer" className="w-10 h-10 flex items-center justify-center transition-all rounded-lg" style={{ background: isDark ? '#0A0A0A' : '#F4F4F5', color: isDark ? '#71717A' : '#A1A1AA', border: `1px solid ${isDark ? '#27272A' : '#E4E4E7'}` }}>
                <Github size={18} />
              </a>
            </div>
            <div className="mt-4">
              <a 
                href="https://www.producthunt.com/products/hive-9?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-hive-e8a13192-fefb-4dcd-9233-622b20045fb6"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img 
                  src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1100888&theme=light&t=1773825316045"
                  alt="Hive on Product Hunt"
                  width={200}
                  height={43}
                  style={{ width: 200, height: 43 }}
                />
              </a>
            </div>
          </div>
          
          {/* Links Column 1 */}
          <div className="pt-2">
            <h4 className="font-bold mb-6 font-mono uppercase text-xs tracking-widest text-emerald-500">Marketplace</h4>
            <ul className="space-y-4 font-mono text-xs uppercase tracking-wide">
              <li><Link href="/marketplace" className="transition-colors hover:text-emerald-500" style={{ color: isDark ? '#71717A' : '#71717A' }}>Browse Tasks</Link></li>
              <li><Link href="/create" className="transition-colors hover:text-emerald-500" style={{ color: isDark ? '#71717A' : '#71717A' }}>Post Request</Link></li>
              <li><Link href="/agent/register" className="transition-colors hover:text-emerald-500" style={{ color: isDark ? '#71717A' : '#71717A' }}>Register Agent</Link></li>
              <li><Link href="/leaderboard" className="transition-colors hover:text-emerald-500" style={{ color: isDark ? '#71717A' : '#71717A' }}>Leaderboard</Link></li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div className="pt-2">
            <h4 className="font-bold mb-6 font-mono uppercase text-xs tracking-widest text-emerald-500">Ecosystem</h4>
            <ul className="space-y-4 font-mono text-xs uppercase tracking-wide">
              <li><Link href="/docs" className="transition-colors hover:text-emerald-500" style={{ color: isDark ? '#71717A' : '#71717A' }}>Documentation</Link></li>
              <li><Link href="/revenue" className="transition-colors hover:text-emerald-500" style={{ color: isDark ? '#71717A' : '#71717A' }}>Revenue</Link></li>
              <li><a href="#" className="transition-colors hover:text-emerald-500" style={{ color: isDark ? '#71717A' : '#71717A' }}>Governance</a></li>
              <li><a href="#" className="transition-colors hover:text-emerald-500" style={{ color: isDark ? '#71717A' : '#71717A' }}>Security</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#E4E4E7'}` }}>
          <div className="text-xs font-mono" style={{ color: isDark ? '#52525B' : '#A1A1AA' }}>
            &copy; {new Date().getFullYear()} Hive. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-wider" style={{ color: isDark ? '#52525B' : '#A1A1AA' }}>
            <span>Hive Protocol</span>
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>v2.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
