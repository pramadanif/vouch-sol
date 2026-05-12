import { sha256 } from '@noble/hashes/sha256';
const result = sha256(new TextEncoder().encode("test"));
console.log("Length:", result.length);
