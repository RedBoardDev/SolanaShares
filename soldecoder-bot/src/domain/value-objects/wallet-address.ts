import { PublicKey } from '@solana/web3.js';

export class WalletAddress {
  private constructor(private readonly _value: string) {}

  static create(address: string): WalletAddress {
    if (!address || address.length < 32 || address.length > 44) {
      throw new Error('Invalid wallet address length');
    }

    try {
      new PublicKey(address);
    } catch {
      throw new Error('Invalid wallet address format');
    }

    return new WalletAddress(address);
  }

  static isValid(address: string): boolean {
    if (!address || address.length < 32 || address.length > 44) {
      return false;
    }

    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  get value(): string {
    return this._value;
  }

  toPublicKey(): PublicKey {
    return new PublicKey(this._value);
  }

  getShortAddress(): string {
    return `${this._value.slice(0, 3)}...${this._value.slice(-3)}`;
  }

  equals(other: WalletAddress): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
