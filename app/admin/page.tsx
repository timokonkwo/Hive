import { Suspense } from 'react';
import { AdminPage } from '@/components/redesign/admin/AdminPage';
export const metadata={title:'Admin',robots:{index:false,follow:false}};
export default function Page(){return <Suspense><AdminPage/></Suspense>;}
