import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    TransactionInstruction,
    TransactionMessage, VersionedTransaction
} from "@solana/web3.js";
import {CONTRACT_DATA_LAYOUT, USER_DATA_LAYOUT} from "./layout";
import BN from "bn.js";
import {PROGRAM_ID, STAKE_TOKEN_DECIMALS} from "./constants";
import {AccountLayout, getAssociatedTokenAddress, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import { StakeType } from "./types";

export const formatAmount = (amount: number, decimals: number) => {
    return (amount/(10**decimals)).toString()
}

export const getTokenAccount = async (
    connection: Connection,
    owner: PublicKey,
    mint: PublicKey
) => {
    const associatedToken = await getAssociatedTokenAddress(
        mint,
        owner
    )
    const accountData = await getAccountData(
        connection,
        associatedToken
    )
    if (accountData) {
        const rawAccount = AccountLayout.decode(accountData);
        return {
            address: associatedToken,
            mint: rawAccount.mint,
            owner: rawAccount.owner,
            amount: rawAccount.amount
        }
    } else {
        return null
    }
}

export const getAccountData = async (connection: Connection, address: PublicKey) => {
    const accountInfo = await connection.getAccountInfo(
        address
    );
    return accountInfo?.data;
}

export const getUserData = async (connection: Connection, address: PublicKey) => {
    const [userDataAccount,] = PublicKey.findProgramAddressSync(
        [Buffer.from("spl_staking_user", "utf-8"), address.toBuffer()],
        new PublicKey(PROGRAM_ID)
    );
    const accountData = await getAccountData(connection, userDataAccount);
    if (accountData) {
        const userData = USER_DATA_LAYOUT.decode(accountData);
        return {
            isInitialized: userData.isInitialized,
            ownerPubkey: new PublicKey(userData.ownerPubkey),
            stakeType: userData.stakeType as unknown as bigint,
            lockDuration: userData.lockDuration as unknown as bigint,
            totalStaked: userData.totalStaked as unknown as bigint,
            interestAccrued: userData.interestAccrued as unknown as bigint,
            stakeTs: userData.stakeTs as unknown as bigint,
            lastClaimTs: userData.lastClaimTs as unknown as bigint,
            lastUnstakeTs: userData.lastUnstakeTs as unknown as bigint
        }
    }
    return null
}

export const getContractData = async (connection: Connection, address: PublicKey) => {
    const accountData = await getAccountData(connection, address);
    if (accountData) {
        const contractData = CONTRACT_DATA_LAYOUT.decode(accountData);
        return {
            isInitialized: contractData.isInitialized,
            adminPubkey: new PublicKey(contractData.adminPubkey),
            stakeTokenMint: new PublicKey(contractData.stakeTokenMint),
            stakeTokenAccount: new PublicKey(contractData.stakeTokenAccount),
            minimumStakeAmount: contractData.minimumStakeAmount as unknown as bigint,
            minimumLockDuration: contractData.minimumLockDuration as unknown as bigint,
            normalStakingApy: contractData.normalStakingApy as unknown as bigint,
            lockedStakingApy: contractData.lockedStakingApy as unknown as bigint,
            earlyWithdrawalFee: contractData.earlyWithdrawalFee as unknown as bigint,
            totalStaked: contractData.totalStaked as unknown as bigint,
            totalEarned: contractData.totalEarned as unknown as bigint
        }
    }
    return null
}

export const makeStakeInstruction = (
    stakeType: StakeType,
    amount: number,
    lockDuration: number,
    programId: PublicKey,
    user: PublicKey,
    userTokenAccount: PublicKey,
    userDataAccount: PublicKey,
    contractTokenAccount: PublicKey,
    contractDataAccount: PublicKey
) => {
    const instructionData = Buffer.from(
        Uint8Array.of(
            1,
            stakeType,
            ...new BN(amount * (10**STAKE_TOKEN_DECIMALS)).toArray("le", 8),
            ...new BN(lockDuration).toArray("le", 8)
        )
    )
    return new TransactionInstruction({
        programId,
        keys: [
            {pubkey: user, isSigner: true, isWritable: true},
            {pubkey: userTokenAccount, isSigner: false, isWritable: true},
            {pubkey: userDataAccount, isSigner: false, isWritable: true},
            {pubkey: contractTokenAccount, isSigner: false, isWritable: true},
            {pubkey: contractDataAccount, isSigner: false, isWritable: true},
            {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
            {pubkey: SystemProgram.programId, isSigner: false, isWritable: false}
        ],
        data: instructionData
    })
}

export const makeUnstakeInstruction = (
    programId: PublicKey,
    user: PublicKey,
    userTokenAccount: PublicKey,
    userDataAccount: PublicKey,
    contractTokenAccount: PublicKey,
    contractDataAccount: PublicKey
) => {
    const instructionData = Buffer.from(Uint8Array.of(2));
    return new TransactionInstruction({
        programId,
        keys: [
            {pubkey: user, isSigner: true, isWritable: true},
            {pubkey: userTokenAccount, isSigner: false, isWritable: true},
            {pubkey: userDataAccount, isSigner: false, isWritable: true},
            {pubkey: contractTokenAccount, isSigner: false, isWritable: true},
            {pubkey: contractDataAccount, isSigner: false, isWritable: true},
            {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
        ],
        data: instructionData
    })
}

export const signAndConfirmTransaction = async (
    connection: Connection,
    keyPair: Keypair,
    instructions: TransactionInstruction[]
) => {
    const latestBlockHash = await connection.getLatestBlockhash('confirmed');
    const messageV0 = new TransactionMessage({
        payerKey: keyPair.publicKey,
        recentBlockhash: latestBlockHash.blockhash,
        instructions: instructions
    }).compileToV0Message();
    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([keyPair]);
    const txId = await connection.sendTransaction(transaction, {maxRetries: 5});
    const confirmation = await connection.confirmTransaction({
        signature: txId,
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight
    });
    if (confirmation.value.err) {
        return [false, ""]
    }
    return [true, txId]
}