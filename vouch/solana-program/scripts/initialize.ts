import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VouchEscrow } from "../target/types/vouch_escrow";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VouchEscrow as Program<VouchEscrow>;
  
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
