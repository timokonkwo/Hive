use std::str::FromStr;
use borsh::BorshDeserialize;
use hive_redemption_escrow::{claim_id, snapshot_leaf, verify_proof, grant_for, Instruction};
use solana_program::pubkey::Pubkey;

fn raw(value: &str) -> Vec<u8> {
    let value = value.strip_prefix("0x").unwrap();
    (0..value.len()).step_by(2).map(|i| u8::from_str_radix(&value[i..i+2],16).unwrap()).collect()
}
#[test]
fn javascript_merkle_pda_and_borsh_vectors_match_rust() {
    let v: serde_json::Value = serde_json::from_str(include_str!("../../test-vectors.json")).unwrap();
    let c=&v["config"];let q=&v["quote"];
    let program=Pubkey::from_str(c["program"].as_str().unwrap()).unwrap();
    let admin=Pubkey::from_str(c["admin"].as_str().unwrap()).unwrap();
    let mint=Pubkey::from_str(c["mint"].as_str().unwrap()).unwrap();
    let owner=Pubkey::from_str(q["owner"].as_str().unwrap()).unwrap();
    let id: [u8;32]=raw(c["campaignId"].as_str().unwrap()).try_into().unwrap();
    let root: [u8;32]=raw(c["root"].as_str().unwrap()).try_into().unwrap();
    let campaign=Pubkey::find_program_address(&[b"campaign",admin.as_ref(),&id],&program).0;
    assert_eq!(campaign.to_string(),v["campaign"].as_str().unwrap());
    assert_eq!(claim_id(&campaign,&owner).to_vec(),raw(v["claimId"].as_str().unwrap()));
    let proof: Vec<[u8;32]>=q["proof"].as_array().unwrap().iter().map(|s|raw(s.as_str().unwrap()).try_into().unwrap()).collect();
    verify_proof(snapshot_leaf(&id,&mint,&owner,2_000_000_000_000),&proof,&root).unwrap();
    let initialize=Instruction::try_from_slice(&raw(v["initializeHex"].as_str().unwrap())).unwrap();
    match initialize {
        Instruction::Initialize{destination_chain,total_eligible_old_raw,funding_budget_raw,allow_partial_surrender,root:decoded_root,..}=>{
            assert_eq!(destination_chain,4663);assert_eq!(total_eligible_old_raw,102000000000001);assert_eq!(funding_budget_raw,30600*10u128.pow(18));assert!(allow_partial_surrender);assert_eq!(grant_for(2_000_000_000_000,total_eligible_old_raw,funding_budget_raw).unwrap().to_string(),v["grantRaw"].as_str().unwrap());assert_eq!(decoded_root,root);
        },_=>panic!("wrong instruction")
    }
    let deposit=Instruction::try_from_slice(&raw(v["depositHex"].as_str().unwrap())).unwrap();
    match deposit {
        Instruction::Deposit{snapshot_amount,amount,deposit_deadline,proof:decoded_proof,..}=>{
            assert_eq!(snapshot_amount,2_000_000_000_000);assert_eq!(amount,snapshot_amount);assert_eq!(deposit_deadline,1000);assert_eq!(decoded_proof,proof);
        },_=>panic!("wrong instruction")
    }
}

#[test]
fn proportional_extremes_preserve_precision_without_overflow() {
    assert_eq!(grant_for(u64::MAX,u64::MAX,u128::MAX).unwrap(), u128::from(u64::MAX)*700_000_000);
    assert_eq!(grant_for(1,u64::MAX,u128::MAX).unwrap(), 700_000_000);
    assert_eq!(grant_for(1,3,100).unwrap(),33);
    assert_eq!(grant_for(2,3,100).unwrap(),66);
    assert_eq!(grant_for(1,3,1).unwrap(),0);
    assert!(grant_for(0,1,1).is_err());assert!(grant_for(2,1,1).is_err());
    assert!(grant_for(1,0,1).is_err());assert!(grant_for(1,1,0).is_err());
    assert_eq!(grant_for(10_000_000_000_000_000,582_229_876_983_614_953,7_000_000*10u128.pow(18)).unwrap(),120227426944581086898046);
}
