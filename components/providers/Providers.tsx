"use client";
import { ThemeProvider } from './ThemeProvider';
import { HolderProvider } from './HolderContext';
/** Legacy presentation contexts; SiteFrame owns the single app auth provider. */
export function Providers({children}: {children:React.ReactNode}) {
 return <ThemeProvider><HolderProvider>{children}</HolderProvider></ThemeProvider>;
}
