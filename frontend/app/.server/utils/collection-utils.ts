/**
 * Moves elements matching a given predicate to the top of an array while preserving their original order.
 *
 * @template T The type of elements in the array.
 * @param array The input array.
 * @param predicate A function that determines if an element should be moved to the top.
 * @returns A new array with the matching elements at the top, preserving their original order.
 */
export function moveToTop<T>(array: ReadonlyArray<T>, predicate: (item: T) => boolean): ReadonlyArray<T> {
  const newArray = [...array]; // Create a copy of the original array

  // Find all indices of elements that match the predicate
  const matchingIndices: number[] = [];
  for (const [i, element] of newArray.entries()) {
    if (predicate(element)) {
      matchingIndices.push(i);
    }
  }

  // Extract matching elements and remove them from their original positions
  const extractedElements: T[] = [];
  for (let i = matchingIndices.length - 1; i >= 0; i--) {
    const index = matchingIndices[i];
    if (index === undefined) continue;

    const [item] = newArray.splice(index, 1);
    if (item) extractedElements.unshift(item);
  }

  // Unshift extracted elements to the beginning of the array
  newArray.unshift(...extractedElements);

  return newArray;
}
