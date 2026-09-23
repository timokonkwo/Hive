//! Single-admin project-attested escrow. No remote-chain proof verification.
//! Campaign and claim accounts are permanent to prevent replay after settlement.
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo}, entrypoint::ProgramResult,
    clock::Clock, hash::hashv, program::{invoke, invoke_signed},
    program_error::ProgramError, program_pack::Pack, pubkey::Pubkey,
    rent::Rent, system_instruction, system_program, sysvar::Sysvar,
};
use spl_token::state::{Account as TokenAccount, AccountState, Mint};

#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process_instruction);

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct Campaign {
    pub tag: u8,
    pub id: [u8; 32],
    pub admin: Pubkey,
    pub collection: Pubkey,
    pub mint: Pubkey,
    pub root: [u8; 32],
    pub destination_chain: u64,
    pub distributor: [u8; 20],
    pub opens_at: u64,
    pub closes_at: u64,
    pub claim_grace: u64,
    pub total_eligible_old_raw: u64,
    pub funding_budget_raw: u128,
    pub allow_partial_surrender: bool,
    pub minimum_current_holding_raw: u64,
    pub paused: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct Claim {
    pub tag: u8,
    pub campaign: Pubkey,
    pub owner: Pubkey,
    pub recipient: [u8; 20],
    pub snapshot_amount: u64,
    pub amount: u64,
    pub grant: u128,
    pub deposit_deadline: u64,
    pub claim_deadline: u64,
    pub status: u8, // 1 deposited, 2 paid/released, 3 cancelled/refunded
    pub settlement_evidence: [u8; 32],
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub enum Instruction {
    Initialize {
        id: [u8; 32], collection: Pubkey, root: [u8; 32],
        destination_chain: u64, distributor: [u8; 20], opens_at: u64, closes_at: u64,
        claim_grace: u64, total_eligible_old_raw: u64, funding_budget_raw: u128, allow_partial_surrender: bool, minimum_current_holding_raw: u64,
    },
    Pause { paused: bool },
    Deposit { snapshot_amount: u64, amount: u64, recipient: [u8; 20], deposit_deadline: u64, proof: Vec<[u8; 32]> },
    Settle { paid: bool, evidence: [u8; 32] },
}

#[repr(u32)]
#[derive(Debug, Clone, Copy)]
pub enum Error {
    Invalid = 6000, Unauthorized, WrongAccount, WrongState, InvalidProof,
    Paused, Expired, Arithmetic, Replay,
}
impl From<Error> for ProgramError {
    fn from(e: Error) -> Self { ProgramError::Custom(e as u32) }
}
fn require(value: bool, error: Error) -> ProgramResult {
    if value { Ok(()) } else { Err(error.into()) }
}
fn checked_time() -> Result<u64, ProgramError> {
    Clock::get()?.unix_timestamp.try_into().map_err(|_| Error::Invalid.into())
}
fn signer(account: &AccountInfo) -> ProgramResult { require(account.is_signer, Error::Unauthorized) }
fn writable(account: &AccountInfo) -> ProgramResult { require(account.is_writable, Error::WrongAccount) }
fn key(account: &AccountInfo, expected: &Pubkey) -> ProgramResult { require(account.key == expected, Error::WrongAccount) }
fn store<T: BorshSerialize>(account: &AccountInfo, state: &T) -> ProgramResult {
    writable(account)?;
    state.serialize(&mut &mut account.try_borrow_mut_data()?[..]).map_err(|_| ProgramError::InvalidAccountData)
}
fn load<T: BorshDeserialize>(account: &AccountInfo, program: &Pubkey, tag: u8) -> Result<T, ProgramError> {
    require(account.owner == program, Error::WrongAccount)?;
    let data = account.try_borrow_data()?;
    require(data.first() == Some(&tag), Error::WrongAccount)?;
    T::try_from_slice(&data).map_err(|_| ProgramError::InvalidAccountData)
}
fn campaign(account: &AccountInfo, program: &Pubkey) -> Result<Campaign, ProgramError> {
    let c: Campaign = load(account, program, 1)?;
    let expected = Pubkey::create_program_address(&[b"campaign", c.admin.as_ref(), &c.id, &[c.bump]], program)?;
    key(account, &expected)?;
    Ok(c)
}
fn token(account: &AccountInfo, mint: &Pubkey, owner: &Pubkey) -> Result<TokenAccount, ProgramError> {
    require(account.owner == &spl_token::id(), Error::WrongAccount)?;
    let t = TokenAccount::unpack(&account.try_borrow_data()?)?;
    require(t.mint == *mint && t.owner == *owner && t.state == AccountState::Initialized, Error::WrongAccount)?;
    Ok(t)
}
pub fn grant_for(amount: u64, total: u64, budget: u128) -> Result<u128, ProgramError> {
    require(amount > 0 && total > 0 && amount <= total && budget > 0, Error::Invalid)?;
    let a = u128::from(amount);
    let t = u128::from(total);
    // Apply the common rate cap first. Dividing before multiplying keeps every
    // intermediate within u128, even with maximum u64 supply / u128 budget.
    let effective_budget = budget.min(t * 700_000_000);
    Ok((effective_budget / t) * a + ((effective_budget % t) * a) / t)
}
pub fn snapshot_leaf(id: &[u8; 32], mint: &Pubkey, owner: &Pubkey, amount: u64) -> [u8; 32] {
    hashv(&[b"HIVE_SNAPSHOT_V1", id, mint.as_ref(), owner.as_ref(), &amount.to_be_bytes()]).to_bytes()
}
pub fn claim_id(campaign: &Pubkey, owner: &Pubkey) -> [u8; 32] {
    hashv(&[b"HIVE_CLAIM_V1", campaign.as_ref(), owner.as_ref()]).to_bytes()
}
pub fn verify_proof(mut leaf: [u8; 32], proof: &[[u8; 32]], root: &[u8; 32]) -> ProgramResult {
    require(proof.len() <= 32, Error::InvalidProof)?;
    for sibling in proof {
        leaf = if leaf < *sibling { hashv(&[&leaf, sibling]) } else { hashv(&[sibling, &leaf]) }.to_bytes();
    }
    require(&leaf == root, Error::InvalidProof)
}

/// Handles pre-funded system PDAs without permitting pre-initialized accounts.
fn create<'a>(payer: &AccountInfo<'a>, target: &AccountInfo<'a>, system: &AccountInfo<'a>, owner: &Pubkey, size: usize, seeds: &[&[u8]]) -> ProgramResult {
    signer(payer)?; writable(payer)?; writable(target)?; key(system, &system_program::id())?;
    require(target.owner == &system_program::id() && target.data_is_empty(), Error::Replay)?;
    let lamports = Rent::get()?.minimum_balance(size);
    if target.lamports() == 0 {
        invoke_signed(&system_instruction::create_account(payer.key, target.key, lamports, size as u64, owner), &[payer.clone(), target.clone(), system.clone()], &[seeds])?;
    } else {
        let difference = lamports.saturating_sub(target.lamports());
        if difference > 0 { invoke(&system_instruction::transfer(payer.key, target.key, difference), &[payer.clone(), target.clone(), system.clone()])?; }
        invoke_signed(&system_instruction::allocate(target.key, size as u64), &[target.clone(), system.clone()], &[seeds])?;
        invoke_signed(&system_instruction::assign(target.key, owner), &[target.clone(), system.clone()], &[seeds])?;
    }
    Ok(())
}

pub fn process_instruction(program: &Pubkey, accounts: &[AccountInfo], bytes: &[u8]) -> ProgramResult {
    let instruction = Instruction::try_from_slice(bytes).map_err(|_| ProgramError::InvalidInstructionData)?;
    let iter = &mut accounts.iter();
    match instruction {
        Instruction::Initialize { id, collection, root, destination_chain, distributor, opens_at, closes_at, claim_grace, total_eligible_old_raw, funding_budget_raw, allow_partial_surrender, minimum_current_holding_raw } => {
            let admin = next_account_info(iter)?;
            let config = next_account_info(iter)?;
            let vault = next_account_info(iter)?;
            let mint = next_account_info(iter)?;
            let token_program = next_account_info(iter)?;
            let system = next_account_info(iter)?;
            signer(admin)?; key(token_program, &spl_token::id())?;
            require(mint.owner == &spl_token::id(), Error::WrongAccount)?;
            let m = Mint::unpack(&mint.try_borrow_data()?)?;
            require(m.decimals == 9 && m.mint_authority.is_none() && m.freeze_authority.is_none(), Error::Invalid)?;
            require(id != [0; 32] && root != [0; 32] && collection != Pubkey::default() && destination_chain == 4663 && distributor != [0; 20], Error::Invalid)?;
            require(opens_at < closes_at && claim_grace >= 3600 && closes_at.checked_add(claim_grace).is_some() && total_eligible_old_raw > 0 && funding_budget_raw > 0, Error::Invalid)?;
            let (expected, bump) = Pubkey::find_program_address(&[b"campaign", admin.key.as_ref(), &id], program);
            key(config, &expected)?;
            let (expected_vault, vault_bump) = Pubkey::find_program_address(&[b"vault", config.key.as_ref()], program);
            key(vault, &expected_vault)?;
            let c = Campaign { tag: 1, id, admin: *admin.key, collection, mint: *mint.key, root, destination_chain, distributor, opens_at, closes_at, claim_grace, total_eligible_old_raw, funding_budget_raw, allow_partial_surrender, minimum_current_holding_raw, paused: true, bump, vault_bump };
            create(admin, config, system, program, borsh::to_vec(&c)?.len(), &[b"campaign", admin.key.as_ref(), &id, &[bump]])?;
            create(admin, vault, system, &spl_token::id(), TokenAccount::LEN, &[b"vault", config.key.as_ref(), &[vault_bump]])?;
            invoke(&spl_token::instruction::initialize_account3(&spl_token::id(), vault.key, mint.key, config.key)?, &[vault.clone(), mint.clone(), token_program.clone()])?;
            store(config, &c)
        }
        Instruction::Pause { paused } => {
            let config = next_account_info(iter)?;
            let admin = next_account_info(iter)?;
            let mut c = campaign(config, program)?;
            signer(admin)?; key(admin, &c.admin)?;
            c.paused = paused;
            store(config, &c)
        }
        Instruction::Deposit { snapshot_amount, amount, recipient, deposit_deadline, proof } => {
            let owner = next_account_info(iter)?;
            let config = next_account_info(iter)?;
            let record = next_account_info(iter)?;
            let source = next_account_info(iter)?;
            let vault = next_account_info(iter)?;
            let mint = next_account_info(iter)?;
            let token_program = next_account_info(iter)?;
            let system = next_account_info(iter)?;
            let c = campaign(config, program)?;
            let admin = next_account_info(iter)?;
            signer(owner)?; signer(admin)?; key(admin, &c.admin)?;
            require(!c.paused, Error::Paused)?;
            let now = checked_time()?;
            require(now >= c.opens_at && now < c.closes_at && now < deposit_deadline && deposit_deadline <= c.closes_at, Error::Expired)?;
            require(amount > 0 && amount <= snapshot_amount && snapshot_amount >= c.minimum_current_holding_raw && snapshot_amount <= c.total_eligible_old_raw && (c.allow_partial_surrender || amount == snapshot_amount) && recipient != [0; 20] && recipient != c.distributor, Error::Invalid)?;
            verify_proof(snapshot_leaf(&c.id, &c.mint, owner.key, snapshot_amount), &proof, &c.root)?;
            key(mint, &c.mint)?; key(token_program, &spl_token::id())?;
            let source_before = token(source, &c.mint, owner.key)?.amount;
            let vault_before = token(vault, &c.mint, config.key)?.amount;
            key(vault, &Pubkey::create_program_address(&[b"vault", config.key.as_ref(), &[c.vault_bump]], program)?)?;
            require(source_before >= amount && source_before >= c.minimum_current_holding_raw, Error::Invalid)?;
            let (expected, bump) = Pubkey::find_program_address(&[b"claim", config.key.as_ref(), owner.key.as_ref()], program);
            key(record, &expected)?;
            let claim = Claim { tag: 2, campaign: *config.key, owner: *owner.key, recipient, snapshot_amount, amount, grant: grant_for(amount, c.total_eligible_old_raw, c.funding_budget_raw)?, deposit_deadline, claim_deadline: deposit_deadline.checked_add(c.claim_grace).ok_or(Error::Arithmetic)?, status: 1, settlement_evidence: [0; 32] };
            require(claim.grant > 0, Error::Invalid)?;
            create(owner, record, system, program, borsh::to_vec(&claim)?.len(), &[b"claim", config.key.as_ref(), owner.key.as_ref(), &[bump]])?;
            store(record, &claim)?;
            invoke(&spl_token::instruction::transfer_checked(&spl_token::id(), source.key, mint.key, vault.key, owner.key, &[], amount, 9)?, &[source.clone(), mint.clone(), vault.clone(), owner.clone(), token_program.clone()])?;
            require(token(source, &c.mint, owner.key)?.amount == source_before.checked_sub(amount).ok_or(Error::Arithmetic)? && token(vault, &c.mint, config.key)?.amount == vault_before.checked_add(amount).ok_or(Error::Arithmetic)?, Error::Invalid)
        }
        Instruction::Settle { paid, evidence } => {
            let config = next_account_info(iter)?;
            let record = next_account_info(iter)?;
            let vault = next_account_info(iter)?;
            let destination = next_account_info(iter)?;
            let mint = next_account_info(iter)?;
            let token_program = next_account_info(iter)?;
            let c = campaign(config, program)?;
            let admin = next_account_info(iter)?;
            signer(admin)?; key(admin, &c.admin)?;
            let mut claim: Claim = load(record, program, 2)?;
            require(claim.campaign == *config.key && claim.status == 1 && evidence != [0; 32], Error::WrongState)?;
            let (expected, _) = Pubkey::find_program_address(&[b"claim", config.key.as_ref(), claim.owner.as_ref()], program);
            key(record, &expected)?; key(mint, &c.mint)?; key(token_program, &spl_token::id())?;
            key(vault, &Pubkey::create_program_address(&[b"vault", config.key.as_ref(), &[c.vault_bump]], program)?)?;
            let receiver = if paid { c.collection } else { claim.owner };
            require(destination.key != vault.key, Error::WrongAccount)?;
            let before_vault = token(vault, &c.mint, config.key)?.amount;
            let before_destination = token(destination, &c.mint, &receiver)?.amount;
            // The admin signature attests FINALIZED Paid or Cancelled state on the
            // configured distributor. A timer alone NEVER authorizes a refund.
            claim.status = if paid { 2 } else { 3 };
            claim.settlement_evidence = evidence;
            store(record, &claim)?;
            invoke_signed(&spl_token::instruction::transfer_checked(&spl_token::id(), vault.key, mint.key, destination.key, config.key, &[], claim.amount, 9)?, &[vault.clone(), mint.clone(), destination.clone(), config.clone(), token_program.clone()], &[&[b"campaign", c.admin.as_ref(), &c.id, &[c.bump]]])?;
            require(token(vault, &c.mint, config.key)?.amount == before_vault.checked_sub(claim.amount).ok_or(Error::Arithmetic)? && token(destination, &c.mint, &receiver)?.amount == before_destination.checked_add(claim.amount).ok_or(Error::Arithmetic)?, Error::Invalid)
        }
    }
}
