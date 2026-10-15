import type { ReviewedRelease } from './snapshot';

// Verified 2026-10-15T11:59:20.907Z; see scripts/tokenization/evidence/source-review-2026-10-15.json.
// Runtime and source provenance verified; this is not a comprehensive security audit.
export const reviewedLaunchRelease: ReviewedRelease = {
  "chainId": 4663,
  "reviewed": true,
  "contracts": {
    "factory": {
      "address": "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
      "codeHash": "0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84",
      "sourceEvidence": "https://sourcify.dev/server/v2/contract/4663/0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e?fields=all"
    },
    "hook": {
      "address": "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044",
      "codeHash": "0xc21b1e6c1b45403e81a581f22ed6d9c747997af1cfdac1b1dc9f4b1d346a10db",
      "sourceEvidence": "https://sourcify.dev/server/v2/contract/4663/0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044?fields=all"
    },
    "deployer": {
      "address": "0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42",
      "codeHash": "0xeade22566c766377f6adfb99534f2772251efad9568642c0704a7051418e624c",
      "sourceEvidence": "https://sourcify.dev/server/v2/contract/4663/0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42?fields=all"
    },
    "escrow": {
      "address": "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e",
      "codeHash": "0xf25f75cfbc1637ba068dc34f69098fa4e8a80f8ee8fe7bf7820594e0b3fed2f1",
      "sourceEvidence": "https://sourcify.dev/server/v2/contract/4663/0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e?fields=all"
    },
    "router": {
      "address": "0xe33E9E479dF8802cb0866d5d05258bEc4cF62948",
      "codeHash": "0xed9065184519eaa24a22c2556403d5d8bbb230ff94dbc5c414cf5028e20e52e7",
      "sourceEvidence": "https://sourcify.dev/server/v2/contract/4663/0xe33E9E479dF8802cb0866d5d05258bEc4cF62948?fields=all"
    }
  }
};

export function launchesEnabled() {
  return process.env.PONS_LAUNCH_ENABLED === 'true' && reviewedLaunchRelease?.reviewed === true
    && process.env.PONS_RECONCILIATION_ENABLED === 'true'
    && !!process.env.CRON_SECRET && !!process.env.CLOUDINARY_CLOUD_NAME
    && !!process.env.CLOUDINARY_API_KEY && !!process.env.CLOUDINARY_API_SECRET;
}
