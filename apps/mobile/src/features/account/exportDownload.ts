import { Directory, File, Paths } from 'expo-file-system';
import { storageAuthHeaders, storageObjectUrl } from '@/firebase/storageRest';

/** Downloaded exports live in the app's cache only, in their own folder so they can be removed in one go. */
const EXPORT_DIR = 'exports';

function exportDir(): Directory {
  return new Directory(Paths.cache, EXPORT_DIR);
}

/** Removes every downloaded export from the device (sign-out, deletion, and before each new download). */
export function clearDownloadedExports(): void {
  const dir = exportDir();
  if (dir.exists) dir.delete();
}

/**
 * "Download my data" (§3.9): fetches `exports/{uid}/{exportId}.json` with the ID token and App Check headers (the
 * storage rules let only the owner read it, and there is no public URL), stores it in the app cache and hands it to
 * the system viewer, from which the user can save or share it. Only the latest download is kept on the device.
 */
export async function downloadExport(uid: string, exportId: string, title: string): Promise<void> {
  clearDownloadedExports();
  const dir = exportDir();
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `grouper-data-${exportId}.json`);
  const headers = await storageAuthHeaders();
  const file = await File.downloadFileAsync(storageObjectUrl(`exports/${uid}/${exportId}.json`), target, { headers, idempotent: true });
  await File.preview(file, { title, mimeType: 'application/json' });
}
