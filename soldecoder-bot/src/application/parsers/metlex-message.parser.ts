import { z } from 'zod';
import {
  MetlexPnLMessageSchema,
  type MetlexLink,
  type MetlexPnLMessage
} from '@schemas/metlex.schema';

/**
 * Extracts Metlex PnL links from text content
 */
function extractMetlexLinks(content: string): MetlexLink[] {
  const regex = /https?:\/\/metlex\.io\/pnl2\/([A-Za-z0-9-]+)/g;
  const links: MetlexLink[] = [];
  let match: RegExpExecArray | null;

  match = regex.exec(content);
  while (match !== null) {
    links.push({ url: match[0], hash: match[1] });
    match = regex.exec(content);
  }

  return links;
}

/**
 * Extracts wallet prefix from "(xxx…yyy)" format
 */
function extractWalletPrefix(content: string): string | null {
  const walletMatch = content.match(/\(([A-Za-z0-9]+)\.\.\.[A-Za-z0-9]+\)/);
  return walletMatch ? walletMatch[1] : null;
}

/**
 * Main parser function for Metlex PnL messages
 * Parses text content and extracts wallet prefix and position hashes
 */
export function parseMetlexPnLMessage(content: string): z.SafeParseReturnType<MetlexPnLMessage, MetlexPnLMessage> {
  const links = extractMetlexLinks(content);
  if (links.length === 0) {
    return {
      success: false,
      error: z.ZodError.create([
        {
          code: z.ZodIssueCode.custom,
          message: 'No Metlex PnL links found in text',
          path: [],
        }
      ])
    };
  }

  const walletPrefix = extractWalletPrefix(content);
  if (!walletPrefix) {
    return {
      success: false,
      error: z.ZodError.create([
        {
          code: z.ZodIssueCode.custom,
          message: 'No wallet prefix found in "(xxx…yyy)" format',
          path: [],
        }
      ])
    };
  }

  const parsedData = {
    walletPrefix,
    positionHashes: links.map((l) => l.hash),
    links,
  };

  return MetlexPnLMessageSchema.safeParse(parsedData);
}

/**
 * Convenience function that returns the parsed data or null
 */
export function parseMetlexMessage(content: string): MetlexPnLMessage | null {
  const result = parseMetlexPnLMessage(content);
  return result.success ? result.data : null;
}