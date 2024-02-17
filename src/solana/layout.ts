import { struct, u8 } from '@solana/buffer-layout';
import { publicKey, u64 } from '@solana/buffer-layout-utils';
import { UserData, ContractData} from "./types";

export const CONTRACT_DATA_LAYOUT = struct<ContractData>([
    u8('isInitialized'),
    publicKey('adminPubkey'),
    publicKey('stakeTokenMint'),
    publicKey('stakeTokenAccount'),
    u64('minimumStakeAmount'),
    u64('minimumLockDuration'),
    u64('normalStakingApy'),
    u64('lockedStakingApy'),
    u64('earlyWithdrawalFee'),
    u64('totalStaked'),
    u64('totalEarned')
])

export const USER_DATA_LAYOUT = struct<UserData>([
    u8('isInitialized'),
    publicKey('ownerPubkey'),
    u64('stakeType'),
    u64('lockDuration'),
    u64('totalStaked'),
    u64('interestAccrued'),
    u64('stakeTs'),
    u64('lastClaimTs'),
    u64('lastUnstakeTs')
])