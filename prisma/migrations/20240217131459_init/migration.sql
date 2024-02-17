-- CreateTable
CREATE TABLE "User" (
    "chatId" BIGINT NOT NULL,
    "walletSecretKey" TEXT NOT NULL,
    "walletPublicKey" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("chatId")
);
