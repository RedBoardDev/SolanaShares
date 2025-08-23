/**
 * Optimized natural sort algorithm.
 * Intelligently handles alphanumeric strings like "Wallet 1" < "Wallet 2" < "Wallet 10".
 */

interface ParsedSegment {
  isNumber: boolean;
  value: string | number;
}

/**
 * Parses a string into segments of text and numbers.
 */
function parseString(str: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const regex = /(\d+|\D+)/g;
  let match: RegExpExecArray | null;

  while (true) {
    match = regex.exec(str);
    if (match === null) break;
    const segment = match[0];
    const isNumber = /^\d+$/.test(segment);

    segments.push({
      isNumber,
      value: isNumber ? Number.parseInt(segment, 10) : segment.toLowerCase(),
    });
  }

  return segments;
}

/**
 * Compares two parsed segments.
 */
function compareSegments(a: ParsedSegment, b: ParsedSegment): number {
  // If both are numbers
  if (a.isNumber && b.isNumber) {
    return (a.value as number) - (b.value as number);
  }

  // If both are text
  if (!a.isNumber && !b.isNumber) {
    const strA = a.value as string;
    const strB = b.value as string;
    return strA.localeCompare(strB);
  }

  // Number vs text: numbers come before text
  return a.isNumber ? -1 : 1;
}

/**
 * Compares two strings using natural sort order.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Negative if a < b, positive if a > b, 0 if equal
 *
 * @example
 * ```
 * naturalCompare("Wallet 1", "Wallet 2")   // -1
 * naturalCompare("Wallet 2", "Wallet 10")  // -1
 * naturalCompare("Wallet 10", "Wallet 2")  // 1
 * naturalCompare("ABC", "abc")             // 0 (case insensitive)
 * naturalCompare("Item1", "Item10")        // -1
 * ```
 */
export function naturalCompare(a: string, b: string): number {
  // Optimization: if strings are identical
  if (a === b) return 0;

  // Parse both strings
  const segmentsA = parseString(a);
  const segmentsB = parseString(b);

  // Compare segment by segment
  const minLength = Math.min(segmentsA.length, segmentsB.length);

  for (let i = 0; i < minLength; i++) {
    const comparison = compareSegments(segmentsA[i], segmentsB[i]);
    if (comparison !== 0) {
      return comparison;
    }
  }

  // If all compared segments are equal, the shorter string comes first
  return segmentsA.length - segmentsB.length;
}

/**
 * Sorts an array of strings using the natural sort algorithm.
 *
 * @param array - Array to sort
 * @returns New sorted array
 *
 * @example
 * ```
 * naturalSort(["Wallet 10", "Wallet 1", "Wallet 2"])
 * // Returns: ["Wallet 1", "Wallet 2", "Wallet 10"]
 *
 * naturalSort(["Item1", "item10", "Item2", "item20"])
 * // Returns: ["Item1", "Item2", "item10", "item20"]
 * ```
 */
export function naturalSort(array: string[]): string[] {
  return [...array].sort(naturalCompare);
}

/**
 * Sorts an array of objects by a string property using the natural sort algorithm.
 *
 * @param array - Array of objects to sort
 * @param keyFn - Function that extracts the sort key from each object
 * @returns New sorted array
 *
 * @example
 * ```
 * const wallets = [
 *   { name: "Wallet 10", balance: 100 },
 *   { name: "Wallet 1", balance: 50 },
 *   { name: "Wallet 2", balance: 75 }
 * ];
 *
 * naturalSortBy(wallets, w => w.name)
 * // Returns wallets sorted by name: Wallet 1, Wallet 2, Wallet 10
 * ```
 */
export function naturalSortBy<T>(array: T[], keyFn: (item: T) => string): T[] {
  return [...array].sort((a, b) => naturalCompare(keyFn(a), keyFn(b)));
}

/**
 * Sorts a Map by its keys using the natural sort algorithm.
 *
 * @param map - Map to sort
 * @returns New Map with sorted keys
 *
 * @example
 * ```
 * const positions = new Map([
 *   ["Wallet 10", [...]],
 *   ["Wallet 1", [...]],
 *   ["Wallet 2", [...]]
 * ]);
 *
 * const sorted = naturalSortMap(positions);
 * // Keys in order: "Wallet 1", "Wallet 2", "Wallet 10"
 * ```
 */
export function naturalSortMap<T>(map: Map<string, T>): Map<string, T> {
  const sortedEntries = [...map.entries()].sort(([a], [b]) => naturalCompare(a, b));
  return new Map(sortedEntries);
}
