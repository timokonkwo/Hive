import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './admin.module.css';
export function ConfirmDialog({children,onClose,label}:{children:React.ReactNode;onClose:()=>void;label:string}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=ref.current,previous=document.activeElement;el?.showModal();return()=>{el?.close();if(previous instanceof HTMLElement)previous.focus();};},[]);
 return createPortal(<dialog ref={ref} className={styles.dialog} aria-label={label} onCancel={e=>{e.preventDefault();onClose();}}>{children}</dialog>,document.querySelector('[data-admin-root]')||document.body);
}
