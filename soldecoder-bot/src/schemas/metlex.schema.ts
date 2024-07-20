import { z } from 'zod';

/**
 * Schema for individual Metlex PnL link
 */
export const MetlexLinkSchema = z.object({
  url: z.string().url('Invalid Metlex URL format'),
  hash: z.string().min(1, 'Hash is required'),
});

/**
 * Schema for parsed Metlex PnL message data
 */
export const MetlexPnLMessageSchema = z.object({
  walletPrefix: z.string().min(1, 'Wallet prefix is required'),
  positionHashes: z.array(z.string().min(1, 'Position hash is required')).min(1, 'At least one position hash is required'),
  links: z.array(MetlexLinkSchema).min(1, 'At least one Metlex link is required'),
});

export type MetlexLink = z.infer<typeof MetlexLinkSchema>;
export type MetlexPnLMessage = z.infer<typeof MetlexPnLMessageSchema>;

export const MessageDataSchema = MetlexPnLMessageSchema;
export type MessageData = MetlexPnLMessage;
