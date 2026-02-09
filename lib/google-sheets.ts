import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Config variables
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Helper to sanitize private key
const getPrivateKey = () => {
    try {
        const key = process.env.GOOGLE_PRIVATE_KEY;
        if (!key) {
            console.warn('[GOOGLE SHEETS] GOOGLE_PRIVATE_KEY is undefined');
            return undefined;
        }
        
        let cleanKey = key.trim();

        // Remove trailing comma (common copy-paste error from JSON)
        if (cleanKey.endsWith(',')) {
            cleanKey = cleanKey.slice(0, -1).trim();
        }

        // Remove wrapping quotes if present
        if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
            cleanKey = cleanKey.slice(1, -1);
        } else if (cleanKey.startsWith("'") && cleanKey.endsWith("'")) {
            cleanKey = cleanKey.slice(1, -1);
        }
        
        // Handle escaped newlines (common in env vars)
        cleanKey = cleanKey.replace(/\\n/g, '\n');

        // Check for common issues
        if (!cleanKey.includes('-----BEGIN PRIVATE KEY-----')) {
            console.error('[GOOGLE SHEETS] Private key is missing "-----BEGIN PRIVATE KEY-----"');
            console.error('[GOOGLE SHEETS] Key start:', cleanKey.slice(0, 20)); // Safe log
            return undefined;
        }
        
        // Log key stats for debugging
        console.log('[GOOGLE SHEETS] Key sanitized. Length:', cleanKey.length);
        
        return cleanKey;
    } catch (e) {
        console.error('[GOOGLE SHEETS] Error processing private key:', e);
        return undefined;
    }
};

const GOOGLE_PRIVATE_KEY = getPrivateKey();


export async function appendToSheet(data: { email: string; date: string }) {
  // If credentials are missing, log and return (development mode / fallback)
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
    console.warn('[GOOGLE SHEETS] Missing credentials. Skipping sheet append.');
    // Check specific missing creds for debugging
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL) console.warn('Missing: GOOGLE_SERVICE_ACCOUNT_EMAIL');
    if (!GOOGLE_PRIVATE_KEY) console.warn('Missing: GOOGLE_PRIVATE_KEY');
    if (!GOOGLE_SHEET_ID) console.warn('Missing: GOOGLE_SHEET_ID');
    
    console.log('[GOOGLE SHEETS] Data to append:', data);
    return false;
  }

  try {
    const serviceAccountAuth = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);

    await doc.loadInfo(); // loads document properties and worksheets
    
    const sheet = doc.sheetsByIndex[0]; // use the first sheet
    
    // Check if the sheet has headers, if not, add them
    try {
        await sheet.loadHeaderRow();
    } catch (e) {
        // If loading header row fails or is empty, we set it
        console.log('[GOOGLE SHEETS] Sheet is empty. Adding headers...');
        await sheet.setHeaderRow(['Email', 'Date']);
    }

    await sheet.addRow({ 
        Email: data.email, 
        Date: data.date 
    });

    return true;
  } catch (error: any) {
    console.error('[GOOGLE SHEETS] Error appending to sheet:', error.message);
    if (error.message.includes('DECODER routines')) {
        console.error('[GOOGLE SHEETS] Hint: Your private key format seems incorrect. Ensure it includes "-----BEGIN PRIVATE KEY-----" and newlines are correct.');
    }
    return false;
  }
}
