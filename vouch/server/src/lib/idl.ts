export const VOUCH_ESCROW_IDL = {
    version: '0.1.0',
    name: 'vouch_escrow',
    instructions: [
        {
            name: 'initializeConfig',
            accounts: [
                { name: 'config', isMut: true, isSigner: false },
                { name: 'payer', isMut: true, isSigner: true },
                { name: 'systemProgram', isMut: false, isSigner: false }
            ],
            args: [
                { name: 'protocolWallet', type: 'publicKey' },
                { name: 'feeBps', type: 'u16' }
            ]
        },
        {
            name: 'createEscrow',
            accounts: [
                { name: 'seller', isMut: true, isSigner: true },
                { name: 'escrowState', isMut: true, isSigner: true },
                { name: 'tokenMint', isMut: false, isSigner: false },
                { name: 'vault', isMut: true, isSigner: false },
                { name: 'vaultAuthority', isMut: false, isSigner: false },
                { name: 'tokenProgram', isMut: false, isSigner: false },
                { name: 'systemProgram', isMut: false, isSigner: false },
                { name: 'rent', isMut: false, isSigner: false }
            ],
            args: [
                { name: 'amount', type: 'u64' },
                { name: 'releaseTime', type: 'i64' },
                { name: 'descriptionHash', type: { array: ['u8', 32] } }
            ]
        },
        {
            name: 'fundEscrow',
            accounts: [
                { name: 'buyer', isMut: true, isSigner: true },
                { name: 'escrowState', isMut: true, isSigner: false },
                { name: 'buyerToken', isMut: true, isSigner: false },
                { name: 'tokenMint', isMut: false, isSigner: false },
                { name: 'vault', isMut: true, isSigner: false },
                { name: 'tokenProgram', isMut: false, isSigner: false }
            ],
            args: []
        },
        {
            name: 'markFunded',
            accounts: [
                { name: 'protocolWallet', isMut: true, isSigner: true },
                { name: 'config', isMut: false, isSigner: false },
                { name: 'escrowState', isMut: true, isSigner: false },
                { name: 'protocolToken', isMut: true, isSigner: false },
                { name: 'tokenMint', isMut: false, isSigner: false },
                { name: 'vault', isMut: true, isSigner: false },
                { name: 'tokenProgram', isMut: false, isSigner: false }
            ],
            args: [{ name: 'buyer', type: 'publicKey' }]
        },
        {
            name: 'markShipped',
            accounts: [
                { name: 'caller', isMut: true, isSigner: true },
                { name: 'config', isMut: false, isSigner: false },
                { name: 'escrowState', isMut: true, isSigner: false }
            ],
            args: []
        },
        {
            name: 'confirmDelivery',
            accounts: [
                { name: 'buyer', isMut: true, isSigner: true },
                { name: 'config', isMut: false, isSigner: false },
                { name: 'escrowState', isMut: true, isSigner: false },
                { name: 'buyerToken', isMut: true, isSigner: false },
                { name: 'tokenMint', isMut: false, isSigner: false },
                { name: 'vault', isMut: true, isSigner: false },
                { name: 'vaultAuthority', isMut: false, isSigner: false },
                { name: 'sellerToken', isMut: true, isSigner: false },
                { name: 'protocolToken', isMut: true, isSigner: false },
                { name: 'sellerProfile', isMut: true, isSigner: false },
                { name: 'tokenProgram', isMut: false, isSigner: false }
            ],
            args: []
        },
        {
            name: 'releaseFunds',
            accounts: [
                { name: 'protocolWallet', isMut: true, isSigner: true },
                { name: 'config', isMut: false, isSigner: false },
                { name: 'escrowState', isMut: true, isSigner: false },
                { name: 'tokenMint', isMut: false, isSigner: false },
                { name: 'vault', isMut: true, isSigner: false },
                { name: 'vaultAuthority', isMut: false, isSigner: false },
                { name: 'sellerToken', isMut: true, isSigner: false },
                { name: 'protocolToken', isMut: true, isSigner: false },
                { name: 'sellerProfile', isMut: true, isSigner: false },
                { name: 'tokenProgram', isMut: false, isSigner: false }
            ],
            args: []
        },
        {
            name: 'addRating',
            accounts: [
                { name: 'buyer', isMut: true, isSigner: true },
                { name: 'escrowState', isMut: true, isSigner: false },
                { name: 'sellerProfile', isMut: true, isSigner: false }
            ],
            args: [{ name: 'rating', type: 'u8' }]
        },
        {
            name: 'initSellerProfile',
            accounts: [
                { name: 'seller', isMut: true, isSigner: true },
                { name: 'sellerProfile', isMut: true, isSigner: false },
                { name: 'systemProgram', isMut: false, isSigner: false }
            ],
            args: []
        },
        {
            name: 'updateConfig',
            accounts: [
                { name: 'config', isMut: true, isSigner: false },
                { name: 'protocolWallet', isMut: false, isSigner: true }
            ],
            args: [
                { name: 'protocolWallet', type: { option: 'publicKey' } },
                { name: 'feeBps', type: { option: 'u16' } }
            ]
        },
        {
            name: 'closeEscrow',
            accounts: [
                { name: 'protocolWallet', isMut: true, isSigner: true },
                { name: 'config', isMut: false, isSigner: false },
                { name: 'escrowState', isMut: true, isSigner: false },
                { name: 'vault', isMut: true, isSigner: false },
                { name: 'vaultAuthority', isMut: false, isSigner: false },
                { name: 'sellerToken', isMut: true, isSigner: false },
                { name: 'protocolToken', isMut: true, isSigner: false },
                { name: 'tokenProgram', isMut: false, isSigner: false }
            ],
            args: []
        }
    ],
    accounts: [
        {
            name: 'config',
            type: {
                kind: 'struct',
                fields: [
                    { name: 'protocolWallet', type: 'publicKey' },
                    { name: 'feeBps', type: 'u16' },
                    { name: 'bump', type: 'u8' }
                ]
            }
        },
        {
            name: 'escrowState',
            type: {
                kind: 'struct',
                fields: [
                    { name: 'seller', type: 'publicKey' },
                    { name: 'buyer', type: 'publicKey' },
                    { name: 'tokenMint', type: 'publicKey' },
                    { name: 'amount', type: 'u64' },
                    { name: 'createdAt', type: 'i64' },
                    { name: 'fundedAt', type: 'i64' },
                    { name: 'shippedAt', type: 'i64' },
                    { name: 'releaseAt', type: 'i64' },
                    { name: 'status', type: { defined: 'EscrowStatus' } },
                    { name: 'vaultBump', type: 'u8' },
                    { name: 'descriptionHash', type: { array: ['u8', 32] } },
                    { name: 'disputeHash', type: { array: ['u8', 32] } }
                ]
            }
        },
        {
            name: 'sellerProfile',
            type: {
                kind: 'struct',
                fields: [
                    { name: 'seller', type: 'publicKey' },
                    { name: 'totalTransactions', type: 'u64' },
                    { name: 'ratingSum', type: 'u64' },
                    { name: 'ratingCount', type: 'u64' },
                    { name: 'disputesWon', type: 'u64' },
                    { name: 'verified', type: 'bool' },
                    { name: 'bump', type: 'u8' }
                ]
            }
        }
    ],
    types: [
        {
            name: 'EscrowStatus',
            type: {
                kind: 'enum',
                variants: [
                    { name: 'Created' },
                    { name: 'Funded' },
                    { name: 'Shipped' },
                    { name: 'Delivered' },
                    { name: 'Released' },
                    { name: 'Refunded' },
                    { name: 'Cancelled' },
                    { name: 'Disputed' },
                    { name: 'Resolved' }
                ]
            }
        }
    ]
} as const;
