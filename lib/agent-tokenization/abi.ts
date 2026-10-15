import { parseAbi } from 'viem';

// Interface from https://docs.ponsfamily.com/v2. Runtime/source approval is separate.
const socials = 'struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }';
const params = 'struct TokenParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 expectedEconomics; bytes32 salt; }';

export const factoryAbi = parseAbi([
  socials, params,
  'struct LaunchConfig { uint256 supply; uint256 curveFeeBps; uint256 phantomQuote; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; bool enabled; }',
  'struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }',
  'function launchFee() view returns (uint256)',
  'function canLaunch(address) view returns (bool)',
  'function maxCreatorTaxBps() view returns (uint256)',
  'function snipeTaxStartBps() view returns (uint256)',
  'function snipeTaxSeconds() view returns (uint256)',
  'function memeHook() view returns (address)',
  'function launchDeployer() view returns (address)',
  'function feeEscrow() view returns (address)',
  'function launchForwarder() view returns (address)',
  'function getLaunchConfig(uint256) view returns (LaunchConfig)',
  'function previewLaunchEconomics(uint256,address) view returns (bytes32)',
  'function getLaunchedToken(address) view returns (LaunchedToken)',
  'function launchToken(TokenParams params,uint256 launchConfigId,address pairToken) payable returns (address token,address curve)',
  'event TokenLaunched(address indexed token,address indexed curve,address indexed deployer,address pairToken,uint256 launchConfigId,uint256 graduationThreshold)',
]);
export const routerAbi = parseAbi([
  socials, params,
  'function launchAndBuy(TokenParams params,uint256 launchConfigId,address pairToken,uint256 quoteIn,uint256 minTokensOut,address recipient,address[] snipeTaxExemptions) payable returns (address token,address curve,uint256 tokensOut)',
]);
export const hookAbi = parseAbi([
  'struct FeePolicy { address protocolFeeRecipient; uint16 protocolFeeShareBps; uint16 buybackBurnBps; uint16 hookFeeBps; uint16 maxInternalPriceImpactBps; }',
  'function currentFeePolicy() view returns (FeePolicy)',
]);
export const tokenAbi = parseAbi([
  socials,
  'function getTokenInfo() view returns (address tokenDeployer,string tokenLogo,string tokenDescription,Socials tokenSocials)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
]);
export const curveAbi = parseAbi([
  'function feeBps() view returns (uint256)',
  'function creatorTaxBps() view returns (uint256)',
  'function buybackEnabled() view returns (bool)',
  'event CurveBuy(address indexed buyer,address indexed recipient,uint256 quoteIn,uint256 tokensOut,uint256 fee,uint256 tax)',
  'event CurveBuyRefunded(address indexed buyer,uint256 refund)',
]);
