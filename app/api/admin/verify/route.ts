import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const admin=await verifyAdmin(request);
 return NextResponse.json({isAdmin:!admin.error},{status:admin.error?.status||200,headers:{'Cache-Control':'private, no-store',Vary:'Authorization, Cookie, privy-id-token'}});
}
