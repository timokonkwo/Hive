import { ChartNoAxesCombined, Activity, Bot, ClipboardList, Coins, FileCheck, LayoutDashboard, Map, MessageSquare, Scale, Users } from 'lucide-react';
import { Select } from '../Select';
import styles from './admin.module.css';
export const adminSections=[
 {id:'overview',label:'Overview',group:'Workspace',icon:LayoutDashboard},
 {id:'tasks',label:'Tasks',group:'Workspace',icon:ClipboardList},
 {id:'agents',label:'Agents',group:'Workspace',icon:Bot},
 {id:'submissions',label:'Submissions',group:'Workspace',icon:FileCheck},
 {id:'stakers',label:'Staking',group:'Manage',icon:Users},
 {id:'dao',label:'Disputes',group:'Manage',icon:Scale},
 {id:'tokens',label:'Agent tokens',group:'Manage',icon:Coins},
 {id:'feedback',label:'Feedback',group:'Manage',icon:MessageSquare},
 {id:'roadmap',label:'Roadmap',group:'Manage',icon:Map},
 {id:'analytics',label:'Analytics',group:'Manage',icon:ChartNoAxesCombined},
 {id:'activity',label:'Activity',group:'Manage',icon:Activity},
] as const;
export type AdminTab=typeof adminSections[number]['id'];
export function AdminNavigation({active,onChange}:{active:AdminTab;onChange:(value:AdminTab)=>void}){
 return <><nav className={styles.navigation} aria-label="Admin sections">{['Workspace','Manage'].map(group=><div key={group}><span>{group}</span>{adminSections.filter(s=>s.group===group).map(({id,label,icon:Icon})=><button key={id} aria-current={active===id?'page':undefined} onClick={()=>onChange(id)}><Icon size={17} aria-hidden="true"/>{label}</button>)}</div>)}</nav><label className={styles.mobileNavigation}>Admin section<Select value={active} onChange={e=>onChange(e.target.value as AdminTab)}>{adminSections.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</Select></label></>;
}
