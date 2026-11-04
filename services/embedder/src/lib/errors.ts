import type { AppErrorCode } from '@grouper/core';
import type { SafeIssue } from '@grouper/core/node';

/** An expected failure with an app code from core's APP_ERRORS. Its message is the code, never request data. */
export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode) {
    super(code);
    this.code = code;
    this.name = 'AppError';
  }
}

/** Input failed its zod schema. Carries only issue paths and codes (never `message` or `received`). */
export class ValidationError extends Error {
  readonly issues: readonly SafeIssue[];

  constructor(issues: readonly SafeIssue[]) {
    super('VALIDATION');
    this.issues = issues;
    this.name = 'ValidationError';
  }
}

/** Feature logic the design schedules for later; fails loudly instead of silently doing nothing. */
export class NotImplementedError extends Error {
  /** DESIGN.md section, e.g. '§10.2'. */
  readonly section: string;

  constructor(what: string, section: string) {
    super(`${what}: not implemented (see DESIGN.md ${section})`);
    this.name = 'NotImplementedError';
    this.section = section;
  }
}
