/** BVG-Altersgruppe ist relevant, solange die Person noch in oder vor dieser Gruppe ist. */
export function isBvgContributionBucketRelevant(
  bucket: { minAge: number; maxAge: number },
  currentAge: number,
): boolean {
  return bucket.maxAge >= currentAge;
}
