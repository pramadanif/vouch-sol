import * as anchor from "@coral-xyz/anchor";
import { createMint } from "@solana/spl-token";

async function main() {
  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;
  const payer = (provider.wallet as any).payer;

  console.log("Creating USDC Mint...");
  const usdcMint = await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    6
  );
  console.log("USDC Mint:", usdcMint.toBase58());

  console.log("Creating IDRX Mint...");
  const idrxMint = await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    6
  );
  console.log("IDRX Mint:", idrxMint.toBase58());
}

main();
