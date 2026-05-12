import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VOUCH_ESCROW_IDL } from "../../server/src/lib/idl";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(
      VOUCH_ESCROW_IDL as any,
      new anchor.web3.PublicKey("5SGRD6bVjaD75nhMtnDqcjpVwqcqqsc6Z6sAGBwP3Q6W"),
      provider
  );
  
  const [config] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log("Config PDA:", config.toBase58());
  console.log("Protocol Wallet:", provider.wallet.publicKey.toBase58());

  try {
    const tx = await program.methods
      .initializeConfig(provider.wallet.publicKey, 100) // 1% fee
      .accounts({
        config: config,
        payer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    
    console.log("Initialization successful! Transaction signature:", tx);
  } catch (err) {
    console.error("Initialization failed:", err);
  }
}

main();
