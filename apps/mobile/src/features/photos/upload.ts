import { useCallback, useState } from 'react';
import { putFile, ref } from '@react-native-firebase/storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { storage } from '@/firebase';

/** 1080 px + 256 px JPEG at quality 0.7 (§11 Media); the server strips EXIF and validates (§9 Photos). */
const SIZES = [
  { width: 1080, name: 'pending.jpg' },
  { width: 256, name: 'pending_256.jpg' },
] as const;

export async function pickPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    exif: false,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

/**
 * Uploads to the fixed pending names (`uploads/{uid}/pending*.jpg`, storage rules allow nothing else);
 * `onPhotoUploaded` publishes the next version and deletes the upload.
 */
export async function uploadPhoto(uid: string, sourceUri: string): Promise<void> {
  for (const size of SIZES) {
    const rendered = await ImageManipulator.manipulate(sourceUri).resize({ width: size.width }).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
    await putFile(ref(storage(), `uploads/${uid}/${size.name}`), saved.uri, { contentType: 'image/jpeg' });
  }
}

export type PhotoUploadState = 'idle' | 'uploading' | 'done' | 'failed';

/** Pick → resize → upload, with the state the photo screens show; cancelling the picker changes nothing. */
export function usePhotoUpload(uid: string): { readonly state: PhotoUploadState; choose(): Promise<void> } {
  const [state, setState] = useState<PhotoUploadState>('idle');
  const choose = useCallback(async () => {
    let uri: string | null;
    try {
      uri = await pickPhoto();
    } catch {
      setState('failed');
      return;
    }
    if (!uri) return;
    setState('uploading');
    try {
      await uploadPhoto(uid, uri);
      setState('done');
    } catch {
      setState('failed');
    }
  }, [uid]);
  return { state, choose };
}
