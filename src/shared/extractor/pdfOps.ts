// pdfjs-dist 5.5.x operator ids for image painting; keeping them local avoids pulling browser-only
// pdfjs modules into Node-based tests that only need the detection heuristic.
const PDF_IMAGE_OPS = new Set([83, 84, 85, 86, 87, 89, 90]);

export function hasPdfImageOps(fnArray: number[]) {
  return fnArray.some((operation) => PDF_IMAGE_OPS.has(operation));
}
