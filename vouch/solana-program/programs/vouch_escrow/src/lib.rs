use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("DmPtoRqbLZwjwWeecH2uYnrr4xmyvHoabSkoSHS9Q6GG");

const AUTO_RELEASE_DELAY: i64 = 14 * 24 * 60 * 60;
const SHIPPING_DEADLINE: i64 = 30 * 24 * 60 * 60;
const MAX_FEE_BPS: u16 = 1000; // 10%

const CONFIG_SPACE: usize = 8 + 32 + 2 + 1;
const SELLER_PROFILE_SPACE: usize = 8 + 32 + 8 + 8 + 8 + 8 + 1 + 1;
const ESCROW_SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 32 + 32;

#[program]
pub mod vouch_escrow {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        protocol_wallet: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        require!(protocol_wallet != Pubkey::default(), EscrowError::InvalidProtocolWallet);
        require!(fee_bps <= MAX_FEE_BPS, EscrowError::InvalidFeeBps);

        let config = &mut ctx.accounts.config;
        config.protocol_wallet = protocol_wallet;
        config.fee_bps = fee_bps;
        config.bump = *ctx.bumps.get("config").unwrap();

        emit!(ConfigUpdated { protocol_wallet, fee_bps });
        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        protocol_wallet: Option<Pubkey>,
        fee_bps: Option<u16>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        if let Some(pw) = protocol_wallet {
            require!(pw != Pubkey::default(), EscrowError::InvalidProtocolWallet);
            config.protocol_wallet = pw;
        }
        if let Some(fb) = fee_bps {
            require!(fb <= MAX_FEE_BPS, EscrowError::InvalidFeeBps);
            config.fee_bps = fb;
        }
        emit!(ConfigUpdated { 
            protocol_wallet: config.protocol_wallet, 
            fee_bps: config.fee_bps 
        });
        Ok(())
    }

    pub fn init_seller_profile(ctx: Context<InitSellerProfile>) -> Result<()> {
        let profile = &mut ctx.accounts.seller_profile;
        profile.seller = ctx.accounts.seller.key();
        profile.total_transactions = 0;
        profile.rating_sum = 0;
        profile.rating_count = 0;
        profile.disputes_won = 0;
        profile.verified = false;
        profile.bump = *ctx.bumps.get("seller_profile").unwrap();

        emit!(SellerProfileInitialized { seller: profile.seller });
        Ok(())
    }

    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        amount: u64,
        release_at: i64,
        description_hash: [u8; 32],
    ) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(release_at > Clock::get()?.unix_timestamp, EscrowError::InvalidReleaseTime);

        let escrow = &mut ctx.accounts.escrow_state;
        escrow.seller = ctx.accounts.seller.key();
        escrow.buyer = Pubkey::default();
        escrow.token_mint = ctx.accounts.token_mint.key();
        escrow.amount = amount;
        escrow.created_at = Clock::get()?.unix_timestamp;
        escrow.funded_at = 0;
        escrow.shipped_at = 0;
        escrow.release_at = release_at;
        escrow.status = EscrowStatus::Created;
        escrow.vault_bump = *ctx.bumps.get("vault_authority").unwrap();
        escrow.description_hash = description_hash;
        escrow.dispute_hash = [0u8; 32];

        emit!(EscrowCreated {
            escrow: escrow.key(),
            seller: escrow.seller,
            token_mint: escrow.token_mint,
            amount,
            release_at,
        });
        Ok(())
    }

    pub fn fund_escrow(ctx: Context<FundEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_state;
        require!(escrow.status == EscrowStatus::Created, EscrowError::InvalidStatus);
        require!(escrow.token_mint == ctx.accounts.token_mint.key(), EscrowError::InvalidMint);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_token.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            escrow.amount,
        )?;

        escrow.buyer = ctx.accounts.buyer.key();
        escrow.funded_at = Clock::get()?.unix_timestamp;
        escrow.status = EscrowStatus::Funded;

        emit!(EscrowFunded {
            escrow: escrow.key(),
            buyer: escrow.buyer,
            token_mint: escrow.token_mint,
            amount: escrow.amount,
        });
        Ok(())
    }

    pub fn mark_funded(ctx: Context<MarkFunded>, buyer: Pubkey) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_state;
        require!(escrow.status == EscrowStatus::Created, EscrowError::InvalidStatus);
        require!(escrow.token_mint == ctx.accounts.token_mint.key(), EscrowError::InvalidMint);
        require!(ctx.accounts.protocol_wallet.key() == ctx.accounts.config.protocol_wallet, EscrowError::Unauthorized);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.protocol_token.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.protocol_wallet.to_account_info(),
                },
            ),
            escrow.amount,
        )?;

        escrow.buyer = buyer;
        escrow.funded_at = Clock::get()?.unix_timestamp;
        escrow.status = EscrowStatus::Funded;

        emit!(EscrowFunded {
            escrow: escrow.key(),
            buyer,
            token_mint: escrow.token_mint,
            amount: escrow.amount,
        });
        Ok(())
    }

    pub fn mark_shipped(ctx: Context<MarkShipped>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_state;
        require!(escrow.status == EscrowStatus::Funded, EscrowError::InvalidStatus);

        let now = Clock::get()?.unix_timestamp;
        if escrow.funded_at > 0 {
            require!(now <= escrow.funded_at + SHIPPING_DEADLINE, EscrowError::ShippingDeadlinePassed);
        }

        let caller = ctx.accounts.caller.key();
        let protocol_wallet = ctx.accounts.config.protocol_wallet;
        require!(caller == escrow.seller || caller == protocol_wallet, EscrowError::Unauthorized);

        escrow.shipped_at = now;
        escrow.release_at = now + AUTO_RELEASE_DELAY;
        escrow.status = EscrowStatus::Shipped;

        emit!(EscrowShipped {
            escrow: escrow.key(),
            auto_release_at: escrow.release_at,
        });
        Ok(())
    }

    pub fn confirm_delivery(ctx: Context<ConfirmDelivery>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_state;
        require!(escrow.status == EscrowStatus::Shipped, EscrowError::InvalidStatus);
        require!(escrow.buyer != Pubkey::default(), EscrowError::MissingBuyer);
        require!(ctx.accounts.buyer.key() == escrow.buyer, EscrowError::Unauthorized);

        escrow.status = EscrowStatus::Delivered;
        emit!(EscrowDeliveryConfirmed {
            escrow: escrow.key(),
            buyer: escrow.buyer,
        });

        release_to_seller(
            escrow,
            &ctx.accounts.vault,
            &ctx.accounts.vault_authority,
            &ctx.accounts.seller_token,
            &ctx.accounts.protocol_token,
            &ctx.accounts.token_program,
            &ctx.accounts.config,
            false,
        )?;

        update_seller_stats(&mut ctx.accounts.seller_profile)?;

        Ok(())
    }

    pub fn release_funds(ctx: Context<ReleaseFunds>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_state;
        require!(escrow.status == EscrowStatus::Shipped, EscrowError::InvalidStatus);

        let now = Clock::get()?.unix_timestamp;
        require!(now >= escrow.release_at, EscrowError::ReleaseNotReady);
        require!(ctx.accounts.protocol_wallet.key() == ctx.accounts.config.protocol_wallet, EscrowError::Unauthorized);

        release_to_seller(
            escrow,
            &ctx.accounts.vault,
            &ctx.accounts.vault_authority,
            &ctx.accounts.seller_token,
            &ctx.accounts.protocol_token,
            &ctx.accounts.token_program,
            &ctx.accounts.config,
            true,
        )?;

        update_seller_stats(&mut ctx.accounts.seller_profile)?;

        Ok(())
    }

    pub fn cancel_escrow(ctx: Context<CancelEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_state;
        require!(escrow.status == EscrowStatus::Created, EscrowError::InvalidStatus);

        let caller = ctx.accounts.caller.key();
        let protocol_wallet = ctx.accounts.config.protocol_wallet;
        require!(caller == escrow.seller || caller == protocol_wallet, EscrowError::Unauthorized);

        escrow.status = EscrowStatus::Cancelled;

        emit!(EscrowCancelled { escrow: escrow.key() });
        Ok(())
    }

    pub fn initiate_dispute(ctx: Context<InitiateDispute>, dispute_hash: [u8; 32]) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_state;
        require!(escrow.status == EscrowStatus::Funded || escrow.status == EscrowStatus::Shipped, EscrowError::InvalidStatus);

        let caller = ctx.accounts.caller.key();
        require!(caller == escrow.buyer || caller == escrow.seller, EscrowError::Unauthorized);

        escrow.status = EscrowStatus::Disputed;
        escrow.dispute_hash = dispute_hash;

        emit!(EscrowDisputed {
            escrow: escrow.key(),
            raised_by: caller,
        });
        Ok(())
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, outcome: DisputeOutcome) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_state;
        require!(escrow.status == EscrowStatus::Disputed, EscrowError::InvalidStatus);
        require!(ctx.accounts.protocol_wallet.key() == ctx.accounts.config.protocol_wallet, EscrowError::Unauthorized);

        match outcome {
            DisputeOutcome::ReleaseToSeller => {
                release_to_seller(
                    escrow,
                    &ctx.accounts.vault,
                    &ctx.accounts.vault_authority,
                    &ctx.accounts.seller_token,
                    &ctx.accounts.protocol_token,
                    &ctx.accounts.token_program,
                    &ctx.accounts.config,
                    false,
                )?;

                ctx.accounts.seller_profile.disputes_won = ctx.accounts.seller_profile.disputes_won.saturating_add(1);
                update_seller_stats(&mut ctx.accounts.seller_profile)?;
            }
            DisputeOutcome::ReleaseToBuyer => {
                release_to_buyer(
                    escrow,
                    &ctx.accounts.vault,
                    &ctx.accounts.vault_authority,
                    &ctx.accounts.buyer_token,
                    &ctx.accounts.token_program,
                )?;
            }
        }

        escrow.status = EscrowStatus::Resolved;
        emit!(DisputeResolved {
            escrow: escrow.key(),
            outcome,
        });
        Ok(())
    }

    pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_state;
        require!(escrow.status == EscrowStatus::Funded || escrow.status == EscrowStatus::Shipped || escrow.status == EscrowStatus::Disputed, EscrowError::InvalidStatus);
        require!(ctx.accounts.protocol_wallet.key() == ctx.accounts.config.protocol_wallet, EscrowError::Unauthorized);
        require!(escrow.buyer != Pubkey::default(), EscrowError::MissingBuyer);

        release_to_buyer(
            escrow,
            &ctx.accounts.vault,
            &ctx.accounts.vault_authority,
            &ctx.accounts.buyer_token,
            &ctx.accounts.token_program,
        )?;

        escrow.status = EscrowStatus::Refunded;
        emit!(EscrowRefunded {
            escrow: escrow.key(),
            buyer: escrow.buyer,
            amount: escrow.amount,
        });
        Ok(())
    }

    pub fn add_rating(ctx: Context<AddRating>, rating: u8) -> Result<()> {
        require!(rating >= 1 && rating <= 5, EscrowError::InvalidRating);

        let escrow = &ctx.accounts.escrow_state;
        require!(escrow.status == EscrowStatus::Released || escrow.status == EscrowStatus::Resolved, EscrowError::InvalidStatus);
        require!(ctx.accounts.buyer.key() == escrow.buyer, EscrowError::Unauthorized);

        let profile = &mut ctx.accounts.seller_profile;
        profile.rating_sum = profile.rating_sum.saturating_add(rating as u64);
        profile.rating_count = profile.rating_count.saturating_add(1);

        if profile.rating_count >= 5 {
            profile.verified = true;
        }

        emit!(RatingAdded {
            seller: profile.seller,
            rating,
        });
        Ok(())
    }

    pub fn close_escrow(ctx: Context<CloseEscrow>) -> Result<()> {
        let escrow = &ctx.accounts.escrow_state;
        require!(
            escrow.status == EscrowStatus::Released || 
            escrow.status == EscrowStatus::Refunded || 
            escrow.status == EscrowStatus::Cancelled ||
            escrow.status == EscrowStatus::Resolved,
            EscrowError::InvalidStatus
        );
        Ok(())
    }
}

fn release_to_seller(
    escrow: &mut Account<EscrowState>,
    vault: &Account<TokenAccount>,
    vault_authority: &UncheckedAccount,
    seller_token: &Account<TokenAccount>,
    protocol_token: &Account<TokenAccount>,
    token_program: &Program<Token>,
    config: &Account<Config>,
    is_auto_release: bool,
) -> Result<()> {
    let fee = escrow
        .amount
        .checked_mul(config.fee_bps as u64)
        .ok_or(EscrowError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(EscrowError::MathOverflow)?;

    let seller_amount = escrow.amount.checked_sub(fee).ok_or(EscrowError::MathOverflow)?;

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"vault-authority",
        escrow.key().as_ref(),
        &[escrow.vault_bump],
    ]];

    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: vault.to_account_info(),
                to: seller_token.to_account_info(),
                authority: vault_authority.to_account_info(),
            },
            signer_seeds,
        ),
        seller_amount,
    )?;

    if fee > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                Transfer {
                    from: vault.to_account_info(),
                    to: protocol_token.to_account_info(),
                    authority: vault_authority.to_account_info(),
                },
                signer_seeds,
            ),
            fee,
        )?;
    }

    escrow.status = EscrowStatus::Released;
    emit!(EscrowReleased {
        escrow: escrow.key(),
        seller: escrow.seller,
        amount: seller_amount,
        is_auto_release,
    });
    Ok(())
}

fn release_to_buyer(
    escrow: &mut Account<EscrowState>,
    vault: &Account<TokenAccount>,
    vault_authority: &UncheckedAccount,
    buyer_token: &Account<TokenAccount>,
    token_program: &Program<Token>,
) -> Result<()> {
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"vault-authority",
        escrow.key().as_ref(),
        &[escrow.vault_bump],
    ]];

    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: vault.to_account_info(),
                to: buyer_token.to_account_info(),
                authority: vault_authority.to_account_info(),
            },
            signer_seeds,
        ),
        escrow.amount,
    )?;

    Ok(())
}

fn update_seller_stats(profile: &mut Account<SellerProfile>) -> Result<()> {
    profile.total_transactions = profile.total_transactions.saturating_add(1);
    if profile.rating_count >= 5 {
        profile.verified = true;
    }
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = payer,
        space = CONFIG_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        constraint = protocol_wallet.key() == config.protocol_wallet @ EscrowError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    pub protocol_wallet: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitSellerProfile<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        init,
        payer = seller,
        space = SELLER_PROFILE_SPACE,
        seeds = [b"seller-profile", seller.key().as_ref()],
        bump
    )]
    pub seller_profile: Account<'info, SellerProfile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateEscrow<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        init,
        payer = seller,
        space = ESCROW_SPACE
    )]
    pub escrow_state: Account<'info, EscrowState>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = seller,
        token::mint = token_mint,
        token::authority = vault_authority,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"vault-authority", escrow_state.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub escrow_state: Account<'info, EscrowState>,
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = buyer
    )]
    pub buyer_token: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct MarkFunded<'info> {
    #[account(mut)]
    pub protocol_wallet: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub escrow_state: Account<'info, EscrowState>,
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = protocol_wallet
    )]
    pub protocol_token: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct MarkShipped<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub escrow_state: Account<'info, EscrowState>,
}

#[derive(Accounts)]
pub struct ConfirmDelivery<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub escrow_state: Account<'info, EscrowState>,
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = buyer
    )]
    pub buyer_token: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"vault-authority", escrow_state.key().as_ref()],
        bump = escrow_state.vault_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = escrow_state.seller
    )]
    pub seller_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = config.protocol_wallet
    )]
    pub protocol_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"seller-profile", escrow_state.seller.as_ref()],
        bump = seller_profile.bump
    )]
    pub seller_profile: Account<'info, SellerProfile>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReleaseFunds<'info> {
    #[account(mut)]
    pub protocol_wallet: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub escrow_state: Account<'info, EscrowState>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"vault-authority", escrow_state.key().as_ref()],
        bump = escrow_state.vault_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = escrow_state.seller
    )]
    pub seller_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = config.protocol_wallet
    )]
    pub protocol_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"seller-profile", escrow_state.seller.as_ref()],
        bump = seller_profile.bump
    )]
    pub seller_profile: Account<'info, SellerProfile>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelEscrow<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub escrow_state: Account<'info, EscrowState>,
}

#[derive(Accounts)]
pub struct InitiateDispute<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(mut)]
    pub escrow_state: Account<'info, EscrowState>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut)]
    pub protocol_wallet: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub escrow_state: Account<'info, EscrowState>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"vault-authority", escrow_state.key().as_ref()],
        bump = escrow_state.vault_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = escrow_state.seller
    )]
    pub seller_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = escrow_state.buyer
    )]
    pub buyer_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = config.protocol_wallet
    )]
    pub protocol_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"seller-profile", escrow_state.seller.as_ref()],
        bump = seller_profile.bump
    )]
    pub seller_profile: Account<'info, SellerProfile>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    #[account(mut)]
    pub protocol_wallet: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub escrow_state: Account<'info, EscrowState>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"vault-authority", escrow_state.key().as_ref()],
        bump = escrow_state.vault_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = escrow_state.buyer
    )]
    pub buyer_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AddRating<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub escrow_state: Account<'info, EscrowState>,
    #[account(
        mut,
        seeds = [b"seller-profile", escrow_state.seller.as_ref()],
        bump = seller_profile.bump
    )]
    pub seller_profile: Account<'info, SellerProfile>,
}

#[derive(Accounts)]
pub struct CloseEscrow<'info> {
    #[account(
        mut,
        close = receiver,
        constraint = receiver.key() == escrow_state.seller || receiver.key() == config.protocol_wallet @ EscrowError::Unauthorized
    )]
    pub escrow_state: Account<'info, EscrowState>,
    #[account(mut)]
    pub receiver: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
}

#[account]
pub struct Config {
    pub protocol_wallet: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

#[account]
pub struct SellerProfile {
    pub seller: Pubkey,
    pub total_transactions: u64,
    pub rating_sum: u64,
    pub rating_count: u64,
    pub disputes_won: u64,
    pub verified: bool,
    pub bump: u8,
}

#[account]
pub struct EscrowState {
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub created_at: i64,
    pub funded_at: i64,
    pub shipped_at: i64,
    pub release_at: i64,
    pub status: EscrowStatus,
    pub vault_bump: u8,
    pub description_hash: [u8; 32],
    pub dispute_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum EscrowStatus {
    Created,
    Funded,
    Shipped,
    Delivered,
    Released,
    Refunded,
    Cancelled,
    Disputed,
    Resolved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum DisputeOutcome {
    ReleaseToSeller,
    ReleaseToBuyer,
}

#[event]
pub struct ConfigUpdated {
    pub protocol_wallet: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct SellerProfileInitialized {
    pub seller: Pubkey,
}

#[event]
pub struct EscrowCreated {
    pub escrow: Pubkey,
    pub seller: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub release_at: i64,
}

#[event]
pub struct EscrowFunded {
    pub escrow: Pubkey,
    pub buyer: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowShipped {
    pub escrow: Pubkey,
    pub auto_release_at: i64,
}

#[event]
pub struct EscrowDeliveryConfirmed {
    pub escrow: Pubkey,
    pub buyer: Pubkey,
}

#[event]
pub struct EscrowReleased {
    pub escrow: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
    pub is_auto_release: bool,
}

#[event]
pub struct EscrowCancelled {
    pub escrow: Pubkey,
}

#[event]
pub struct EscrowRefunded {
    pub escrow: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowDisputed {
    pub escrow: Pubkey,
    pub raised_by: Pubkey,
}

#[event]
pub struct DisputeResolved {
    pub escrow: Pubkey,
    pub outcome: DisputeOutcome,
}

#[event]
pub struct RatingAdded {
    pub seller: Pubkey,
    pub rating: u8,
}

#[error_code]
pub enum EscrowError {
    #[msg("Invalid protocol wallet")]
    InvalidProtocolWallet,
    #[msg("Invalid fee basis points")]
    InvalidFeeBps,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid release time")]
    InvalidReleaseTime,
    #[msg("Invalid status for this operation")]
    InvalidStatus,
    #[msg("Unauthorized caller")]
    Unauthorized,
    #[msg("Release is not ready")]
    ReleaseNotReady,
    #[msg("Shipping deadline has passed")]
    ShippingDeadlinePassed,
    #[msg("Missing buyer address")]
    MissingBuyer,
    #[msg("Invalid rating")]
    InvalidRating,
    #[msg("Token mint mismatch")]
    InvalidMint,
    #[msg("Math overflow")]
    MathOverflow,
}
