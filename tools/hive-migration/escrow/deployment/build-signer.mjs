import {build} from 'esbuild';import {dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
await build({entryPoints:[resolve(here,'key-signing.mjs')],bundle:true,platform:'browser',format:'iife',globalName:'HiveLocalSigner',target:'es2022',inject:[resolve(here,'browser-shim.mjs')],define:{'process.env.NODE_ENV':'"production"'},outfile:resolve(here,'../local/deployment-100k/key-signing.bundle.js'),minify:true,sourcemap:false,logLevel:'silent'});
console.log('Local browser signer built; no keys read.');
