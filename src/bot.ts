import { Bot, Context, InlineKeyboard, session } from "grammy";
import {
    type Conversation,
    type ConversationFlavor,
    conversations,
    createConversation,
} from "@grammyjs/conversations";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { encode } from "bs58";
import { webhookCallback } from "grammy";
import express from "express";
import { PrismaClient } from "@prisma/client";
import {formatDateTime, getConnection, keyPairFromB58, keyPairToB58} from "./utils";
import {performStake, performUnStake} from "./solana/services";
import {formatAmount, getContractData, getTokenAccount, getUserData} from "./solana/utils";
import {CONTRACT_DATA_ACCOUNT, STAKE_TOKEN_DECIMALS, STAKE_TOKEN_MINT} from "./solana/constants";

type BotContext = Context & ConversationFlavor;
type BotConversation = Conversation<BotContext>;

const bot = new Bot<BotContext>(process.env.TELEGRAM_TOKEN || "");
const prisma = new PrismaClient();
const connection = getConnection();

bot.use(session({ initial: () => ({})}));
bot.use(conversations());

const composeStartMessage = (pk: string, solBalance: number, libraBalance: number, newUser: boolean) => {
    if (newUser) {
        return `Welcome to Libra Bot
A bot for staking Libra tokens 💹 and earning rewards 📈.

You currently have no SOL balance. To get started with staking, send some SOL to your libra wallet address:

<code>${pk}</code> (tap to copy)

Once done, transfer the amount of $Libra Tokens you would like to stake into the above wallet address.

You can then click on the Stake and unstake buttons below to stake and unstake $Libra tokens from your wallet.
For more info on your wallet and to retrieve your private key, tap the wallet button below. Please do not expose your private key ❗️❗️.`;
    } else {
        return `Welcome to Libra Bot
A bot for staking Libra tokens 💹 and earning rewards 📈.

SOL BALANCE: ${solBalance}
$LIBRA BALANCE: ${libraBalance}

WALLET: <code>${pk}</code> (tap to copy)

You can transfer SOL and $Libra to the wallet above for staking.

You can then click on the Stake and unstake buttons below to stake and unstake $Libra tokens from your wallet.
For more info on your wallet and to retrieve your private key, tap the wallet button below. Please do not expose your private key ❗️❗️.`
    }
}

export const composeWalletMessage = (pk: string, solBalance: number, libraBalance: number) => {
    return `Your Wallet:
    
  Address: <code>${pk}</code>
  SOL Balance: ${solBalance} SOL
  LIBRA Balance: ${libraBalance} LIBRA
  
  Tap to copy the address and send SOL to deposit.`;
}

const startCommandHandler = async (ctx: Context) => {
    let message = "";
    if (ctx.chat && ctx.from) {
        const user = await prisma.user.findUnique({
            where: {
                chatId: ctx.chat.id
            }
        });
        prisma.$disconnect()
        if (user) {
            const solBalance = (await connection.getBalance(new PublicKey(user.walletPublicKey)))/LAMPORTS_PER_SOL;
            let libraBalance = 0;
            const userTokenAccount = await getTokenAccount(
                connection, new PublicKey(user.walletPublicKey),
                new PublicKey(STAKE_TOKEN_MINT)
            );
            if (userTokenAccount) {
                libraBalance = parseFloat(formatAmount(parseFloat(userTokenAccount.amount.toString()), STAKE_TOKEN_DECIMALS));
            }
            message = composeStartMessage(user.walletPublicKey, solBalance, libraBalance, false);
        } else {
            const keyPair = Keypair.generate();
            const secretKey = keyPairToB58(keyPair);
            await prisma.user.create({
                data: {
                    chatId: ctx.chat?.id,
                    walletPublicKey: keyPair.publicKey.toString(),
                    walletSecretKey: secretKey
                }
            });
            message = composeStartMessage(keyPair.publicKey.toString(), 0, 0, true)
        }
        const keyboard = new InlineKeyboard();
        keyboard.row().text("Stake 🤑", "stake").text("Unstake 🐷", "unstake")
        keyboard.row().text("Staking Info 💵", "staking_info").text("Wallet 💳", "wallet")
        await ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: keyboard
        })
    }
}

const stakingInfoHandler = async (ctx: BotContext) => {
    const user = await prisma.user.findUnique({
        where: {
            chatId: ctx.chat?.id
        }
    });
    prisma.$disconnect();
    if (user) {
        const userDataAccount = await getUserData(
            connection, new PublicKey(user.walletPublicKey)
        );
        const contractData = await getContractData(connection, new PublicKey(CONTRACT_DATA_ACCOUNT));
        if (userDataAccount) {
            const totalStaked = formatAmount(parseInt(userDataAccount.totalStaked.toString()), STAKE_TOKEN_DECIMALS);
            //const unstakeTime = new Date((parseInt((userDataAccount.stakeTs.toString())) + (24*3600))*1000);
            const stakeTime = new Date(parseInt(userDataAccount.stakeTs.toString()) * 1000);
            const formattedStakeTime = formatDateTime(stakeTime);
            //const formattedUnstakeTime = formatDateTime(unstakeTime);
            let apy = 0;
            if (contractData) {
                apy = parseInt(contractData.normalStakingApy.toString()) / 10
            }
            const stakeDuration = Date.now() - parseInt(userDataAccount.stakeTs.toString()) * 1000;
            const earnings = ((apy * parseInt(userDataAccount.totalStaked.toString()) * stakeDuration)/31536000000)/10**STAKE_TOKEN_DECIMALS;
            const message = `<b>Your Staking Info 🚀</b>:


  Total Staked 💰: ${totalStaked} LIBRA
  
  Stake Time ⏰: ${formattedStakeTime}
  
  APY 🤑: ${apy}%
  
  Current Earnings 💵: ${earnings} LIBRA
  
  Unstake Time: You cannot unstake until after 24hrs of staking.`;
            const keyboard = new InlineKeyboard();
            keyboard.row().text("Unstake 🐷", "unstake")
            await ctx.reply(message, {
                parse_mode: "HTML",
                reply_markup: keyboard
            })
        }
    }

}

const walletHandler = async (ctx: BotContext) => {
    const user = await prisma.user.findUnique({
        where: {
            chatId: ctx.chat?.id
        }
    });
    prisma.$disconnect()
    if (user) {
        const solBalance = (await connection.getBalance(new PublicKey(user.walletPublicKey)))/LAMPORTS_PER_SOL;
        let libraBalance = 0;
        const userTokenAccount = await getTokenAccount(
            connection, new PublicKey(user.walletPublicKey),
            new PublicKey(STAKE_TOKEN_MINT)
        );
        if (userTokenAccount) {
            libraBalance = parseFloat(formatAmount(parseFloat(userTokenAccount.amount.toString()), STAKE_TOKEN_DECIMALS));
        }
        const message = composeWalletMessage(user.walletPublicKey, solBalance, libraBalance);
        const keyboard = new InlineKeyboard();
        keyboard.row().text("Deposit", "deposit").text("Withdraw", "withdraw")
        keyboard.row().text("Export Private Key", "private_key")
        await ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: keyboard
        })
    } else {
        await ctx.reply("Cannot perform operation. User does not have a wallet.")
    }
}

const stake = async (conversation: BotConversation, ctx: BotContext) => {
    await ctx.reply("Enter amount of $Libra to stake...");
    const user = await prisma.user.findUnique({
        where: {
            chatId: ctx.chat?.id
        }
    });
    prisma.$disconnect();
    if (!user) {
        await ctx.reply("Cannot perform operation. User does not have a wallet.")
    } else {
        const { message } = await conversation.wait();
        if (message?.text) {
            const amount = parseInt(message.text);
            if (Number.isNaN(amount)) {
                await ctx.reply("Invalid amount entered... try again");
                return
            }
            const contractData = await getContractData(connection, new PublicKey(CONTRACT_DATA_ACCOUNT));
            if (!contractData) {
                await ctx.reply("Staking contract has not been initialized by admin..");
                return
            }
            const minimumStakeAmount = parseFloat(formatAmount(parseInt(contractData.minimumStakeAmount.toString()), STAKE_TOKEN_DECIMALS));
            if (amount < minimumStakeAmount) {
                await ctx.reply(`Cannot perform staking ❌. Minimum Stake Amount: ${minimumStakeAmount}`)
                return
            }
            const keypair = keyPairFromB58(user.walletSecretKey);
            const userTokenAccount = await getTokenAccount(
                connection, keypair.publicKey,
                new PublicKey(STAKE_TOKEN_MINT)
            )
            if (userTokenAccount) {
                if (parseFloat(formatAmount(parseInt(userTokenAccount.amount.toString()), STAKE_TOKEN_DECIMALS)) >= amount) {
                    const [ success, txHash ] = await performStake(
                        connection,
                        keypair,
                        amount,
                        0,
                        userTokenAccount.address
                    )
                    if (success) {
                        await ctx.reply(`${amount} $Libra successfully staked 🚀🎉`)
                    } else {
                        await ctx.reply("An Error Occurred: Could not stake tokens. ❌")
                    }
                } else {
                    await ctx.reply("Insufficient $Libra balance for staking 😔")
                }

            } else {
                await ctx.reply("Token account for $Libra not found ❌. Please send some tokens into your bot wallet.")
            }

        } else {
            await ctx.reply("Invalid input.. please try again")
        }
    }
}
bot.use(createConversation(stake))


bot.command("start", startCommandHandler);
bot.command("wallet", walletHandler);
bot.command("staking_info", stakingInfoHandler)
bot.callbackQuery("stake", async (ctx: BotContext) => {
    await ctx.conversation.enter("stake");
})
bot.callbackQuery("unstake", async (ctx: BotContext) => {
    const user = await prisma.user.findUnique({
        where: {
            chatId: ctx.chat?.id
        }
    });
    prisma.$disconnect();
    if (!user) {
        await ctx.reply("Cannot perform operation. User does not have a wallet.")
    } else {
        const keypair = keyPairFromB58(user.walletSecretKey);
        const userTokenAccount = await getTokenAccount(
            connection, keypair.publicKey,
            new PublicKey(STAKE_TOKEN_MINT)
        )
        const userDataAccount = await getUserData(
            connection, new PublicKey(user.walletPublicKey)
        );
        if (!userDataAccount) {
            await ctx.reply("Cannot perform unstake without staking tokens ❌❌");
            return
        }
        if ((Date.now()/1000 - parseInt(userDataAccount.stakeTs.toString())) < 24*60*60) {
            await ctx.reply("Staked tokens has not been held for 24hrs ❌");
            return
        }
        if (userTokenAccount) {
            const [ success, txHash ] = await performUnStake(
                connection,
                keypair,
                userTokenAccount.address
            );
            if (success) {
                await ctx.reply(`$Libra successfully un-staked 🚀🎉`)
            } else {
                await ctx.reply("An Error Occurred: Could not un-stake tokens. ❌")
            }
        } else {
            await ctx.reply("Token account for $Libra not found ❌. Please send some tokens into your bot wallet.")
        }
    }
})
bot.callbackQuery("wallet", walletHandler);
bot.callbackQuery("private_key", async (ctx: BotContext) => {
    const message = "Are you sure you want to export your <b>Private Key?</b>";
    const keyboard = new InlineKeyboard();
    keyboard.row().text("Yes", "pk_yes").text("No", "pk_no")
    await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: keyboard
    })
});
bot.callbackQuery("pk_yes", async (ctx: BotContext) => {
    const user = await prisma.user.findUnique({
        where: {
            chatId: ctx.chat?.id
        }
    });
    prisma.$disconnect()
    if (user) {
        const message = `Your Private Key is:

            <code>${user.walletSecretKey}</code>

        Delete this message once you are done.`
        await ctx.reply(message, {
            parse_mode: "HTML"
        })
    }
});
bot.callbackQuery("staking_info", stakingInfoHandler)
bot.api.setMyCommands([
    { command: "start", description: "Start the bot 🤖" },
    { command: "wallet", description: "View your wallet information 💳"},
    { command: "staking_info", description: "Monitor staked tokens and accrued interest 💹"},
]).then((val) => val);
bot.start().then((val) => val);

// Start the server
// if (process.env.NODE_ENV === "production") {
//     // Use Webhooks for the production server
//     const app = express();
//     app.use(express.json());
//     app.use(webhookCallback(bot, "express"));
//
//     const PORT = process.env.PORT || 3000;
//     app.listen(PORT, () => {
//         console.log(`Bot listening on port ${PORT}`);
//     });
// } else {
//     // Use Long Polling for development
//     bot.start().then((val) => val);
// }