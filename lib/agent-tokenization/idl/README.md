# Bags fee-share interface

`bags-fee-share-v2.json` is the unmodified official 2.10.0 IDL from
https://github.com/bagsfm/bags-idl/blob/0ddae15bcee99ed7a66eb0bd4f83153953af2f8b/fee-share-v2/idl.json

SHA-256: `404faa204fb4378fd5b8ef8066f8d5bec8aa60b50b9cd5bab891e3c516321802`.

The Bags SDK bundles an older interface without the current deployer instructions.
Use this pinned interface for transaction and account validation. Do not replace it
with a moving URL or silently fall back to accepting undecoded instructions.
