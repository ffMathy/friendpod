/** Preview fake of @react-native-firebase/app (web only, see preview/metro.cjs). */
export interface FirebaseApp {
  readonly name: string;
  readonly options: Readonly<Record<string, string>>;
}

const APP: FirebaseApp = {
  name: '[DEFAULT]',
  options: {
    apiKey: 'preview',
    appId: '1:000000000000:web:preview',
    projectId: 'demo-grouper',
    storageBucket: 'demo-grouper.appspot.com',
    messagingSenderId: '000000000000',
  },
};

export const getApp = (_name?: string): FirebaseApp => APP;
export const getApps = (): FirebaseApp[] => [APP];
export const initializeApp = async (): Promise<FirebaseApp> => APP;
export const setLogLevel = (): void => undefined;

const firebase = { app: getApp, apps: [APP], initializeApp, setLogLevel };
export default firebase;
