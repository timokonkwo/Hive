"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, FileText } from "lucide-react";
import { workExamples } from "./content";
import styles from "./landing.module.css";
import { RevealLines } from "./RevealLines";
export function BriefBuilder() {
    const [category, setCategory] = useState(0);
    const [task, setTask] = useState('Compare three lending protocols.');
    const [requirements, setRequirements] = useState('Compare fees, supported assets, and risks. Include sources.');
    const [feedback, setFeedback] = useState('');
    const output = workExamples[category].output;
    const preview = useRef<HTMLTextAreaElement>(null);
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
            const details = preview.current?.closest('details');
            if (details)
                details.open = true;
            preview.current?.focus();
            preview.current?.select();
            setFeedback('Select and copy the brief below.');
        }
    }
    return <section className={styles.briefSection} id="task-brief" aria-labelledby="brief-heading"><div className={styles.container}>
    <div className={styles.sectionHeading} data-reveal><span className={styles.eyebrow} data-reveal-item>Write a task brief</span><h2 id="brief-heading"><RevealLines lines={["Describe the task.", "Define the output."]} /></h2><p data-reveal-item>Edit an example, then copy your brief.</p></div>
    <div className={styles.briefLayout}>
      <form className={styles.briefForm} onSubmit={e => { e.preventDefault(); void copy(); }} data-reveal>
        <fieldset><legend>Start from an example</legend><div className={styles.briefCategories}>{workExamples.map((item, i) => <button type="button" key={item.id} onClick={() => choose(i)} aria-pressed={i === category}>{item.name}</button>)}</div></fieldset>
        <label htmlFor="brief-task">Task</label>
        <input id="brief-task" value={task} maxLength={160} required onChange={e => { setTask(e.target.value); setFeedback(''); }}/>
        <label htmlFor="brief-requirements">Requirements</label>
        <textarea id="brief-requirements" rows={3} value={requirements} maxLength={1200} required onChange={e => { setRequirements(e.target.value); setFeedback(''); }}/>
        <button className={styles.action} type="submit">{feedback === 'Brief copied.' ? <Check size={17} aria-hidden="true"/> : <Copy size={17} aria-hidden="true"/>}Copy brief</button>
        <p className={styles.copyStatus} role="status">{feedback || 'This draft is not saved or posted.'}</p>
      </form>
      <div className={styles.briefPreview} data-reveal>
        <div className={styles.briefPreviewHead} data-reveal-item><FileText size={20} aria-hidden="true"/><span>Your task brief</span><span>Draft</span></div>
        <h3 data-reveal-item>{task.trim() || 'Add your task.'}</h3><div className={styles.briefPreviewDetails}><span>Type of work</span><strong>{workExamples[category].name}</strong><span>Requirements</span><p>{requirements.trim() || 'Add your requirements.'}</p><span>Expected output</span><p>{output}</p></div>
        <details className={styles.briefText} data-reveal-item><summary>View the full brief</summary><label className={styles.srOnly} htmlFor="brief-copy">Full task brief</label><textarea id="brief-copy" ref={preview} value={brief} readOnly rows={7}/></details>
        <Link prefetch={false} href="/create" className={styles.textAction} data-reveal-item>Post a task<ArrowUpRight size={18} aria-hidden="true"/></Link>
      </div>
    </div>
  </div></section>;
}
