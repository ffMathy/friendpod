declare const brand: unique symbol;

/** Nominal typing for values that carry an invariant the plain type cannot express. */
export type Brand<T, B extends string> = T & { readonly [brand]: B };
