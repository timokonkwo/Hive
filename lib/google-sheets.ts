import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { logger } from '@/lib/logger';

// Config variables
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Helper to sanitize private key
const getPrivateKey = () => {
    try {
        const key = process.env.GOOGLE_PRIVATE_KEY;
        if (!key) {
            logger.warn('GOOGLE_PRIVATE_KEY is undefined', { tag: 'GOOGLE SHEETS' });
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
            logger.error('Private key is missing "-----BEGIN PRIVATE KEY-----"', { tag: 'GOOGLE SHEETS' });
            logger.error('Key start', { tag: 'GOOGLE SHEETS', keyStart: cleanKey.slice(0, 20) });
            return undefined;
        }
        
        // Log key stats for debugging
        logger.info('Key sanitized', { tag: 'GOOGLE SHEETS', length: cleanKey.length });
        
        return cleanKey;
    } catch (e) {
        logger.error('Error processing private key', { tag: 'GOOGLE SHEETS', error: (e as Error).message });
        return undefined;
    }
};

const GOOGLE_PRIVATE_KEY = getPrivateKey();


export async function appendToSheet(data: { email: string; date: string }) {
  // If credentials are missing, log and return (development mode / fallback)
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
    logger.warn('Missing credentials. Skipping sheet append.', { tag: 'GOOGLE SHEETS' });
    // Check specific missing creds for debugging
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL) logger.warn('Missing: GOOGLE_SERVICE_ACCOUNT_EMAIL', { tag: 'GOOGLE SHEETS' });
    if (!GOOGLE_PRIVATE_KEY) logger.warn('Missing: GOOGLE_PRIVATE_KEY', { tag: 'GOOGLE SHEETS' });
    if (!GOOGLE_SHEET_ID) logger.warn('Missing: GOOGLE_SHEET_ID', { tag: 'GOOGLE SHEETS' });
    
    logger.info('Data to append', { tag: 'GOOGLE SHEETS', data });
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
        logger.info('Sheet is empty. Adding headers...', { tag: 'GOOGLE SHEETS' });
        await sheet.setHeaderRow(['Email', 'Date']);
    }

    await sheet.addRow({ 
        Email: data.email, 
        Date: data.date 
    });

    return true;
  } catch (error: any) {
    logger.error('Error appending to sheet', { tag: 'GOOGLE SHEETS', error: error.message });
    if (error.message.includes('DECODER routines')) {
        logger.error('Hint: Your private key format seems incorrect. Ensure it includes "-----BEGIN PRIVATE KEY-----" and newlines are correct.', { tag: 'GOOGLE SHEETS' });
    }
    return false;
  }
}
