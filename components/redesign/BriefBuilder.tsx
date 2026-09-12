"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { workExamples } from "./content";
import styles from "./landing.module.css";
import { OutputArt, useVisualMotion } from "./LandingVisuals";
import visual from "./landing-visuals.module.css";
import { RevealLines } from "./RevealLines";
export function BriefBuilder({ paused }: { paused: boolean }) {
    const [category, setCategory] = useState(0);
    const [task, setTask] = useState('Compare three lending protocols.');
    const [requirements, setRequirements] = useState('Compare fees, supported assets, and risks. Include sources.');
    const visualRef = useVisualMotion(category, paused);
    const [feedback, setFeedback] = useState('');
    const output = workExamples[category].output;
    const brief = `Task: ${task.trim()}\nCategory: ${workExamples[category].name}\nRequirements: ${requirements.trim()}\nExpected output: ${output}`;
    function choose(index: number) { setCategory(index); setTask(workExamples[index].brief); setRequirements(workExamples[index].items.join('. ') + '.'); setFeedback(''); }
    async function copy() {
        if (!task.trim() || !requirements.trim()) {
            setFeedback('Add a task and its requirements.');
            return;
        }
        try {
            await navigator.clipboard.writeText(brief);
            setFeedback('Brief copied.');
        }
        catch {
            setFeedback('Copy failed. Please try again.');
        }
    }
    return <section className={styles.briefSection} id="task-brief" aria-labelledby="brief-heading"><div className={styles.container}>
    <div className={styles.sectionHeading} data-reveal><span className={styles.eyebrow} data-reveal-item>Write a task brief</span><h2 id="brief-heading"><RevealLines lines={["Describe the task.", "Define the output."]} /></h2></div>
    <div className={styles.briefLayout}>
      <form className={styles.briefForm} onSubmit={e => { e.preventDefault(); void copy(); }} data-reveal>
        <fieldset><legend>Start from an example</legend><div className={styles.briefCategories}>{workExamples.map((item, i) => <button type="button" key={item.id} onClick={() => choose(i)} aria-pressed={i === category}>{item.name}</button>)}</div></fieldset>
        <label htmlFor="brief-task">Task</label>
        <input id="brief-task" value={task} maxLength={160} required onChange={e => { setTask(e.target.value); setFeedback(''); }}/>
        <label htmlFor="brief-requirements">Requirements</label>
        <textarea id="brief-requirements" rows={3} value={requirements} maxLength={1200} required onChange={e => { setRequirements(e.target.value); setFeedback(''); }}/>
        <button className={styles.action} type="submit">{feedback === 'Brief copied.' ? <Check size={17} aria-hidden="true"/> : <Copy size={17} aria-hidden="true"/>}Copy brief</button>
        <p className={styles.copyStatus} role="status">{feedback}</p>
      </form>
      <div className={visual.briefOutput}>
        <div className={visual.preview} ref={visualRef}><OutputArt kind={category}/></div>

        <div className={visual.panelAction} data-reveal><Link prefetch={false} href="/create" className={styles.textAction}>Post a task<ArrowUpRight size={18} aria-hidden="true"/></Link></div>
      </div>
    </div>
  </div></section>;
}
