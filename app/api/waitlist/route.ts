import { NextResponse } from 'next/server';
import { appendToSheet } from '@/lib/google-sheets';
import { format } from 'date-fns';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Save to Google Sheets (or log if credentials missing)
    const success = await appendToSheet({ 
        email, 
        date: format(new Date(), 'dd MMM yyyy, HH:mm:ss') // e.g. 09 Feb 2026, 13:45:25
    });

    if (success) {
        console.log(`[WAITLIST] Saved to sheet: ${email}`);
    } else {
        console.log(`[WAITLIST] Logged (sheet skipped): ${email}`);
    }

    return NextResponse.json({ success: true, message: 'You have been added to the waitlist!' });
  } catch (error) {
    console.error('Waitlist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
