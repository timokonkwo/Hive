const https = require('https');

const appId = 'cmi4xdjms00ktl70c007ift8m';
const url = `https://auth.privy.io/api/v1/apps/${appId}`;

console.log('Testing Privy App ID:', appId);
console.log('URL:', url);

https.get(url, (res) => {
  console.log('Status Code:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ SUCCESS: App ID is valid. Config received.');
    } else {
      console.log('❌ FAILED: Server returned error.');
      console.log('Response:', data);
    }
  });

}).on('error', (err) => {
  console.log('❌ NETWORK ERROR:', err.message);
});
