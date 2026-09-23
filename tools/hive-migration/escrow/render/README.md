# Render operator

Use the Blueprint at `tools/hive-migration/escrow/render/render.yaml`. This creates one paid web service with a 1 GB persistent disk. Gateway and verifier run together because Render disks cannot be shared across services. A child failure stops both; the signer retains its existing single-process lock and durable transaction journal.

Before starting, install Render secret files (never commit or send signer material in chat):
- `campaign-review.json`: deployed, verified campaign review, including matching on-chain timestamps and final Merkle tree.
- `verifier.inputs.json`: explicit fee ceilings and lifetime fee budgets. Execution defaults false.
- `escrow-signer.json`: signer FD input format expected by `loadSignerFromFd`, provided through a secure operator workflow only when activating.

Set `SOLANA_RPC_URL`. Copy the generated private gateway token into the website's server-only `HIVE_CLAIM_GATEWAY_TOKEN`; set its `HIVE_CLAIM_GATEWAY_URL` to the Render HTTPS origin. Keep both financial execution and website claim UI disabled through deployment verification and rehearsal. Set `HIVE_OPERATOR_EXECUTE=true` only with approved execution settings and financial activation in the review. The gateway never receives the signer FD.

Do not restore an old journal snapshot and resume signing without reconciling every subsequent on-chain transaction. Unknown transactions must never be automatically retried. Do not scale to multiple instances. Automatic deployments are disabled. Status checks remain available after the deposit window ends.

References: https://render.com/docs/disks and https://render.com/docs/blueprint-spec.
