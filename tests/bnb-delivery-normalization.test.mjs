import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadDeliveryModule() {
  const sourcePath = join(root, 'lib/bnb/delivery.ts');
  const source = readFileSync(sourcePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: sourcePath,
  }).outputText;
  const loaded = { exports: {} };
  const execute = new Function('exports', 'require', 'module', '__filename', '__dirname', compiled);
  execute(loaded.exports, require, loaded, sourcePath, dirname(sourcePath));
  return loaded.exports;
}

const { normalizeBnbDelivery, bnbDeliveryFailureReason } = loadDeliveryModule();

function jobSpec(overrides = {}) {
  return {
    capability: 'custom',
    taskType: 'custom',
    summary: 'Run the selected operation',
    expectedOutput: 'Agent result',
    fields: {},
    ...overrides,
  };
}

describe('BNB delivery normalization', () => {
  it('promotes nested yield records into a bounded semantic table', () => {
    const output = JSON.stringify({
      project: 'beefy',
      operation: 'getVaultsWithChains',
      data: [{
        chain: 'bsc',
        vaults: [{
          name: 'WBNB-USDT',
          platform: 'pancakeswap',
          apy: 1.058,
          tvl: 104224.18,
          poolTvl: 10275588.59,
          tokenAddress: '0x39D16B4B83C43207668De708E55ecc721cC27990',
        }],
      }],
    });

    const result = normalizeBnbDelivery(output, jobSpec());
    assert.equal(result.status, 'usable');
    assert.equal(result.kind, 'table');
    assert.equal(result.table.title, 'Vaults');
    assert.deepEqual(result.table.columns.map((column) => column.label), [
      'Name', 'Project', 'Platform', 'Chain', 'APY', 'TVL', 'Pool TVL', 'Token Address',
    ]);
    assert.equal(result.table.rows[0][4].displayValue, '105.8%');
    assert.equal(result.table.rows[0][5].displayValue, '$104.2k');
    assert.equal(result.table.rows[0][7].kind, 'address');
  });

  it('renders arbitrary consistent records without a protocol-specific formatter', () => {
    const output = JSON.stringify({
      predictions: [
        { status: 'expired', prediction_id: 'pred_1', league: 'EPL', home_team: 'Aston Villa' },
        { status: 'active', prediction_id: 'pred_2', league: 'Bundesliga', home_team: 'Bayern' },
      ],
    });

    const result = normalizeBnbDelivery(output, jobSpec());
    assert.equal(result.kind, 'table');
    assert.equal(result.table.title, 'Predictions');
    assert.deepEqual(result.table.columns.map((column) => column.label), ['Status', 'Home team', 'League', 'Prediction ID']);
    assert.equal(result.table.rows.length, 2);
  });

  it('classifies empty, acknowledgement-only, and documentation payloads as unusable', () => {
    const empty = normalizeBnbDelivery('{}', jobSpec());
    const acknowledgement = normalizeBnbDelivery('Status: OK\n\nStatus: OK', jobSpec());
    const documentation = normalizeBnbDelivery(JSON.stringify({
      operation: 'getDescriptionVenus',
      description: 'Supported chains and available pools. To get started, simply tell me what to do.',
    }), jobSpec());

    assert.equal(empty.status, 'empty');
    assert.equal(acknowledgement.status, 'empty');
    assert.equal(documentation.status, 'wrong_result');
    assert.equal(bnbDeliveryFailureReason(empty), 'This agent returned no result.');
  });

  it('uses the selected endpoint operation before legacy category heuristics', () => {
    const selected = jobSpec({
      capability: 'yield_optimisation',
      endpointCapability: { name: 'get_unsettled_predictions', kind: 'mcp_tool' },
    });
    const matching = normalizeBnbDelivery(JSON.stringify({
      operation: 'get_unsettled_predictions',
      data: [{ status: 'active', prediction_id: 'pred_1' }],
    }), selected);
    const mismatched = normalizeBnbDelivery(JSON.stringify({
      operation: 'list_active_agents',
      data: [{ name: 'Agent', status: 'active' }],
    }), selected);

    assert.equal(matching.status, 'usable');
    assert.equal(mismatched.status, 'wrong_result');
  });

  it('caps primary rows while retaining the total and raw-data signal', () => {
    const output = JSON.stringify({
      items: Array.from({ length: 55 }, (_, index) => ({ id: `item-${index}`, name: `Item ${index}`, score: index })),
    });
    const result = normalizeBnbDelivery(output, jobSpec());

    assert.equal(result.table.total, 55);
    assert.equal(result.table.rows.length, 50);
    assert.equal(result.table.truncated, true);
    assert.equal(result.hasStructuredData, true);
  });
});
