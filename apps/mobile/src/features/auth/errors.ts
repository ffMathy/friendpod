/** The user dismissed a provider's sign-in sheet; screens treat this as "nothing happened". */
export class AuthCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'AuthCancelled';
  }
}
