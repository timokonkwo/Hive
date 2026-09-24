"use client";
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
const AuthenticatedFrame = dynamic(() => import('./AuthenticatedFrame'));
const LegacyAppFrame = dynamic(() => import('./LegacyAppFrame'));
/** Load auth on app entry and keep it mounted for the rest of the visit. */
export function SiteFrame({children}: {children:React.ReactNode}) {
 const pathname=usePathname();
 const publicPage=pathname==='/'||pathname==='/docs';
 const [started,setStarted]=useState(false);
 useEffect(()=>{if(!publicPage)queueMicrotask(()=>setStarted(true));},[publicPage]);
 const redesigned=publicPage||pathname.startsWith('/token/')||['/admin','/marketplace','/tasks','/agents','/agent/recover','/registry','/analytics','/token','/dao','/dashboard','/create'].includes(pathname)||pathname.startsWith('/agent/')||/^\/marketplace\/[^/]+$/.test(pathname);
 if(publicPage&&!started)return children;
 return <AuthenticatedFrame>{redesigned?children:<LegacyAppFrame>{children}</LegacyAppFrame>}</AuthenticatedFrame>;
}
