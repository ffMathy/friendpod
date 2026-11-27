/** The three fields back from a `YYYY-MM-DD` held in the draft (going back to step 1), or empty fields. */
export function splitDob(dob: string | null): { readonly day: string; readonly month: string; readonly year: string } {
  const m = dob ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob) : null;
  return m ? { year: m[1]!, month: m[2]!, day: m[3]! } : { day: '', month: '', year: '' };
}
