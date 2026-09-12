import type { Resource } from '../task/useResource';
import styles from './dashboard.module.css';
export function ResourceState<T>({value,retry}:{value:Resource<T>;retry:()=>void}) {return value.state==='loading'||value.state==='idle'?<p role="status" className={styles.hint}>Loading…</p>:value.state==='error'?<div role="alert" className={styles.error}><p>{value.message}</p><button className={styles.secondary} onClick={retry}>Try again</button></div>:null;}
