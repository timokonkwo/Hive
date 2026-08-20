# BNB Testnet Setup

Use this setup to validate the BNB product on BSC Testnet before spending mainnet BNB.

The BSC Testnet contracts are deployed. Do not deploy them again for the current smoke test.

The test deployment uses two services:

- Netlify site `hive-bnb`: serves `https://bnb.uphive.xyz` from the GitHub `bnb` branch.
- Render service `hive-bnb-worker`: runs the background worker with `npm run bnb:worker`.

The existing Hive site at `https://uphive.xyz` stays separate.

On the `bnb` branch, the site root is the BNB product. The temporary Netlify URL and `https://bnb.uphive.xyz` must both open the BNB marketplace at `/`.

## 1. Create The BNB Netlify Site

In Netlify:

1. Click `Add new project`.
2. Click `Import an existing project`.
3. Select GitHub repo `timokonkwo/Hive`.
4. Set the site name to `hive-bnb`.
5. Set production branch to `bnb`.
6. Use these build settings:

```bash
Build command=npm run build
Publish directory=.next
Functions directory=netlify/functions
```

The repo already has `@netlify/plugin-nextjs` in `netlify.toml`, so Netlify will deploy the Next app correctly.

Add these environment variables to the new `hive-bnb` Netlify site:

- Context: `Production`
- Scopes: `Builds` and `Functions`

```bash
SITE_URL=https://bnb.uphive.xyz
NEXT_PUBLIC_PRIVY_APP_ID=cmmsud1f5029k0ckzaeqk5pas
MONGODB_URI=<copy the production MongoDB URI from the existing Hive Netlify site>
BNB_AUTH_SECRET=<generate with openssl rand -hex 32>
BNB_NETWORK=testnet
NEXT_PUBLIC_BNB_NETWORK=testnet
BNB_BSC_CHAIN_ID=97
NEXT_PUBLIC_BNB_BSC_CHAIN_ID=97
BNB_BSC_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
NEXT_PUBLIC_BNB_BSC_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
BNB_AGENT_ESCROW_ADDRESS=0xAAA70e3AD453faB26B9ea33E3C7CF4f94ad00c2d
BNB_SESSION_REGISTRY_ADDRESS=0x1DDCd63282CDd4e5531B65902808Ab0673B0Cd02
BNB_8004SCAN_LIVE=true
BNB_8004SCAN_API_BASE=https://8004scan.io/api/v1/public
BNB_8004SCAN_API_KEY=<optional 8004scan key>
BNB_SHOW_LOCAL_AGENTS=false
BNB_ALLOW_PROCESS_STORAGE=false
BNB_AGENT_RUN_REQUIRES_ESCROW=false
```

`BNB_AGENT_RUN_REQUIRES_ESCROW=false` lets unpriced callable agents run without showing payment or budget UI. Set it to `true` only when every production run must be escrow-funded.

Do not add this to Netlify:

```bash
BNB_DEPLOYER_PRIVATE_KEY
```

## 2. Attach The Subdomain

In the new `hive-bnb` Netlify site:

1. Go to `Domain management`.
2. Click `Add a domain`.
3. Add:

```bash
bnb.uphive.xyz
```

In the DNS provider for `uphive.xyz`, add:

```bash
Type=CNAME
Name=bnb
Value=<the default Netlify domain for hive-bnb, for example hive-bnb.netlify.app>
TTL=Auto
```

Wait until Netlify marks the domain and HTTPS certificate as active.

Expected routing after deploy:

```bash
https://bnb.uphive.xyz
https://bnb.uphive.xyz/agents
https://bnb.uphive.xyz/match
https://bnb.uphive.xyz/report
https://bnb.uphive.xyz/status
https://bnb.uphive.xyz/api/bnb/runtime
```

The `bnb` branch renders the BNB app at `/`. The code in `middleware.ts` also maps clean subdomain URLs like `/agents` and `/match` to the internal `/bnb` routes. The main `https://uphive.xyz` website is not changed by this subdomain routing.

## 3. Deploy The Render Worker

In Render:

1. Click `New`.
2. Click `Web Service`.
3. Connect GitHub repo `timokonkwo/Hive`.
4. Set branch to `bnb`.
5. Use these settings:

```bash
Name=hive-bnb-worker
Runtime=Node
Root Directory=
Build Command=npm install
Start Command=npm run bnb:worker
```

Leave `Root Directory` empty so Render runs from the repo root.

Render will clone the whole repo, but it will not deploy the Hive website with these settings. It will only run:

```bash
npm run bnb:worker
```

Do not use these Render settings:

```bash
Service Type=Static Site
Build Command=npm run build
Start Command=npm start
Start Command=npm run start
```

Generate two worker secrets locally:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Use the first output as `BNB_AGENT_WORKER_API_KEY`.

Use the second output as `BNB_AGENT_WORKER_CALLBACK_SECRET`.

Add these Render environment variables:

```bash
NODE_ENV=production
PORT=8080
SITE_URL=https://bnb.uphive.xyz
MONGODB_URI=<same production MongoDB URI used on the hive-bnb Netlify site>
BNB_NETWORK=testnet
BNB_BSC_CHAIN_ID=97
BNB_BSC_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
BNB_AGENT_ESCROW_ADDRESS=0xAAA70e3AD453faB26B9ea33E3C7CF4f94ad00c2d
BNB_SESSION_REGISTRY_ADDRESS=0x1DDCd63282CDd4e5531B65902808Ab0673B0Cd02
BNB_AGENT_WORKER_API_KEY=<first generated secret>
BNB_AGENT_WORKER_CALLBACK_SECRET=<second generated secret>
```

Deploy the Render service.

Open:

```bash
https://<your-render-service>.onrender.com/health
```

Expected response:

```json
{"status":"ok","chainId":97}
```

## 4. Connect The Worker To Netlify

After Render is live, add these environment variables to the `hive-bnb` Netlify site:

- Context: `Production`
- Scope: `Functions`

```bash
BNB_AGENT_WORKER_URL=https://<your-render-service>.onrender.com
BNB_AGENT_WORKER_API_KEY=<same BNB_AGENT_WORKER_API_KEY used on Render>
BNB_AGENT_WORKER_CALLBACK_SECRET=<same BNB_AGENT_WORKER_CALLBACK_SECRET used on Render>
```

Trigger a new production deploy for the `hive-bnb` Netlify site.

## 5. Production Checks

Open:

```bash
https://bnb.uphive.xyz/api/bnb/runtime
```

Confirm the response has:

```bash
escrowConfigured=true
sessionRegistryConfigured=true
workerConfigured=true
localAgentsEnabled=false
chainId=97
```

Then test the product:

1. Open `https://bnb.uphive.xyz`.
2. Sign in.
3. Open `Agents`.
4. Hire an agent.
5. For a paid agent, fund escrow.
6. Run the agent.
7. Open `My hires`.
8. For a paid agent, release escrow or refund after expiry.
9. Open `Wallet alerts`.
10. Grant and revoke a wallet alert.

When something fails, check these exact items:

- `hive-bnb` Netlify site uses branch `bnb`.
- `hive-bnb` Netlify site has `MONGODB_URI`.
- `hive-bnb` Netlify site has `BNB_AUTH_SECRET`.
- `hive-bnb` Netlify site reports `network=testnet` and `chainId=97` at `/api/bnb/runtime`.
- `hive-bnb` Netlify site has `BNB_AGENT_ESCROW_ADDRESS`.
- `hive-bnb` Netlify site has `BNB_SESSION_REGISTRY_ADDRESS`.
- Render service uses branch `bnb`.
- Render `/health` returns `{"status":"ok","chainId":97}`.
- `hive-bnb` Netlify site has `BNB_AGENT_WORKER_URL`.
- Netlify and Render use the same `BNB_AGENT_WORKER_API_KEY`.
- Netlify and Render use the same `BNB_AGENT_WORKER_CALLBACK_SECRET`.
- Netlify was redeployed after adding the worker values.
