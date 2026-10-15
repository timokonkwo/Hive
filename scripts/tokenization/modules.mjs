// Node tooling adapter: compile the same TypeScript modules used by the app.
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as viem from 'viem';
import * as accounts from 'viem/accounts';
import * as crypto from 'node:crypto';
import * as mongodb from 'mongodb';
import * as dicebear from '@dicebear/core';
import * as bottts from '@dicebear/bottts';
import * as cloudinary from 'cloudinary';
const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const source = readFileSync(new URL(`../../lib/agent-tokenization/${name}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', code)(dependency => {
    if (dependency === 'viem') return viem;
    if (dependency === 'viem/accounts') return accounts;
    if (dependency === 'node:crypto') return crypto;
    if (dependency === 'mongodb') return mongodb;
    if (dependency === '@dicebear/core') return dicebear;
    if (dependency === '@dicebear/bottts') return bottts;
    if (dependency === 'cloudinary') return cloudinary;
    if (/^\.\/[a-z-]+$/.test(dependency)) return load(dependency.slice(2));
    throw Error(`Unsupported tooling import: ${dependency}`);
  }, compiledModule, compiledModule.exports);
  modules.set(name, compiledModule.exports);
  return compiledModule.exports;
}
export const abi = load('abi');
export const policy = load('policy');
export const metadata = load('metadata');
export const snapshots = load('snapshot');
export const transactions = load('transaction');
export const receipts = load('receipt');
export const journal = load('journal');
export const store = load('store');
export const worker = load('worker');
export const authorization = load('authorization');
export const preparation = load('preparation');
export const avatar = load('avatar');
export const resume = load('resume');

export const profileLease = load('profile-lease');
export const profileEdit = load('profile-edit');

export const managedSigner = load('managed-signer');
export const managed = load('managed');

export const reviewedRelease = load("release");
