//! Real local Solana bank execution with native program processors and SPL CPIs.
//! These tests do not substitute for an SBF build or deployed-program rehearsal.
use borsh::BorshDeserialize;
use hive_redemption_escrow::{Campaign, Claim, Instruction as EscrowIx, process_instruction, snapshot_leaf};
use solana_program::{program_option::COption, program_pack::Pack, system_program, clock::Clock};
use solana_program_test::{processor, ProgramTest, ProgramTestContext, BanksClientError};
use solana_sdk::{account::Account, instruction::{Instruction, AccountMeta}, pubkey::Pubkey,
    signature::{Keypair, Signer}, transaction::Transaction, compute_budget::ComputeBudgetInstruction};
use spl_token::state::{Mint, Account as TokenAccount, AccountState};
use std::sync::atomic::{AtomicU64, Ordering};

const CAP: u64 = 2_000_000_000_000;
const CAMPAIGN: [u8; 32] = [1; 32];
static NONCE: AtomicU64 = AtomicU64::new(1);
fn ro(p: Pubkey) -> AccountMeta { AccountMeta::new_readonly(p, false) }
fn rw(p: Pubkey) -> AccountMeta { AccountMeta::new(p, false) }
fn sig(p: Pubkey) -> AccountMeta { AccountMeta::new_readonly(p, true) }
fn token_account(mint: Pubkey, owner: Pubkey, amount: u64) -> Account {
    let mut data = vec![0; TokenAccount::LEN];
    TokenAccount::pack(TokenAccount { mint, owner, amount, delegate: COption::None, state: AccountState::Initialized,
        is_native: COption::None, delegated_amount: 0, close_authority: COption::None }, &mut data).unwrap();
    Account { lamports: 10_000_000, data, owner: spl_token::id(), executable: false, rent_epoch: 0 }
}
async fn send(ctx: &mut ProgramTestContext, ix: Instruction, keys: &[&Keypair]) -> Result<(), BanksClientError> {
    let recent = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let mut signers = vec![&ctx.payer]; signers.extend_from_slice(keys);
    let nonce = ComputeBudgetInstruction::set_compute_unit_price(NONCE.fetch_add(1, Ordering::Relaxed));
    let tx = Transaction::new_signed_with_payer(&[nonce, ix], Some(&ctx.payer.pubkey()), &signers, recent);
    ctx.banks_client.process_transaction(tx).await
}
struct Fixture {
    ctx: ProgramTestContext, program: Pubkey, config: Pubkey, vault: Pubkey, record: Pubkey,
    mint: Pubkey, source: Pubkey, collector_token: Pubkey, refund_token: Pubkey,
    admin: Keypair, owner: Keypair, a: Keypair, b: Keypair,
}
impl Fixture {
    fn ix(&self, accounts: Vec<AccountMeta>, instruction: EscrowIx) -> Instruction {
        Instruction { program_id: self.program, accounts, data: borsh::to_vec(&instruction).unwrap() }
    }
    fn deposit(&self, amount: u64, snapshot: u64, signers: Vec<AccountMeta>) -> Instruction {
        let mut accounts = vec![AccountMeta::new(self.owner.pubkey(), true), ro(self.config), rw(self.record),
            rw(self.source), rw(self.vault), ro(self.mint), ro(spl_token::id()), ro(system_program::id())];
        accounts.extend(signers);
        self.ix(accounts, EscrowIx::Deposit { amount, snapshot_amount: snapshot, recipient: [8; 20], deposit_deadline: 1000, proof: vec![] })
    }
    fn settle(&self, paid: bool, receiver: Pubkey) -> Instruction {
        self.ix(vec![ro(self.config), rw(self.record), rw(self.vault), rw(receiver), ro(self.mint), ro(spl_token::id()), sig(self.admin.pubkey())], EscrowIx::Settle { paid, evidence: [9; 32] })
    }
    async fn balance(&mut self, address: Pubkey) -> u64 {
        let a = self.ctx.banks_client.get_account(address).await.unwrap().unwrap();
        TokenAccount::unpack(&a.data).unwrap().amount
    }
    async fn state(&mut self) -> Claim {
        let a = self.ctx.banks_client.get_account(self.record).await.unwrap().unwrap();
        Claim::try_from_slice(&a.data).unwrap()
    }
    async fn deposit_ok(&mut self) {
        let ix = self.deposit(CAP, CAP, vec![sig(self.admin.pubkey())]);
        send(&mut self.ctx, ix, &[&self.owner, &self.admin]).await.unwrap();
    }
}
async fn fixture() -> Fixture { fixture_with_policy(true, 1000 * 10u128.pow(18)).await }
async fn fixture_with_policy(allow_partial_surrender: bool, funding_budget_raw: u128) -> Fixture { fixture_with_minimum(allow_partial_surrender, funding_budget_raw, 0).await }
async fn fixture_with_minimum(allow_partial_surrender: bool, funding_budget_raw: u128, minimum_current_holding_raw: u64) -> Fixture {
    fixture_with_exception(allow_partial_surrender, funding_budget_raw, minimum_current_holding_raw, false).await
}
async fn fixture_with_exception(allow_partial_surrender: bool, funding_budget_raw: u128, minimum_current_holding_raw: u64, extra: bool) -> Fixture {
    let program = Pubkey::new_unique(); let admin = Keypair::new();
    let owner = if extra { Keypair::from_bytes(&admin.to_bytes()).unwrap() } else { Keypair::new() };
    let a = Keypair::new(); let b = Keypair::new(); let c = Keypair::new();
    let mint = Pubkey::new_unique(); let source = Pubkey::new_unique(); let collection = if extra { admin.pubkey() } else { Pubkey::new_unique() };
    let collector_token = if extra { source } else { Pubkey::new_unique() }; let refund_token = Pubkey::new_unique();
    let config = Pubkey::find_program_address(&[b"campaign", admin.pubkey().as_ref(), &CAMPAIGN], &program).0;
    let vault = Pubkey::find_program_address(&[b"vault", config.as_ref()], &program).0;
    let record = Pubkey::find_program_address(&[b"claim", config.as_ref(), owner.pubkey().as_ref()], &program).0;
    let mut pt = ProgramTest::default();
    pt.prefer_bpf(std::env::var_os("HIVE_ESCROW_TEST_SBF").is_some());
    pt.add_program("hive_redemption_escrow", program, processor!(process_instruction));
    pt.prefer_bpf(false);
    pt.add_program("spl_token", spl_token::id(), processor!(spl_token::processor::Processor::process));
    for k in [&admin, &owner, &a, &b, &c] { pt.add_account(k.pubkey(), Account { lamports: 1_000_000_000, ..Account::default() }); }
    // Pre-funded PDA cannot cause account-creation denial of service.
    pt.add_account(config, Account { lamports: 1, ..Account::default() });
    pt.add_account(vault, Account { lamports: 1, ..Account::default() });
    pt.add_account(record, Account { lamports: 1, ..Account::default() });
    let mut mint_data = vec![0; Mint::LEN];
    Mint::pack(Mint { mint_authority: COption::None, supply: CAP, decimals: 9, is_initialized: true, freeze_authority: COption::None }, &mut mint_data).unwrap();
    pt.add_account(mint, Account { lamports: 10_000_000, owner: spl_token::id(), data: mint_data, executable: false, rent_epoch: 0 });
    pt.add_account(source, token_account(mint, owner.pubkey(), CAP));
    if !extra { pt.add_account(collector_token, token_account(mint, collection, 0)); }
    pt.add_account(refund_token, token_account(mint, owner.pubkey(), 0));
    let mut ctx = pt.start_with_context().await;
    ctx.set_sysvar(&Clock { unix_timestamp: 100, ..Clock::default() });
    let init = EscrowIx::Initialize { id: CAMPAIGN, collection,
        root: snapshot_leaf(&CAMPAIGN, &mint, &if extra { a.pubkey() } else { owner.pubkey() }, CAP), 
        destination_chain: 4663, distributor: [7; 20], opens_at: if extra { 200 } else { 100 }, closes_at: 10000, claim_grace: 3600,
        total_eligible_old_raw: CAP, funding_budget_raw, allow_partial_surrender, minimum_current_holding_raw, exception_owner: if extra { owner.pubkey() } else { Pubkey::default() }, exception_allowance_raw: if extra { CAP } else { 0 }, exception_grant_raw: if extra { 100 * 10u128.pow(18) } else { 0 }, exception_opens_at: if extra { 100 } else { 0 }, };

    let ix = Instruction { program_id: program, accounts: vec![AccountMeta::new(admin.pubkey(), true), rw(config), rw(vault), ro(mint), ro(spl_token::id()), ro(system_program::id())], data: borsh::to_vec(&init).unwrap() };
    send(&mut ctx, ix, &[&admin]).await.unwrap();
    let state = ctx.banks_client.get_account(config).await.unwrap().unwrap();
    assert!(Campaign::try_from_slice(&state.data).unwrap().paused);
    let pause = Instruction { program_id: program, accounts: vec![rw(config), sig(admin.pubkey())], data: borsh::to_vec(&EscrowIx::Pause { paused: false }).unwrap() };
    send(&mut ctx, pause, &[&admin]).await.unwrap();
    Fixture { ctx, program, config, vault, record, mint, source, collector_token, refund_token, admin, owner, a, b }
}

#[tokio::test]
async fn deposit_release_exact_and_replay_rejected() {
    let mut f = fixture().await; f.deposit_ok().await;
    assert_eq!(f.balance(f.source).await, 0); assert_eq!(f.balance(f.vault).await, CAP);
    assert_eq!(f.state().await.grant, 1000 * 10u128.pow(18));
    let ix = f.settle(true, f.collector_token); send(&mut f.ctx, ix, &[&f.admin]).await.unwrap();
    assert_eq!(f.balance(f.vault).await, 0); assert_eq!(f.balance(f.collector_token).await, CAP);
    assert_eq!(f.state().await.status, 2);
    let ix = f.settle(false, f.refund_token); assert!(send(&mut f.ctx, ix, &[&f.admin]).await.is_err());
    let ix = f.deposit(CAP, CAP, vec![sig(f.admin.pubkey())]);
    assert!(send(&mut f.ctx, ix, &[&f.owner, &f.admin]).await.is_err());
}
#[tokio::test]
async fn refund_only_to_original_owner_and_terminal() {
    let mut f = fixture().await; f.deposit_ok().await;
    let ix = f.settle(false, f.collector_token); assert!(send(&mut f.ctx, ix, &[&f.admin]).await.is_err());
    assert_eq!(f.balance(f.vault).await, CAP); assert_eq!(f.state().await.status, 1);
    let ix = f.settle(false, f.refund_token); send(&mut f.ctx, ix, &[&f.admin]).await.unwrap();
    assert_eq!(f.balance(f.refund_token).await, CAP); assert_eq!(f.state().await.status, 3);
    let ix = f.settle(true, f.collector_token); assert!(send(&mut f.ctx, ix, &[&f.admin]).await.is_err());
}
#[tokio::test]
async fn wrong_or_unsigned_admin_is_rejected() {
    let mut f = fixture().await;
    let ix = f.deposit(CAP, CAP, vec![sig(f.a.pubkey()), sig(f.a.pubkey())]);
    assert!(send(&mut f.ctx, ix, &[&f.owner, &f.a]).await.is_err());
    let ix = f.deposit(CAP, CAP, vec![ro(f.admin.pubkey())]);
    assert!(send(&mut f.ctx, ix, &[&f.owner]).await.is_err());
    assert_eq!(f.balance(f.source).await, CAP); assert_eq!(f.balance(f.vault).await, 0);
}
#[tokio::test]
async fn bad_snapshot_excess_and_expiry_leave_funds_untouched() {
    let mut f = fixture().await;
    for (amount, snapshot) in [(CAP, CAP+1), (CAP+1, CAP), (0, CAP)] {
        let ix = f.deposit(amount, snapshot, vec![sig(f.admin.pubkey())]);
        assert!(send(&mut f.ctx, ix, &[&f.owner, &f.admin]).await.is_err());
    }
    f.ctx.set_sysvar(&Clock { unix_timestamp: 1000, ..Clock::default() });
    let ix = f.deposit(CAP, CAP, vec![sig(f.admin.pubkey())]);
    assert!(send(&mut f.ctx, ix, &[&f.owner, &f.admin]).await.is_err());
    assert_eq!(f.balance(f.source).await, CAP);
}
#[tokio::test]
async fn pause_blocks_deposit_but_not_settlement() {
    let mut f = fixture().await;
    let ix = f.ix(vec![rw(f.config), sig(f.owner.pubkey())], EscrowIx::Pause { paused: true });
    assert!(send(&mut f.ctx, ix, &[&f.owner]).await.is_err());
    let ix = f.ix(vec![rw(f.config), sig(f.admin.pubkey())], EscrowIx::Pause { paused: true });
    send(&mut f.ctx, ix, &[&f.admin]).await.unwrap();
    let ix = f.deposit(CAP, CAP, vec![sig(f.admin.pubkey())]);
    assert!(send(&mut f.ctx, ix, &[&f.owner, &f.admin]).await.is_err());
    let ix = f.ix(vec![rw(f.config), sig(f.admin.pubkey())], EscrowIx::Pause { paused: false });
    send(&mut f.ctx, ix, &[&f.admin]).await.unwrap();
    f.deposit_ok().await;
    let ix = f.ix(vec![rw(f.config), sig(f.admin.pubkey())], EscrowIx::Pause { paused: true });
    send(&mut f.ctx, ix, &[&f.admin]).await.unwrap();
    let ix = f.settle(false, f.refund_token); send(&mut f.ctx, ix, &[&f.admin]).await.unwrap();
    assert_eq!(f.balance(f.refund_token).await, CAP);
}
#[tokio::test]
async fn elapsed_time_cannot_replace_refund_admin() {
    let mut f = fixture().await; f.deposit_ok().await;
    f.ctx.set_sysvar(&Clock { unix_timestamp: 100000, ..Clock::default() });
    let mut ix = f.settle(false, f.refund_token);
    ix.accounts.pop();
    assert!(send(&mut f.ctx, ix, &[]).await.is_err());
    assert_eq!(f.balance(f.vault).await, CAP); assert_eq!(f.state().await.status, 1);
}
#[tokio::test]
async fn frozen_source_and_substituted_vault_fail_closed() {
    let mut f = fixture().await;
    let mut ix = f.deposit(CAP, CAP, vec![sig(f.admin.pubkey())]);
    ix.accounts[4] = rw(f.collector_token);
    assert!(send(&mut f.ctx, ix, &[&f.owner, &f.admin]).await.is_err());
    let mut account = f.ctx.banks_client.get_account(f.source).await.unwrap().unwrap();
    let mut t = TokenAccount::unpack(&account.data).unwrap(); t.state = AccountState::Frozen;
    TokenAccount::pack(t, &mut account.data).unwrap();
    f.ctx.set_account(&f.source, &account.into());
    let ix = f.deposit(CAP, CAP, vec![sig(f.admin.pubkey())]);
    assert!(send(&mut f.ctx, ix, &[&f.owner, &f.admin]).await.is_err());
    assert_eq!(f.balance(f.source).await, CAP); assert_eq!(f.balance(f.vault).await, 0);
}
#[tokio::test]
async fn smaller_deposit_gets_proportional_allocation_and_cannot_repeat() {
    let mut f = fixture().await;
    let ix = f.deposit(100, CAP, vec![sig(f.admin.pubkey())]);
    send(&mut f.ctx, ix, &[&f.owner, &f.admin]).await.unwrap();
    assert_eq!(f.state().await.grant, 50_000_000_000);
    assert_eq!(f.balance(f.source).await, CAP - 100);
    let ix = f.deposit(100, CAP, vec![sig(f.admin.pubkey())]);
    assert!(send(&mut f.ctx, ix, &[&f.owner, &f.admin]).await.is_err());
    assert_eq!(f.balance(f.vault).await, 100);
}

#[tokio::test]
async fn full_surrender_policy_rejects_partial_without_moving_tokens() {
    let mut f = fixture_with_policy(false, 1000 * 10u128.pow(18)).await;
    let ix = f.deposit(CAP/2, CAP, vec![sig(f.admin.pubkey())]);
    assert!(send(&mut f.ctx, ix, &[&f.owner, &f.admin]).await.is_err());
    assert_eq!(f.balance(f.vault).await, 0);assert_eq!(f.balance(f.source).await, CAP);
    f.deposit_ok().await;
    assert_eq!(f.state().await.grant, 1000 * 10u128.pow(18));
}
#[tokio::test]
async fn zero_allocation_cannot_take_tokens_and_high_budget_is_capped() {
    let mut f = fixture_with_policy(true, 1).await;
    let ix = f.deposit(1, CAP, vec![sig(f.admin.pubkey())]);
    assert!(send(&mut f.ctx, ix, &[&f.owner, &f.admin]).await.is_err());
    assert_eq!(f.balance(f.vault).await, 0);assert_eq!(f.balance(f.source).await, CAP);
    let mut f = fixture_with_policy(true, u128::MAX).await;
    f.deposit_ok().await;assert_eq!(f.state().await.grant, 1400 * 10u128.pow(18));
}

#[tokio::test]
async fn current_holding_floor_is_atomic_and_not_a_minimum_deposit() {
    let mut f = fixture_with_minimum(true, 1000 * 10u128.pow(18), CAP + 1).await;
    let ix = f.deposit(1, CAP, vec![sig(f.admin.pubkey())]);
    assert!(send(&mut f.ctx, ix, &[&f.owner, &f.admin]).await.is_err());
    assert_eq!(f.balance(f.source).await, CAP);
    let mut g = fixture_with_minimum(true, 1000 * 10u128.pow(18), CAP).await;
    let ix = g.deposit(1, CAP, vec![sig(g.admin.pubkey())]);
    send(&mut g.ctx, ix, &[&g.owner, &g.admin]).await.unwrap();
    assert_eq!(g.balance(g.source).await, CAP - 1);
}

#[tokio::test]
async fn buying_more_cannot_repair_a_below_minimum_snapshot() {
    let mut f = fixture_with_minimum(true, 1000 * 10u128.pow(18), CAP + 1).await;
    // Current funds now exceed the floor, but the valid frozen leaf is still CAP.
    let account = solana_sdk::account::AccountSharedData::from(token_account(f.mint, f.owner.pubkey(), CAP + 100));
    f.ctx.set_account(&f.source, &account);
    let ix = f.deposit(1, CAP, vec![sig(f.admin.pubkey())]);
    assert!(send(&mut f.ctx, ix, &[&f.owner, &f.admin]).await.is_err());
    assert_eq!(f.balance(f.source).await, CAP + 100);
}

#[tokio::test]
async fn supplemental_admin_owner_deposit_release_is_exact_and_terminal() {
    let mut f = fixture_with_exception(true, 1000 * 10u128.pow(18), 0, true).await;
    assert_eq!(f.admin.pubkey(), f.owner.pubkey());
    let ix = f.deposit(CAP, CAP + 1, vec![sig(f.admin.pubkey())]);
    assert!(send(&mut f.ctx, ix, &[&f.owner]).await.is_err());
    let ix = f.deposit(CAP, CAP, vec![sig(f.admin.pubkey())]);
    send(&mut f.ctx, ix, &[&f.owner]).await.unwrap();
    assert_eq!(f.state().await.grant, 100 * 10u128.pow(18));
    assert_eq!(f.balance(f.vault).await, CAP);
    let ix = f.settle(true, f.collector_token); send(&mut f.ctx, ix, &[&f.admin]).await.unwrap();
    assert_eq!(f.balance(f.source).await, CAP);
    assert_eq!(f.balance(f.vault).await, 0);
    let ix = f.deposit(CAP, CAP, vec![sig(f.admin.pubkey())]);
    assert!(send(&mut f.ctx, ix, &[&f.owner]).await.is_err());
}
#[tokio::test]
async fn supplemental_partial_refund_preserves_amount_and_consumes_attempt() {
    let mut f = fixture_with_exception(true, 1000 * 10u128.pow(18), 0, true).await;
    let ix = f.deposit(CAP / 2, CAP, vec![sig(f.admin.pubkey())]);
    send(&mut f.ctx, ix, &[&f.owner]).await.unwrap();
    assert_eq!(f.state().await.grant, 50 * 10u128.pow(18));
    let ix = f.settle(false, f.refund_token);send(&mut f.ctx, ix, &[&f.admin]).await.unwrap();
    assert_eq!(f.balance(f.refund_token).await, CAP / 2);
    assert_eq!(f.balance(f.vault).await, 0);
    assert_eq!(f.state().await.status, 3);
}
