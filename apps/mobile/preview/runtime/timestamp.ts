/** A Firestore Timestamp stand-in with the methods the app and its schemas use (core `timestampSchema`: `toMillis()`). */
export class Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static fromMillis(ms: number): Timestamp {
    const seconds = Math.floor(ms / 1000);
    return new Timestamp(seconds, Math.round((ms - seconds * 1000) * 1e6));
  }

  static fromDate(date: Date): Timestamp {
    return Timestamp.fromMillis(date.getTime());
  }

  static now(): Timestamp {
    return Timestamp.fromMillis(Date.now());
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }

  toDate(): Date {
    return new Date(this.toMillis());
  }

  isEqual(other: Timestamp): boolean {
    return other.seconds === this.seconds && other.nanoseconds === this.nanoseconds;
  }

  valueOf(): string {
    return String(this.toMillis()).padStart(16, '0');
  }

  toString(): string {
    return `Timestamp(seconds=${this.seconds}, nanoseconds=${this.nanoseconds})`;
  }
}
