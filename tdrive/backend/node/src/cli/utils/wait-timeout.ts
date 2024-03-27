/** Create a promise that resolves after `ms` milliseconds */
export default (ms: number) => ms > 0 && new Promise(r => setTimeout(r, ms));
