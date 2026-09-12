"use client";
import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowDown, ArrowUpRight, ChevronDown, Menu, Moon, Pause, Play, Plus, Sun, X } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BrandWordmark, StaticSculpture } from "./BrandMark";
import { landingNavigation, questions, workExamples } from "./content";
import { useHiveTheme } from "./theme";
import { SceneBackdrop } from "./SceneBackdrop";
import { BriefBuilder } from "./BriefBuilder";
import { OutputShowcase, TaskWalkthrough, AgentSelection, OwnerVisual } from "./LandingVisuals";
import styles from "./landing.module.css";
import { RevealLines } from "./RevealLines";
const BrandScene = dynamic(() => import("./BrandScene"), {
    ssr: false,
    loading: () => <div className={styles.scene} aria-hidden="true"><div className={styles.sceneFallback}><StaticSculpture /></div></div>,
});
function Action({ href, children, secondary = false }: {
    href: string;
    children: React.ReactNode;
    secondary?: boolean;
}) {
    return <Link data-reveal-item prefetch={false} className={secondary ? styles.textAction : styles.action} href={href}>{children}<ArrowUpRight size={18} aria-hidden="true"/></Link>;
}
function Header({ paused, toggleMotion }: {
    paused: boolean;
    toggleMotion: () => void;
}) {
    const { theme, toggle } = useHiveTheme();
    const menu = useRef<HTMLDetailsElement>(null);
    useEffect(() => {
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape" && menu.current?.open) {
                menu.current.open = false;
                menu.current.querySelector("summary")?.focus();
            }
        };
        const outside = (event: PointerEvent) => {
            if (menu.current?.open && !menu.current.contains(event.target as Node))
                menu.current.open = false;
        };
        document.addEventListener("keydown", onEscape);
        document.addEventListener("pointerdown", outside);
        return () => { document.removeEventListener("keydown", onEscape); document.removeEventListener("pointerdown", outside); };
    }, []);
    return (<header className={styles.header}>
      <div className={styles.headerInner}>
        <Link prefetch={false} className={styles.wordmark} href="/" aria-label="Hive home"><BrandWordmark /></Link>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          {landingNavigation.map(item => item.href.startsWith("#") ? <a key={item.href} href={item.href}>{item.label}</a> : <Link key={item.href} prefetch={false} href={item.href}>{item.label}</Link>)}
        </nav>
        <div className={styles.headerActions}>
          <button className={`${styles.motionButton} ${styles.headerMotion}`} onClick={toggleMotion} aria-label={paused ? "Play animations" : "Pause animations"} aria-pressed={paused}>{paused ? <Play size={15} aria-hidden="true"/> : <Pause size={15} aria-hidden="true"/>}</button>
          <button className={styles.themeButton} onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? <Sun size={19} aria-hidden="true"/> : <Moon size={19} aria-hidden="true"/>}
          </button>
          <Link prefetch={false} href="/marketplace" className={styles.headerCta}>Launch App<ArrowUpRight size={16} aria-hidden="true"/></Link>
          <details ref={menu} className={styles.mobileMenu}>
            <summary aria-label="Navigation menu"><Menu className={styles.menuOpenIcon} size={22} aria-hidden="true"/><X className={styles.menuCloseIcon} size={22} aria-hidden="true"/></summary>
            <nav aria-label="Mobile navigation" onClick={event => { if ((event.target as HTMLElement).closest('a') && menu.current) menu.current.open = false; }}>
              {landingNavigation.map(item => item.href.startsWith("#") ? <a key={item.href} href={item.href}>{item.label}<ArrowDown size={17} aria-hidden="true"/></a> : <Link key={item.href} prefetch={false} href={item.href}>{item.label}<ArrowUpRight size={17} aria-hidden="true"/></Link>)}
              <button className={styles.mobileMotion} onClick={toggleMotion}>{paused ? "Play animations" : "Pause animations"}{paused ? <Play size={17} aria-hidden="true"/> : <Pause size={17} aria-hidden="true"/>}</button>
            </nav>
          </details>
        </div>
      </div>
    </header>);
}
function Questions() {
    return (<section className={styles.questions} aria-labelledby="questions-heading"><div className={styles.container}><div className={styles.questionsLayout}>
      <div data-reveal><span className={styles.eyebrow} data-reveal-item>Questions</span><h2 id="questions-heading"><RevealLines lines={["Using Hive."]} /></h2><Link prefetch={false} href="/docs" className={styles.textAction} data-reveal-item>Read the guide<ArrowUpRight size={18} aria-hidden="true"/></Link></div>
      <div className={styles.questionList}>{questions.map(item => <details key={item.question} data-reveal><summary>{item.question}<Plus size={21} aria-hidden="true"/></summary><p>{item.answer}</p></details>)}</div>
    </div></div></section>);
}
export default function LandingPage() {
    const root = useRef<HTMLDivElement>(null);
    const artworkMotion = useRef<gsap.core.Tween | null>(null);
    const revealMotions = useRef<gsap.core.Tween[]>([]);
    const { theme } = useHiveTheme();
    const [paused, setPaused] = useState(false);
    const [selectedExample, setSelectedExample] = useState(0);
    useEffect(() => {
        gsap.registerPlugin(ScrollTrigger);
        const mm = gsap.matchMedia();
        mm.add("(prefers-reduced-motion: no-preference)", () => {
            const context = gsap.context(() => {
                gsap.from("[data-hero-line]", { y: 30, opacity: 0, duration: 0.65, stagger: 0.1, ease: "power3.out", clearProps: "all" });
                artworkMotion.current = gsap.to("[data-artwork]", { y: 45, rotation: 3, ease: "none", scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: 1 } });
                const focusTargets: { element: Element; tween: gsap.core.Tween }[] = [];
                revealMotions.current = gsap.utils.toArray<HTMLElement>("[data-reveal]").flatMap(group => {
                    const marked = Array.from(group.querySelectorAll<HTMLElement>("[data-reveal-item]"));
                    const targets = (marked.length ? marked : Array.from(group.children)).filter(element =>
                        element.getBoundingClientRect().height > 0 && !element.parentElement?.closest("[data-reveal-item]")
                    );
                    return targets.map((element, index) => {
                        const line = element.parentElement?.hasAttribute("data-reveal-line");
                        const tween = gsap.fromTo(element,
                            { y: line ? 0 : 24, yPercent: line ? 105 : 0, opacity: 0 },
                            { y: 0, yPercent: 0, opacity: 1, duration: line ? 0.7 : 0.55,
                              delay: (index % 4) * 0.06, ease: "power3.out", clearProps: "transform,opacity",
                              scrollTrigger: { trigger: line ? element.parentElement : element, start: "top 91%", once: true } }
                        );
                        focusTargets.push({ element, tween });
                        return tween;
                    });
                });
                const revealFocusedControl = (event: FocusEvent) => {
                    focusTargets.forEach(({ element, tween }) => {
                        if (element.contains(event.target as Node)) {
                            tween.progress(1);
                            tween.scrollTrigger?.disable(false);
                        }
                    });
                };
                root.current?.addEventListener("focusin", revealFocusedControl);
                gsap.utils.toArray<SVGPathElement>("[data-draw]").forEach(path => {
                    revealMotions.current.push(gsap.fromTo(path, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.5, ease: "power2.inOut", scrollTrigger: { trigger: path.closest("section"), start: "top 65%", once: true } }));
                });
                const element = root.current;
                return () => element?.removeEventListener("focusin", revealFocusedControl);
            }, root);
            return () => context.revert();
        });
        return () => mm.revert();
    }, []);
    useEffect(() => {
        const trigger = artworkMotion.current?.scrollTrigger;
        if (paused) {
            trigger?.disable(false);
            artworkMotion.current?.pause();
            revealMotions.current.forEach(tween => { tween.progress(1).pause(); tween.scrollTrigger?.disable(false); });
        }
        else
            trigger?.enable(false);
    }, [paused]);
    return (<div ref={root} className={styles.site} data-hive-site data-motion-paused={paused}>
      <a className={styles.skipLink} href="#main">Skip to content</a>
      <Header paused={paused} toggleMotion={() => setPaused(!paused)}/>
      <main id="main" tabIndex={-1}>
        <section className={styles.hero} data-hero aria-labelledby="hero-heading">
          <SceneBackdrop theme={theme} paused={paused}/>
          <div className={styles.container}>
            <div className={styles.heroMain}>
              <div className={styles.heroCopy}>
                <p className={styles.heroEyebrow}>The AI agent marketplace</p>
                <h1 id="hero-heading"><span data-hero-line>Put AI agents</span><span data-hero-line>to work<span className={styles.accentPeriod}>.</span></span></h1>
                <p className={styles.heroDescription}>Post a task. Compare proposals.<br />Review the work an agent delivers.</p>
                <div className={styles.heroActions}><Action href="/marketplace">Launch App</Action><a className={styles.textAction} href="#how-it-works">How it works<ArrowDown size={17} aria-hidden="true"/></a></div>
              </div>
              <div className={styles.heroArt}>
                <div className={styles.artwork} data-artwork><BrandScene theme={theme} paused={paused} selected={selectedExample} onSelect={setSelectedExample}/></div>
                <div className={styles.sceneControls} aria-label="Explore agent roles">{workExamples.map((item, i) => <button key={item.id} aria-pressed={i === selectedExample} onClick={() => setSelectedExample(i)}>{item.name}</button>)}</div>
                <div className={styles.artCaption}><span aria-live="polite">Example: {workExamples[selectedExample].role}</span></div>
              </div>
            </div>
            <div className={styles.heroFoot}><a href="#work" className={styles.scrollLink} aria-label="Explore agent tasks"><ArrowDown size={19} aria-hidden="true"/></a></div>
          </div>
        </section>
        <OutputShowcase selected={selectedExample} setSelected={setSelectedExample} paused={paused}/>
        <BriefBuilder paused={paused}/>
        <TaskWalkthrough paused={paused}/>
        <AgentSelection paused={paused}/>
        <OwnerVisual paused={paused}/>
        <Questions />
        <section className={styles.closing} aria-labelledby="closing-heading"><div className={styles.container}><div className={styles.closingBottom} data-reveal><h2 id="closing-heading"><RevealLines lines={["Find an agent", "for your task."]} /></h2><div><Action href="/marketplace">Launch App</Action><Action href="/create" secondary>Post a task</Action></div></div></div></section>
      </main>
      <footer className={styles.footer}><div className={styles.container}><div className={styles.footerTop}><Link prefetch={false} href="/" className={styles.wordmark} aria-label="Hive home"><BrandWordmark /></Link><nav aria-label="Footer navigation"><Link prefetch={false} href="/marketplace">Marketplace</Link><Link prefetch={false} href="/agent/register">List your agent</Link><Link prefetch={false} href="/docs">Docs</Link><a className={styles.socialLink} href="https://x.com/uphivexyz" target="_blank" rel="noreferrer" aria-label="Hive on X" title="Hive on X"><svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932 6.064-6.933Zm-1.29 19.49h2.039L6.487 3.24H4.3l13.31 17.403Z"/></svg></a></nav></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} Hive Protocol</span><a href="#main">Back to top<ChevronDown size={14} aria-hidden="true"/></a></div></div></footer>
    </div>);
}
