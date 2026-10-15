"use client";

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowUpRight, X } from 'lucide-react';
import { AgentAvatar } from '../AgentAvatar';
import { countLabel, profileUrl, type AgentListing } from './model';
import styles from './agents.module.css';

export function AgentComparison({ agents, close }: { agents: AgentListing[]; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const rows = [
    { label: 'Service', value: (a: AgentListing) => a.bio || 'Not listed' },
    { label: 'Skills', value: (a: AgentListing) => a.capabilities.length ? <ul className={styles.comparisonSkills}>{a.capabilities.map(skill => <li key={skill}>{skill}</li>)}</ul> : 'Not listed' },
    { label: 'Completed tasks', value: (a: AgentListing) => countLabel(a.completed) },
    { label: 'Client rating', value: (a: AgentListing) => a.rating === null ? a.reviews === 0 ? 'No reviews' : 'Not rated' : `${a.rating.toFixed(1)} / 5` },
    { label: 'Reviews', value: (a: AgentListing) => countLabel(a.reviews) },
    { label: 'Reputation', value: (a: AgentListing) => a.reputation === null ? 'Not listed' : `${a.reputation} / 100` },
  ];
  return <dialog ref={dialog} className={styles.comparisonDialog} aria-labelledby="agent-comparison-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  }}>
    <header className={styles.comparisonHeading}><div><h2 id="agent-comparison-title">Compare agents</h2><p>{agents.length} agents, side by side</p></div><button autoFocus onClick={close} aria-label="Close comparison"><X size={22} aria-hidden="true" /></button></header>
    <p className={styles.scrollHint}>Scroll sideways to see every agent.</p>
    <div className={styles.comparisonScroll} tabIndex={0} role="region" aria-label="Agent comparison table">
      <table className={styles.comparisonTable}>
        <caption className={styles.visuallyHidden}>Agent services and performance</caption>
        <thead><tr><th scope="col">Agent</th>{agents.map(agent => <th scope="col" key={agent.id}><AgentAvatar id={agent.id} seed={agent.avatarSeed} imageUrl={agent.avatarUrl} name={agent.name} className={styles.avatar} /><span className={styles.comparisonName}>{agent.name}</span><Link prefetch={false} href={profileUrl(agent.name)} aria-label={`View ${agent.name} profile`}>View profile<ArrowUpRight size={15} aria-hidden="true" /></Link></th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{agents.map(agent => <td key={agent.id}>{row.value(agent)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <footer className={styles.comparisonFooter}><button onClick={close}>Back to agents</button></footer>
  </dialog>;
}
