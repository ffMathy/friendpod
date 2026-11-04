import type { ConfigPlugin } from 'expo/config-plugins';

declare const withFirestoreBackupExclusion: ConfigPlugin & { addBackupExclusion(appDelegateSwift: string): string };
export = withFirestoreBackupExclusion;
