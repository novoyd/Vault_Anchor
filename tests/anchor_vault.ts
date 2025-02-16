import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorVault } from "../target/types/anchor_vault";
import { assert} from "chai";
import { SystemProgram } from "@solana/web3.js";

describe("AnchorVault tests", () => {
  // Configuring client to use cluster of localnet as set on terminal
  anchor.setProvider(anchor.AnchorProvider.env());
})

//Extracting program object that is generated from the anchor workspace
  const program = anchor.workspace.AnchorVault as Program<AnchorVault>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  // Storing users pubkey and PDAs for state and vault over here respectively 
  let userPublicKey = provider.wallet.publicKey;
  let statePDA: anchor.web3.PublicKey;
  let stateBump: number;
  let vaultPDA: anchor.web3.PublicKey;
  let vaultBump: number;

  
//deriving PDAs (state and vault) in a before() or beforeEach hook so i can reuse them across tests.
before(() => {
  // findProgamAddress depreceated, so using findProgramAddressSync over here 
  [statePDA, stateBump]  = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("state"), userPublicKey.toBuffer()],
    program.programId
  );

  [vaultPDA, vaultBump] =  anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), statePDA.toBuffer()],
      program.programId
  );

  console.log("User Pubkey:", userPublicKey.toBase58());
  console.log("State PDA:", statePDA.toBase58(), "Bump:", stateBump);
  console.log("VaultPDA:", vaultPDA.toBase58(), "Bump:", vaultBump);
  
});

// Testing the initialize instruction over here
it("Initializes vault state!", async() => {
  //Calls 'initialize' instruction. It needs 4 accts
  // user(who is signer and payer here), state, vault and systemprogram
  const TransactionSignature = await program.methods.initialize()
  .accountsStrict({
    user: userPublicKey,
    state: statePDA,
    vault: vaultPDA,
    systemProgram: anchor.web3.SystemProgram.programId
  })
  .rpc()

  console.log("Initiliaze Tx Signature:", TransactionSignature);

  //After transaction, fetch state acct to confirm 
  //it was created and zero-initialized

  const stateAccount = await program.account.vaultState.fetch(statePDA);
  console.log("State account after init:", stateAccount);
  
  //amount is set to 0 initially lets check
  assert.equal(stateAccount.amount.toNumber(), 
  0,
  "initial amount should be 0"
);
//Check on-chain stored bumps match what was derived locally
assert.equal(stateAccount.stateBump, stateBump, "State bump mismatch");
assert.equal(stateAccount.vaultBump, vaultBump, "Vault bump mismatch");
});

it("deposit lamports into vault!", async() => {
  //Depositing .1 sol into it for demo

  const depositAmount = new anchor.BN(100_000_000);
  const userBalanceBefore  = await provider.connection.getBalance(userPublicKey);
  console.log("user bal before deposit:", userBalanceBefore);
  const vaultBalanceBefore = await provider.connection.getBalance(vaultPDA);
  console.log("Vault balance before deposit:", vaultBalanceBefore);

  //calling deposit instruction
  const TransactionSignature = await program.methods.deposit(depositAmount)
  .accountsStrict({
    user: userPublicKey,
    state: statePDA,
    vault: vaultPDA,
    systemProgram: anchor.web3.SystemProgram.programId,
  }).rpc();

  console.log("Deposit Transaction Signature", TransactionSignature);

  //check balance after depositing
  const vaultBalanceAfter = await provider.connection.getBalance(vaultPDA);
  console.log("Vault balanace after depositing", vaultBalanceAfter);

    // we expect to have more lamports now

  assert.ok(
    vaultBalanceAfter > vaultBalanceBefore,
  )
  //fetch state acct to ensure 'amount' field got updated
  const stateAccount = await program.account.vaultState.fetch(statePDA);
  console.log("State acct after deposit:", stateAccount);

  assert.ok(
    stateAccount.amount.eq(depositAmount),
    "State account 'amount' not updated with deposit amount"
  );
})


it("withdraw lamports from vault!", async() => {
  //Withdrawing .05 sol into it for demo

  const withdrawAmount = new anchor.BN(50_000_000);
  const userBalanceBefore  = await provider.connection.getBalance(userPublicKey);
  console.log("user bal before withdraw:", userBalanceBefore);
  const vaultBalanceBefore = await provider.connection.getBalance(vaultPDA);
  console.log("Vault balance before withdraw:", vaultBalanceBefore);

  //calling deposit instruction
  const TransactionSignature = await program.methods.withdraw(withdrawAmount)
  .accountsStrict({
    user: userPublicKey,
    state: statePDA,
    vault: vaultPDA,
    systemProgram: anchor.web3.SystemProgram.programId,
  }).rpc();

  console.log("Withdraw Transaction Signature", TransactionSignature);

  //check balance after withdrawing
  const userBalanceAfter = await provider.connection.getBalance(userPublicKey);
  const vaultBalanceAfter = await provider.connection.getBalance(vaultPDA);
  console.log("User balance after withdraw:", userBalanceAfter);
  console.log("Vault balanace after withdrawing", vaultBalanceAfter);

    // we expect to have less lamports now

  assert.ok(
    vaultBalanceAfter < vaultBalanceBefore,
    "Vault balance did not decrease after withdraw"
  )

  assert.ok(
    userBalanceBefore > userBalanceAfter,
    "user balance did not increase after withdraw"
  )

  //fetch state acct to ensure 'amount' field got updated
  const stateAccount = await program.account.vaultState.fetch(statePDA);
  console.log("State acct after withdrawing:", stateAccount);

  assert.ok(
    stateAccount.amount.eq(new anchor.BN(50_000_000)),
    "State account 'amount' not updated after withdraw amount"
  );
})



