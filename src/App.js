import { useState } from 'react';
import './App.css';
import { Connection, clusterApiUrl, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// mint
import { Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";

function App() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [provider, setProvider] = useState();
  const [loading, setLoading] = useState();

  // mint
  const [isTokenCreated, setIsTokenCreated] = useState(false);
  const [createdTokenPublicKey, setCreatedTokenPublicKey] = useState(null)
  const [mintingWalletSecretKey, setMintingWalletSecretKey] = useState(null)

  const [supplyCapped, setSupplyCapped] = useState(false)

  const getProvider = async () => {
    if ("solana" in window) {
      const provider = window.solana;
      if (provider.isPhantom) {
        return provider;
      }
    } else {
      window.open("https://www.phantom.app/", "_blank");
    }
  };

  async function walletConnectionHelper() {
    if (walletConnected) {
      //Disconnect Wallet
      setProvider();
      setWalletConnected(false);
    } else {
      const userWallet = await getProvider();
      if (userWallet) {
        await userWallet.connect();
        userWallet.on("connect", async () => {
          setProvider(userWallet);
          setWalletConnected(true);
        });
      }
    }
  }

  const airDropHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );
      const fromAirDropSignature = await connection.requestAirdrop(new PublicKey(provider.publicKey), LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });

      console.log(`1 SOL airdropped to your wallet ${provider.publicKey.toString()} successfully`);
      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  }

  // mint
  const initialMintHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );

      const mintRequester = await provider.publicKey;
      const mintingFromWallet = await Keypair.generate();
      setMintingWalletSecretKey(JSON.stringify(mintingFromWallet.secretKey));

      const fromAirDropSignature = await connection.requestAirdrop(mintingFromWallet.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });

      const creatorToken = await Token.createMint(connection, mintingFromWallet, mintingFromWallet.publicKey, null, 6, TOKEN_PROGRAM_ID);
      const fromTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(mintingFromWallet.publicKey);
      await creatorToken.mintTo(fromTokenAccount.address, mintingFromWallet.publicKey, [], 1000000);

      const toTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(mintRequester);
      const transaction = new Transaction().add(
        Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          fromTokenAccount.address,
          toTokenAccount.address,
          mintingFromWallet.publicKey,
          [],
          1000000
        )
      );
      const signature = await sendAndConfirmTransaction(connection, transaction, [mintingFromWallet], { commitment: "confirmed" });

      console.log("SIGNATURE:", signature);

      setCreatedTokenPublicKey(creatorToken.publicKey.toString());
      setIsTokenCreated(true);
      setLoading(false);
    } catch (err) {
      console.log(err)
      setLoading(false);
    }
  }

  // minting more token (100)
  const mintAgainHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );
      const createMintingWallet = await Keypair.fromSecretKey(Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey))));
      const mintRequester = await provider.publicKey;

      const fromAirDropSignature = await connection.requestAirdrop(createMintingWallet.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });

      const creatorToken = new Token(connection, createdTokenPublicKey, TOKEN_PROGRAM_ID, createMintingWallet);
      const fromTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(createMintingWallet.publicKey);
      const toTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(mintRequester);
      await creatorToken.mintTo(fromTokenAccount.address, createMintingWallet.publicKey, [], 100000000);

      const transaction = new Transaction().add(
        Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          fromTokenAccount.address,
          toTokenAccount.address,
          createMintingWallet.publicKey,
          [],
          100000000
        )
      );
      await sendAndConfirmTransaction(connection, transaction, [createMintingWallet], { commitment: "confirmed" });

      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  }

  // tranferring to other account
  const transferTokenHelper = async () => {
    try {
      setLoading(true);

      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );

      const createMintingWallet = Keypair.fromSecretKey(Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey))));
      const receiverWallet = new PublicKey("5eaFQvgJgvW4rDjcAaKwdBb6ZAJ6avWimftFyjnQB3Aj");

      const fromAirDropSignature = await connection.requestAirdrop(createMintingWallet.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });
      console.log('1 SOL airdropped to the wallet for fee');

      const creatorToken = new Token(connection, createdTokenPublicKey, TOKEN_PROGRAM_ID, createMintingWallet);
      const fromTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(provider.publicKey);
      const toTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(receiverWallet);

      const transaction = new Transaction().add(
        Token.createTransferInstruction(TOKEN_PROGRAM_ID, fromTokenAccount.address, toTokenAccount.address, provider.publicKey, [], 10000000)
      );
      transaction.feePayer = provider.publicKey;
      let blockhashObj = await connection.getRecentBlockhash();
      console.log("blockhashObj", blockhashObj);
      transaction.recentBlockhash = await blockhashObj.blockhash;

      if (transaction) {
        console.log("Txn created successfully");
      }

      let signed = await provider.signTransaction(transaction);
      let signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);

      console.log("SIGNATURE: ", signature);
      setLoading(false);
    } catch (err) {
      console.log(err)
      setLoading(false);
    }
  }


  return (
    <div>
      hudab
      {
        walletConnected ? (
          <p><strong>Public Key:</strong> {provider.publicKey.toString()}</p>
        ) : <p></p>
      }
      will get connecteted
      <button onClick={walletConnectionHelper} disabled={loading}>
        {!walletConnected ? "Connect Wallet" : "Disconnect Wallet"}
      </button>

      {
        walletConnected ? (
          <li>Airdrop 1 SOL into your wallet
            <button disabled={loading} onClick={airDropHelper}>AirDrop SOL </button>
          </li>) : <></>
      }

      {
        walletConnected ? (
          <li>Create your own token
            <button disabled={loading} onClick={initialMintHelper}>Initial Mint </button>
          </li>) : <></>
      }

      <li>Mint More 100 tokens: <button disabled={loading || supplyCapped} onClick={mintAgainHelper}>Mint Again</button></li>

      {walletConnected ? (
        <li>Transfer token to other account
          <button disabled={loading} onClick={transferTokenHelper}> transfer 10 token</button>
        </li>) : <></>

      }

    </div>
  )
}

export default App;
