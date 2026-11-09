import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { clearDownloadedExports, downloadExport } from '@/features/account/exportDownload';
import { AuthenticatedPhoto } from '@/features/photos/AuthenticatedPhoto';
import { PhotoCard } from '@/features/photos/PhotoCard';
import { uploadPhoto } from '@/features/photos/upload';
import { storageAuthHeaders, storageObjectUrl } from '@/firebase/storageRest';

jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({ options: { storageBucket: 'demo-grouper.appspot.com' } }) }));
jest.mock('@react-native-firebase/app-check', () => ({ getToken: async () => ({ token: 'appcheck-token' }) }));
let mockSignedIn = true;
jest.mock('@react-native-firebase/auth', () => ({ getIdToken: async () => 'id-token' }));
jest.mock('@/firebase', () => ({
  auth: () => ({ currentUser: mockSignedIn ? { uid: 'me' } : null }),
  appCheck: () => ({}),
  storage: () => ({}),
  EMULATOR_PORTS: { storage: 9199 },
}));

const mockClearImageCaches = jest.fn(async () => undefined);
jest.mock('@/features/account/clearDeviceData', () => ({ clearImageCaches: () => mockClearImageCaches() }));

const mockImageProps: Record<string, unknown>[] = [];
jest.mock('expo-image', () => ({
  Image: Object.assign(
    (props: Record<string, unknown>) => {
      mockImageProps.push(props);
      return null;
    },
    { clearMemoryCache: async () => true, clearDiskCache: async () => true },
  ),
}));

const mockFs = { dirExists: false, deleted: 0, created: 0, download: jest.fn(), preview: jest.fn(async () => undefined) };
jest.mock('expo-file-system', () => {
  class Directory {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map(String).join('/');
    }
    get exists() {
      return mockFs.dirExists;
    }
    delete() {
      mockFs.deleted += 1;
      mockFs.dirExists = false;
    }
    create() {
      mockFs.created += 1;
      mockFs.dirExists = true;
    }
    toString() {
      return this.uri;
    }
  }
  class File {
    readonly uri: string;
    constructor(dir: unknown, name: string) {
      this.uri = `${String(dir)}/${name}`;
    }
    static downloadFileAsync = (...a: unknown[]) => mockFs.download(...a);
    static preview = (...a: unknown[]) => mockFs.preview(...(a as []));
  }
  return { Directory, File, Paths: { cache: 'cache:' } };
});

const mockPut = jest.fn(async () => undefined);
jest.mock('@react-native-firebase/storage', () => ({
  ref: (_s: unknown, path: string) => ({ path }),
  putFile: (...a: unknown[]) => mockPut(...(a as [])),
}));
const mockResize = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (uri: string) => ({
      resize: (size: { width: number }) => {
        mockResize(uri, size);
        return { renderAsync: async () => ({ saveAsync: async (o: unknown) => ({ uri: `file:///out-${size.width}.jpg`, o }) }) };
      },
    }),
  },
}));
let mockPicked: { canceled: boolean; assets?: { uri: string }[] } = { canceled: false, assets: [{ uri: 'file:///picked.jpg' }] };
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: async () => mockPicked }));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockImageProps.length = 0;
  mockSignedIn = true;
  Object.assign(mockFs, { dirExists: false, deleted: 0, created: 0 });
  mockPicked = { canceled: false, assets: [{ uri: 'file:///picked.jpg' }] };
});

describe('authenticated Storage downloads (§9 Photos)', () => {
  it('uses the REST object URL with the ID token and App Check headers, never a download URL', async () => {
    expect(storageObjectUrl('photos/anna/3_256.jpg')).toBe(
      'https://firebasestorage.googleapis.com/v0/b/demo-grouper.appspot.com/o/photos%2Fanna%2F3_256.jpg?alt=media',
    );
    await expect(storageAuthHeaders()).resolves.toEqual({ Authorization: 'Firebase id-token', 'X-Firebase-AppCheck': 'appcheck-token' });
    mockSignedIn = false;
    await expect(storageAuthHeaders()).rejects.toThrow('not signed in');
  });

  it('renders a member photo with the headers and the {owner}:{v} cache key', async () => {
    await render(<AuthenticatedPhoto owner="anna" version={3} size="thumb" accessibilityLabel="Photo of Anna" />);
    await act(async () => {
      await Promise.resolve();
    });
    const props = mockImageProps.at(-1) as { source: { uri: string; headers: Record<string, string>; cacheKey: string }; cachePolicy: string };
    expect(props.source.uri).toContain('/o/photos%2Fanna%2F3_256.jpg?alt=media');
    expect(props.source.headers).toEqual({ Authorization: 'Firebase id-token', 'X-Firebase-AppCheck': 'appcheck-token' });
    expect(props.source.cacheKey).toBe('anna:3:thumb');
    expect(props.cachePolicy).toBe('memory-disk');
  });

  it('downloads the export with the same headers into the cache, replacing an older one, and opens the viewer', async () => {
    mockFs.dirExists = true;
    mockFs.download.mockResolvedValue({ uri: 'cache:/exports/friendpod-data-exp1.json' });
    await downloadExport('me', 'exp1', 'Your Friendpod data');
    expect(mockFs.deleted).toBe(1);
    const [url, target, options] = mockFs.download.mock.calls[0] as [string, { uri: string }, { headers: Record<string, string>; idempotent: boolean }];
    expect(url).toBe('https://firebasestorage.googleapis.com/v0/b/demo-grouper.appspot.com/o/exports%2Fme%2Fexp1.json?alt=media');
    expect(target.uri).toBe('cache:/exports/friendpod-data-exp1.json');
    expect(options).toMatchObject({ headers: { Authorization: 'Firebase id-token', 'X-Firebase-AppCheck': 'appcheck-token' }, idempotent: true });
    expect(mockFs.preview).toHaveBeenCalledWith({ uri: 'cache:/exports/friendpod-data-exp1.json' }, { title: 'Your Friendpod data', mimeType: 'application/json' });

    clearDownloadedExports();
    expect(mockFs.deleted).toBe(2);
  });
});

describe('photo upload (§11 Media)', () => {
  it('uploads a 1080 px and a 256 px JPEG to the fixed pending names', async () => {
    await uploadPhoto('me', 'file:///picked.jpg');
    expect(mockResize).toHaveBeenNthCalledWith(1, 'file:///picked.jpg', { width: 1080 });
    expect(mockResize).toHaveBeenNthCalledWith(2, 'file:///picked.jpg', { width: 256 });
    expect(mockPut).toHaveBeenNthCalledWith(1, { path: 'uploads/me/pending.jpg' }, 'file:///out-1080.jpg', { contentType: 'image/jpeg' });
    expect(mockPut).toHaveBeenNthCalledWith(2, { path: 'uploads/me/pending_256.jpg' }, 'file:///out-256.jpg', { contentType: 'image/jpeg' });
  });

  describe('Me → Photo', () => {
    let client: QueryClient;
    async function renderCard(version: number | null) {
      client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
      await render(
        <QueryClientProvider client={client}>
          <PhotoCard uid="me" version={version} />
        </QueryClientProvider>,
      );
    }
    afterEach(() => client.clear());

    it('picks and uploads a photo; cancelling the picker uploads nothing', async () => {
      await renderCard(null);
      await fireEvent.press(screen.getByTestId('photo-choose'));
      expect(mockPut).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Thanks! Your photo will appear shortly.')).toBeOnTheScreen();
      mockPut.mockClear();
      mockPicked = { canceled: true };
      await fireEvent.press(screen.getByTestId('photo-choose'));
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('says when the upload failed', async () => {
      mockPut.mockRejectedValueOnce(new Error('storage/unauthorized'));
      await renderCard(null);
      await fireEvent.press(screen.getByTestId('photo-choose'));
      expect(screen.getByText("The upload didn't work. Try again.")).toBeOnTheScreen();
    });

    it('shows the current photo and deletes it after a confirmation', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      mockCall.mockResolvedValue({ ok: true });
      await renderCard(4);
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockImageProps.some((p) => (p.source as { cacheKey: string }).cacheKey === 'me:4:thumb')).toBe(true);
      expect(screen.getByRole('button', { name: 'Change photo' })).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId('photo-delete'));
      const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
      await act(async () => {
        buttons.find((b) => b.style === 'destructive')?.onPress?.();
      });
      expect(mockCall).toHaveBeenCalledWith('deletePhoto', {});
      expect(mockClearImageCaches).toHaveBeenCalled();
      alert.mockRestore();
    });
  });
});
