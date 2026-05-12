
import { Keypair, Connection } from '@solana/web3.js';
import fs from 'fs';

const idPath = '/Users/muhammadbaguspramadani/Documents/myproject/vouch-sol/vouch/solana-program/id.json';
const secretKey = JSON.parse(fs.readFileSync(idPath, 'utf8'));
const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
console.log('Address:', keypair.publicKey.toBase58());

const connection = new Connection('https://api.devnet.solana.com');
connection.getBalance(keypair.publicKey).then(balance => {
    console.log('Balance:', balance / 1e9, 'SOL');
});
