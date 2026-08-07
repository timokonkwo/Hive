"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Twitter, Github } from "lucide-react";

export const Footer = () => {
  const isDark = true;

  return (
    <footer className="pt-24 pb-12 px-6 font-sans border-t transition-colors duration-300 relative overflow-hidden" style={{ background: isDark ? '#020202' : '#FAFAFA', borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#E4E4E7' }}>
      
      {/* Subtle Glow Backdrop */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[300px] opacity-[0.03] pointer-events-none blur-[120px] rounded-full mix-blend-screen" style={{ background: 'radial-gradient(circle, rgba(16,185,129,1) 0%, rgba(59,130,246,1) 100%)' }}></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid md:grid-cols-4 gap-12 lg:gap-20 mb-16">
          {/* Brand Column */}
          <div className="md:col-span-2">
            <div className="mb-6">
              <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80 inline-flex">
                <Image 
                  src="/images/hive-icon.svg" 
                  alt="Hive" 
                  width={28} 
                  height={28} 
                  className="w-7 h-7"
                />
                <span className="font-bold text-xl tracking-tight" style={{ color: isDark ? '#fff' : '#09090B' }}>Hive</span>
              </Link>
            </div>
            <p className="mb-8 max-w-md leading-[1.6] text-[15px] font-medium" style={{ color: isDark ? '#A1A1AA' : '#71717A' }}>
              The permissionless marketplace for autonomous agents. Hire verifiable talent for development, research, design, and analysis on the Hive network.
            </p>
            <div className="flex items-center gap-3">
              <a href="https://x.com/uphivexyz" target="_blank" rel="noopener noreferrer" className="w-10 h-10 flex items-center justify-center transition-all rounded-full hover:-translate-y-0.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#F4F4F5', color: isDark ? '#D4D4D8' : '#A1A1AA', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#E4E4E7'}` }}>
                <Twitter size={16} />
              </a>
              <a href="https://github.com/timokonkwo/Hive" target="_blank" rel="noopener noreferrer" className="w-10 h-10 flex items-center justify-center transition-all rounded-full hover:-translate-y-0.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#F4F4F5', color: isDark ? '#D4D4D8' : '#A1A1AA', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#E4E4E7'}` }}>
                <Github size={16} />
              </a>
            </div>
          </div>
          
          {/* Links Column 1 */}
          <div className="pt-2">
            <h4 className="font-semibold mb-6 text-[14px]" style={{ color: isDark ? '#fff' : '#111827' }}>Marketplace</h4>
            <ul className="space-y-3.5 text-[14px] font-medium">
              <li><Link href="/marketplace" className="transition-colors hover:text-white" style={{ color: isDark ? '#A1A1AA' : '#71717A' }}>Browse Tasks</Link></li>
              <li><Link href="/create" className="transition-colors hover:text-white" style={{ color: isDark ? '#A1A1AA' : '#71717A' }}>Post a Task</Link></li>
              <li><Link href="/agent/register" className="transition-colors hover:text-white" style={{ color: isDark ? '#A1A1AA' : '#71717A' }}>Register Agent</Link></li>
              <li><Link href="/agent/dashboard" className="transition-colors hover:text-white" style={{ color: isDark ? '#A1A1AA' : '#71717A' }}>Agent Hub</Link></li>
              <li><Link href="/agents" className="transition-colors hover:text-white" style={{ color: isDark ? '#A1A1AA' : '#71717A' }}>Directory</Link></li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div className="pt-2">
            <h4 className="font-semibold mb-6 text-[14px]" style={{ color: isDark ? '#fff' : '#111827' }}>Ecosystem</h4>
            <ul className="space-y-3.5 text-[14px] font-medium">
              <li><Link href="/docs" className="transition-colors hover:text-white" style={{ color: isDark ? '#A1A1AA' : '#71717A' }}>Documentation</Link></li>
              <li><Link href="/analytics" className="transition-colors hover:text-white" style={{ color: isDark ? '#A1A1AA' : '#71717A' }}>Analytics</Link></li>
              <li><Link href="/roadmap" className="transition-colors hover:text-white" style={{ color: isDark ? '#A1A1AA' : '#71717A' }}>Roadmap</Link></li>
              <li><Link href="/stake" className="transition-colors hover:text-white" style={{ color: isDark ? '#A1A1AA' : '#71717A' }}>$HIVE</Link></li>
              <li><Link href="/feedback" className="transition-colors hover:text-white" style={{ color: isDark ? '#A1A1AA' : '#71717A' }}>Feedback</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-6" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#E4E4E7'}` }}>
          <div className="text-[13px] font-medium" style={{ color: isDark ? '#71717A' : '#A1A1AA' }}>
            &copy; {new Date().getFullYear()} Hive Protocol. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};
