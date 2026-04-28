/**
 * Token Image Upload - End-to-End Test
 * 
 * Tests the entire image upload flow WITHOUT deploying any token:
 * 1. Cloudinary upload via the API endpoint
 * 2. Verify the returned URL is publicly accessible
 * 3. Verify the URL passes through to bags-agent.ts correctly
 * 4. Verify the agent document stores tokenImageUrl
 * 
 * Run: node scripts/test-token-image.mjs
 */

import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PASS = '✅';
const FAIL = '❌';
const INFO = '  >';
let passed = 0;
let failed = 0;

function test(name, ok, detail) {
  if (ok) {
    console.log(`${PASS} ${name}`);
    passed++;
  } else {
    console.log(`${FAIL} ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

async function main() {
  console.log('\n=== TOKEN IMAGE UPLOAD TEST ===\n');

  // ─── Test 1: Cloudinary env vars ───
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  test('CLOUDINARY_CLOUD_NAME is set', !!cloudName);
  test('CLOUDINARY_API_KEY is set', !!apiKey);
  test('CLOUDINARY_API_SECRET is set', !!apiSecret);

  if (!cloudName || !apiKey || !apiSecret) {
    console.log('\nMissing Cloudinary env vars. Cannot continue.');
    process.exit(1);
  }

  // ─── Test 2: Cloudinary connection ───
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  
  try {
    const ping = await cloudinary.api.ping();
    test('Cloudinary API connection', ping.status === 'ok', JSON.stringify(ping));
  } catch (err) {
    test('Cloudinary API connection', false, err.message);
    console.log('\nCannot connect to Cloudinary. Check credentials.');
    process.exit(1);
  }

  // ─── Test 3: Upload a test image ───
  // Use the existing agent.png as the test image
  const testImagePath = path.join(__dirname, '..', 'public', 'agent.png');
  test('Test image exists (public/agent.png)', fs.existsSync(testImagePath));

  let uploadedUrl = null;
  let publicId = null;
  try {
    const testPublicId = `hive-tokens/test_${Date.now()}`;
    const result = await cloudinary.uploader.upload(testImagePath, {
      public_id: testPublicId,
      transformation: [
        { width: 512, height: 512, crop: 'fill', gravity: 'center' },
        { quality: 'auto', fetch_format: 'png' },
      ],
      resource_type: 'image',
      overwrite: true,
    });

    test('Upload to Cloudinary succeeded', !!result?.secure_url);
    console.log(`${INFO} secure_url: ${result.secure_url}`);
    console.log(`${INFO} public_id: ${result.public_id}`);
    console.log(`${INFO} format: ${result.format}, size: ${result.bytes} bytes`);
    console.log(`${INFO} dimensions: ${result.width}x${result.height}`);

    publicId = result.public_id;

    // Build the optimized URL (same logic as the API route)
    uploadedUrl = cloudinary.url(result.public_id, {
      width: 512,
      height: 512,
      crop: 'fill',
      gravity: 'center',
      format: 'png',
      secure: true,
    });

    test('Generated optimized URL', !!uploadedUrl && uploadedUrl.startsWith('https://'));
    console.log(`${INFO} optimized URL: ${uploadedUrl}`);
  } catch (err) {
    test('Upload to Cloudinary succeeded', false, err.message);
    process.exit(1);
  }

  // ─── Test 4: Verify URL is publicly accessible ───
  try {
    const res = await fetch(uploadedUrl);
    test('Uploaded image is publicly accessible', res.ok, `status: ${res.status}`);
    const contentType = res.headers.get('content-type');
    test('Content-Type is image', contentType?.startsWith('image/'), `got: ${contentType}`);
    const body = await res.arrayBuffer();
    test('Image has content (>1KB)', body.byteLength > 1024, `size: ${body.byteLength} bytes`);
    console.log(`${INFO} Response: ${res.status} ${contentType}, ${body.byteLength} bytes`);
  } catch (err) {
    test('Uploaded image is publicly accessible', false, err.message);
  }

  // ─── Test 5: Verify bags-agent.ts interface compatibility ───
  // Import and check the type accepts tokenImageUrl
  try {
    // Dynamically verify the bags-agent module exports the right types
    const bagsAgentPath = path.join(__dirname, '..', 'lib', 'bags-agent.ts');
    const source = fs.readFileSync(bagsAgentPath, 'utf-8');
    
    test('bags-agent.ts has tokenImageUrl in AgentTokenLaunchParams',
      source.includes('tokenImageUrl?: string'),
      'Field not found in interface');

    test('bags-agent.ts uses tokenImageUrl in launchAgentToken',
      source.includes('params.tokenImageUrl || getAgentTokenImageUrl()'),
      'Usage not found in method');
  } catch (err) {
    test('bags-agent.ts interface check', false, err.message);
  }

  // ─── Test 6: Verify all 4 launch paths pass tokenImageUrl ───
  const pathChecks = [
    { name: 'Registration route', file: 'app/api/agents/register/route.ts', pattern: 'tokenImageUrl' },
    { name: 'Agent Hub launch route', file: 'app/api/agents/launch-token/route.ts', pattern: 'tokenImageUrl' },
    { name: 'Admin launch route', file: 'app/api/admin/token-stats/route.ts', pattern: 'tokenImageUrl' },
    { name: 'Internal queue route', file: 'app/api/internal/launch-agent-token/route.ts', pattern: 'tokenImageUrl' },
  ];

  for (const check of pathChecks) {
    const filePath = path.join(__dirname, '..', check.file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      test(`${check.name} passes tokenImageUrl`, content.includes(check.pattern));
    } catch (err) {
      test(`${check.name} passes tokenImageUrl`, false, err.message);
    }
  }

  // ─── Test 7: Verify upload API route exists ───
  const uploadRoutePath = path.join(__dirname, '..', 'app/api/upload/token-image/route.ts');
  test('Upload API route exists', fs.existsSync(uploadRoutePath));
  if (fs.existsSync(uploadRoutePath)) {
    const routeSource = fs.readFileSync(uploadRoutePath, 'utf-8');
    test('Upload route validates file type', routeSource.includes('ALLOWED_TYPES'));
    test('Upload route validates file size', routeSource.includes('MAX_FILE_SIZE'));
    test('Upload route has rate limiting', routeSource.includes('checkRateLimit'));
  }

  // ─── Test 8: Verify frontend pages have upload UI ───
  const frontendChecks = [
    { name: 'Registration page', file: 'app/agent/register/page.tsx' },
    { name: 'Dashboard page', file: 'app/agent/dashboard/page.tsx' },
  ];

  for (const check of frontendChecks) {
    const filePath = path.join(__dirname, '..', check.file);
    const content = fs.readFileSync(filePath, 'utf-8');
    test(`${check.name} imports ImagePlus`, content.includes('ImagePlus'));
    test(`${check.name} has tokenImageUrl state`, content.includes('tokenImageUrl'));
    test(`${check.name} has upload handler`, content.includes('/api/upload/token-image'));
    test(`${check.name} has image preview`, content.includes('tokenImagePreview'));
  }

  // ─── Test 9: MongoDB field propagation ───
  // Verify registration route stores tokenImageUrl in agent document
  const registerSource = fs.readFileSync(path.join(__dirname, '..', 'app/api/agents/register/route.ts'), 'utf-8');
  test('Registration stores tokenImageUrl in agent doc', 
    registerSource.includes('tokenImageUrl:') && registerSource.includes('rawTokenImageUrl'));

  // ─── Cleanup: Delete test image from Cloudinary ───
  if (publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
      console.log(`\n${INFO} Cleaned up test image: ${publicId}`);
    } catch (err) {
      console.log(`\n${INFO} Warning: Could not clean up test image: ${err.message}`);
    }
  }

  // ─── Summary ───
  console.log(`\n${'='.repeat(40)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
