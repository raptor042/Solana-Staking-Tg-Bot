import {makeStakeInstruction, makeUnstakeInstruction, signAndConfirmTransaction} from "./utils";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { StakeType } from "./types";
import { CONTRACT_DATA_ACCOUNT, CONTRACT_TOKEN_ACCOUNT, PROGRAM_ID } from "./constants";

export const performStake = async (
    connection: Connection,
    keyPair: Keypair,
    amount: number,
    lockDuration: number,
    userTokenAccount: PublicKey,
) => {
    const programId = new PublicKey(PROGRAM_ID);
    const [userDataAccount,] = PublicKey.findProgramAddressSync(
        [Buffer.from("spl_staking_user", "utf-8"), keyPair.publicKey.toBuffer()],
        programId
    );
    const ix = makeStakeInstruction(
        StakeType.NORMAL,
        amount,
        lockDuration,
        programId,
        keyPair.publicKey,
        userTokenAccount,
        userDataAccount,
        new PublicKey(CONTRACT_TOKEN_ACCOUNT),
        new PublicKey(CONTRACT_DATA_ACCOUNT)
    );
    return await signAndConfirmTransaction(connection, keyPair, [ix]);
}

export const performUnStake = async (
    connection: Connection,
    keyPair: Keypair,
    userTokenAccount: PublicKey,
) => {
    const programId = new PublicKey(PROGRAM_ID);
    const [userDataAccount,] = PublicKey.findProgramAddressSync(
        [Buffer.from("spl_staking_user", "utf-8"), keyPair.publicKey.toBuffer()],
        programId
    );
    const ix = makeUnstakeInstruction(
        programId,
        keyPair.publicKey,
        userTokenAccount,
        userDataAccount,
        new PublicKey(CONTRACT_TOKEN_ACCOUNT),
        new PublicKey(CONTRACT_DATA_ACCOUNT)
    );
    return await signAndConfirmTransaction(connection, keyPair, [ix]);
}