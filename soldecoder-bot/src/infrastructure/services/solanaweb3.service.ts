import {
  Connection,
  PublicKey,
  type ParsedTransactionWithMeta,
  type ParsedInstruction,
  type PartiallyDecodedInstruction,
} from '@solana/web3.js';
import { config } from '@infrastructure/config/env';


const RELEVANT_INSTRUCTIONS = ['OpenPosition', 'RemoveLiquidityByRange2', 'ClosePositionIfEmpty'];

type SolanaInstruction = ParsedInstruction | PartiallyDecodedInstruction;

export class SolanaWeb3Service {
  private static instance: SolanaWeb3Service;
  private connection: Connection;
  private programPublicKey: PublicKey;

  private constructor(connection?: Connection, programId?: string) {
    this.connection = connection ?? new Connection(config.solana.rpcEndpoint, 'finalized');
    this.programPublicKey = programId ? new PublicKey(programId) : new PublicKey(config.solana.programId);
  }

  public static getInstance(): SolanaWeb3Service {
    if (!SolanaWeb3Service.instance) {
      SolanaWeb3Service.instance = new SolanaWeb3Service();
    }
    return SolanaWeb3Service.instance;
  }

  public async getMainPosition(txSignature: string): Promise<string> {
    const tx = await this.fetchParsedTransaction(txSignature);

    if (tx.meta?.err) {
      throw new Error(`Transaction ${txSignature} failed: ${JSON.stringify(tx.meta.err)}`);
    }

    const allInstrs = this.collectAllInstructions(tx);
    const meteoraInstrs = this.filterByProgram(allInstrs);
    const typed = this.typeInstructions(meteoraInstrs, tx.meta?.logMessages ?? []);
    const chosen = this.selectInstruction(typed);

    return this.extractFirstAccount(chosen.instr);
  }

  private async fetchParsedTransaction(signature: string): Promise<ParsedTransactionWithMeta> {
    let tx: ParsedTransactionWithMeta | null = null;
    let lastError: Error | null = null;

    try {
      tx = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'finalized',
      });
    } catch (e) {
      lastError = e as Error;
    }

    if (!tx) {
      if (lastError) {
        throw new Error(`RPC error while fetching transaction ${signature}: ${lastError.message}`);
      }
      throw new Error(`Transaction ${signature} not found or not yet finalized`);
    }

    return tx;
  }

  private collectAllInstructions(tx: ParsedTransactionWithMeta): SolanaInstruction[] {
    const { message } = tx.transaction;
    const top = message.instructions as SolanaInstruction[];
    const inner = tx.meta?.innerInstructions?.flatMap((b) => b.instructions as SolanaInstruction[]) ?? [];
    return [...top, ...inner];
  }

  private filterByProgram(instrs: SolanaInstruction[]): SolanaInstruction[] {
    const ppk = this.programPublicKey;
    const filtered = instrs.filter((ix) => {
      const pid = ix.programId instanceof PublicKey ? ix.programId : new PublicKey(ix.programId);
      return pid.equals(ppk);
    });

    if (filtered.length === 0) {
      throw new Error(`No instructions found for the program ${ppk.toBase58()}`);
    }
    return filtered;
  }

  private typeInstructions(
    instrs: SolanaInstruction[],
    logs: readonly string[],
  ): { instr: SolanaInstruction; type: string }[] {
    const result: { instr: SolanaInstruction; type: string }[] = [];
    const pidStr = this.programPublicKey.toBase58();
    const invokeSig = `Program ${pidStr} invoke`;
    const successSig = `Program ${pidStr} success`;
    let logPos = 0;

    for (const instr of instrs) {
      let type = 'Unknown';
      const invokeIdx = logs.findIndex((l, i) => i >= logPos && l.includes(invokeSig));
      if (invokeIdx >= 0) {
        const entry = logs.slice(invokeIdx + 1).find((l) => l.startsWith('Program log: Instruction:'));
        if (entry) {
          type = entry.replace('Program log: Instruction: ', '');
        }
        const successIdx = logs.findIndex((l, i) => i > invokeIdx && l.includes(successSig));
        logPos = successIdx >= 0 ? successIdx + 1 : invokeIdx + 1;
      }
      result.push({ instr, type });
    }

    return result;
  }

  private selectInstruction(typed: { instr: SolanaInstruction; type: string }[]) {
    for (const rel of RELEVANT_INSTRUCTIONS) {
      const found = typed.find((t) => t.type === rel);
      if (found) return found;
    }
    return typed[0];
  }

  private extractFirstAccount(instr: SolanaInstruction): string {
    if ('accounts' in instr && Array.isArray(instr.accounts) && instr.accounts.length) {
      const acct = instr.accounts[0];
      const pk = typeof acct === 'string' ? new PublicKey(acct) : acct;
      return pk.toBase58();
    }
    if ('keys' in instr && Array.isArray(instr.keys) && instr.keys.length) {
      return instr.keys[0].pubkey.toBase58();
    }
    throw new Error('Unable to extract account from the instruction');
  }
}
