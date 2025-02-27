/** Shuffle an array in place, returns its parameter for convenience */
export function fisherYattesShuffleInPlace<T>(list: T[]): T[] {
  let index = list.length;
  while (index) {
    const randomIndex = Math.floor(Math.random() * index);
    index--;
    [list[index], list[randomIndex]] = [list[randomIndex], list[index]];
  }
  return list;
}
