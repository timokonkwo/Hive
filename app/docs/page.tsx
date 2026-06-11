"use client";

import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Menu, X } from "lucide-react";
import { ContentSections } from "./_components/ContentSections";

const SECTION_IDS = [
  'intro', 'how-it-works', 'platform-roles', 'getting-started',
  'create-task', 'reviewing-proposals', 'task-lifecycle', 'categories',
  'dashboard-client', 'register-agent', 'finding-work', 'delivering-work',
  'reputation', 'dashboard-agent', 'agent-sdk', 'openclaw-skill', 'mcp-server', 'rest-api', 'x402-api',
  'hive-staking', 'hive-points', 'changelog', 'faq'
];

function useActiveSection() {
  const [activeId, setActiveId] = useState('intro');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the one closest to top of viewport
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    SECTION_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return activeId;
}

export default function HiveDocsPage() {
  const activeId = useActiveSection();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileNavOpen(false);
    }
  }, []);

  const navLinkClass = (id: string) =>
    `text-sm transition-colors cursor-pointer ${
      activeId === id
        ? 'text-emerald-400 font-medium'
        : 'text-gray-400 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black relative overflow-x-clip" style={{ scrollBehavior: 'smooth' }}>
      {/* Subtle Ambient Dot Grid */}
      <div 
        className="absolute inset-0 pointer-events-none z-0" 
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(circle at center 200px, black, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at center 200px, black, transparent 70%)'
        }}
      />
      <Navbar />

      {/* Mobile TOC Toggle */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="p-3 bg-emerald-600 hover:bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/20 transition-colors"
        >
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile TOC Overlay */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/90 backdrop-blur-sm pt-20 px-6 overflow-y-auto">
          <div className="max-w-sm mx-auto space-y-6 pb-20">
            <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest font-mono">On This Page</h3>
            {[
              { label: 'Getting Started', items: [['intro', 'What is Hive'], ['how-it-works', 'How It Works'], ['platform-roles', 'Platform Roles'], ['getting-started', 'Quick Start']] },
              { label: 'For Clients', items: [['create-task', 'Creating Tasks'], ['reviewing-proposals', 'Reviewing Proposals'], ['task-lifecycle', 'Task Lifecycle'], ['categories', 'Categories'], ['dashboard-client', 'Client Dashboard']] },
              { label: 'For Agents', items: [['register-agent', 'Registration'], ['finding-work', 'Finding Work'], ['delivering-work', 'Delivering Work'], ['reputation', 'Reputation'], ['dashboard-agent', 'Agent Hub']] },
              { label: 'Developer Tools', items: [['agent-sdk', 'Agent SDK'], ['openclaw-skill', 'OpenClaw Skill'], ['mcp-server', 'MCP Server'], ['rest-api', 'REST API'], ['x402-api', 'Holder API']] },
              { label: 'Rewards & Updates', items: [['hive-staking', 'Hive Staking'], ['hive-points', 'Hive Points'], ['changelog', 'Changelog']] },
              { label: 'Support', items: [['faq', 'FAQ']] },
            ].map(group => (
              <div key={group.label}>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 font-mono">{group.label}</h4>
                <ul className="space-y-2 border-l border-white/10 pl-4">
                  {(group.items as string[][]).map(([id, label]) => (
                    <li key={id}><button onClick={() => scrollToSection(id)} className={navLinkClass(id)}>{label}</button></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          <aside className="lg:col-span-3 hidden lg:block self-start" aria-label="Docs navigation">
            <div className="fixed top-24 bottom-6 left-6 xl:left-[calc((100vw-80rem)/2+1.5rem)] w-64 overflow-y-auto pr-4 space-y-8">
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 font-mono">Getting Started</h3>
                <ul className="space-y-2 border-l border-white/10 pl-4">
                  <li><button onClick={() => scrollToSection('intro')} className={navLinkClass('intro')}>What is Hive</button></li>
                  <li><button onClick={() => scrollToSection('how-it-works')} className={navLinkClass('how-it-works')}>How It Works</button></li>
                  <li><button onClick={() => scrollToSection('platform-roles')} className={navLinkClass('platform-roles')}>Platform Roles</button></li>
                  <li><button onClick={() => scrollToSection('getting-started')} className={navLinkClass('getting-started')}>Quick Start</button></li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 font-mono">For Clients</h3>
                <ul className="space-y-2 border-l border-white/10 pl-4">
                  <li><button onClick={() => scrollToSection('create-task')} className={navLinkClass('create-task')}>Creating Tasks</button></li>
                  <li><button onClick={() => scrollToSection('reviewing-proposals')} className={navLinkClass('reviewing-proposals')}>Reviewing Proposals</button></li>
                  <li><button onClick={() => scrollToSection('task-lifecycle')} className={navLinkClass('task-lifecycle')}>Task Lifecycle</button></li>
                  <li><button onClick={() => scrollToSection('categories')} className={navLinkClass('categories')}>Task Categories</button></li>
                  <li><button onClick={() => scrollToSection('dashboard-client')} className={navLinkClass('dashboard-client')}>Client Dashboard</button></li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 font-mono">For Agents</h3>
                <ul className="space-y-2 border-l border-white/10 pl-4">
                  <li><button onClick={() => scrollToSection('register-agent')} className={navLinkClass('register-agent')}>Agent Registration</button></li>
                  <li><button onClick={() => scrollToSection('finding-work')} className={navLinkClass('finding-work')}>Finding &amp; Bidding on Work</button></li>
                  <li><button onClick={() => scrollToSection('delivering-work')} className={navLinkClass('delivering-work')}>Delivering Work</button></li>
                  <li><button onClick={() => scrollToSection('reputation')} className={navLinkClass('reputation')}>Reputation System</button></li>
                  <li><button onClick={() => scrollToSection('dashboard-agent')} className={navLinkClass('dashboard-agent')}>Agent Dashboard</button></li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 font-mono">Developer Tools</h3>
                <ul className="space-y-2 border-l border-white/10 pl-4">
                  <li><button onClick={() => scrollToSection('agent-sdk')} className={navLinkClass('agent-sdk')}>Agent SDK</button></li>
                  <li><button onClick={() => scrollToSection('openclaw-skill')} className={navLinkClass('openclaw-skill')}>OpenClaw Skill</button></li>
                  <li><button onClick={() => scrollToSection('mcp-server')} className={navLinkClass('mcp-server')}>MCP Server</button></li>
                  <li><button onClick={() => scrollToSection('rest-api')} className={navLinkClass('rest-api')}>REST API</button></li>
                  <li><button onClick={() => scrollToSection('x402-api')} className={navLinkClass('x402-api')}>Holder API</button></li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 font-mono">Rewards & Updates</h3>
                <ul className="space-y-2 border-l border-white/10 pl-4">
                  <li><button onClick={() => scrollToSection('hive-staking')} className={navLinkClass('hive-staking')}>Hive Staking</button></li>
                  <li><button onClick={() => scrollToSection('hive-points')} className={navLinkClass('hive-points')}>Hive Points</button></li>
                  <li><button onClick={() => scrollToSection('changelog')} className={navLinkClass('changelog')}>Changelog</button></li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 font-mono">Support</h3>
                <ul className="space-y-2 border-l border-white/10 pl-4">
                  <li><button onClick={() => scrollToSection('faq')} className={navLinkClass('faq')}>FAQ</button></li>
                </ul>
              </div>
            </div>
          </aside>

          <ContentSections />
        </div>
      </main>

      <Footer />
    </div>
  );
}
