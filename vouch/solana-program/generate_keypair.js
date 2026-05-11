const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const keypair = Keypair.generate();
const secretKey = JSON.stringify(Array.from(keypair.secretKey));
const publicKey = keypair.publicKey.toBase58();

const keypairPath = path.join(process.cwd(), 'id.json');
fs.writeFileSync(keypairPath, secretKey);

console.log('Public Key:', publicKey);
console.log('Keypair saved to:', keypairPath);
