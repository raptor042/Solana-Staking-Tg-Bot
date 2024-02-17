import {Connection, Keypair} from "@solana/web3.js";
import { encode, decode } from "bs58";
import {DEVNET_CONNECTION_URL, MAINNET_CONNECTION_URL} from "./solana/constants";

export const keyPairToB58 = (keyPair: Keypair) => {
    return encode(keyPair.secretKey)
}

export const keyPairFromB58 = (secret: string) => {
    const decoded = decode(secret);
    return Keypair.fromSecretKey(decoded);
}

export const formatDateTime = (date: Date) => {
    return [date.getMonth()+1, date.getDate(),
            date.getFullYear()].join('/')+' '+
        [date.getHours(),
            date.getMinutes(),
            date.getSeconds()].join(':');
}

export const getConnection = () => {
    if (process.env.NODE_ENV == "development") {
        return new Connection(DEVNET_CONNECTION_URL, "confirmed")
    } else {
        return new Connection(MAINNET_CONNECTION_URL, "confirmed")
    }
}