import {PublicKey} from "@solana/web3.js";

export enum StakeType {
    NORMAL
}

export interface ContractData {
    isInitialized: number,
    adminPubkey: PublicKey,
    stakeTokenMint: PublicKey,
    stakeTokenAccount: PublicKey,
    minimumStakeAmount: bigint,
    minimumLockDuration: bigint,
    normalStakingApy: bigint,
    lockedStakingApy: bigint,
    earlyWithdrawalFee: bigint,
    totalStaked: bigint,
    totalEarned: bigint
}

export interface UserData {
    isInitialized: number,
    ownerPubkey: PublicKey,
    stakeType: bigint,
    lockDuration: bigint,
    totalStaked: bigint,
    interestAccrued: bigint,
    stakeTs: bigint,
    lastClaimTs: bigint,
    lastUnstakeTs: bigint
}