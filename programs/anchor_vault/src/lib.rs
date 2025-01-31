use anchor_lang::{prelude::*, system_program::{transfer, Transfer}};
mod state;
declare_id!("ChQB3vYCZaFiBvVBjkkXMZXWkYeGid9Yi7WLBKH7sBfe");
// reimplement this for SPL tokens 
#[program]
pub mod anchor_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps)
    }

    pub fn deposit(ctx: Context<Deposit>) -> Result<()> {
        ctx.accounts.deposit(amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        ctx.accounts.withdraw(amount)
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {    
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 8+ VaultState::INIT_SPACE, // 8e is for the discrimnator(8 bytes which is 2^64 possibiliters)
        seeds = [b"state", user.key().as_ref()],
        bump, 
    )]
    //store bumps and later try to use it cause onchain computation is exp
    pub state: Account<'info, VaultState>, 
    #[account (
        seeds = [b"vault", state.key().as_ref()],
        bump
    )]
    // for system acct since its owned by system acct just need to pass enough sol for the acct to be rent exempt over here

    pub vault: SystemAccount<'info>, 
    pub system_program: Program<'info, System>
}
// directly fetching lamports field with lamports, acct owned by our program 
impl<'info> Initialize <'info> {
    pub fn initialize(&mut self, bumps: &InitializeBumps) -> Result<()> {
        self.state.vault_bump = bumps.vault;
        self.state.state_bump = bumps.state; 
        self.state.amount = 0;
        Ok(())
    }
}
#[derive(Accounts)]

pub struct Payment <'info> {

    #[account(mut)]
    pub user: Signer<'info>,

    // we dont need mut because we are just reading val over here not updating the val here
    #[account(
        mut,
        seeds = [b"state", user.key().as_ref()],
        bump = state.state_bump 
    )]
    pub state: Account<'info, VaultState>,

    #[account( 
        mut, 
        seeds = [b"vault", state.key().as_ref()],
        bump = state.vault_bump 
    )]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>
}
impl <'info> Payment <'info> {
    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer{ 
            from:self.user.to_account_info(),
            to: self.vault.to_account_info()
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx,  amount)?;
        self.state.amount += amount;

        Ok(())
        
    }
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer{ 
            from:self.vault.to_account_info(),
            to: self.user.to_account_info()
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx,  amount)?;
        self.state.amount += amount;

        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    // Bumps to take it out of curves, store bumps in acct and later use it
    // Why do we have 2 diff bumps are there diff PDAs
    pub vault_bump: u8,
    pub state_bump: u8,
    pub amount: u64, 
}
