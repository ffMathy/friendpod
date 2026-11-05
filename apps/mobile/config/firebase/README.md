# Firebase app config files

Only placeholders for the `demo-grouper` emulator project live here. They hold no secrets and only work
against the Emulator Suite (`EXPO_PUBLIC_USE_EMULATORS=1`).

Staging and production files come from EAS **file** environment variables, never from git:

| Variable | EAS environment | File |
|---|---|---|
| `GOOGLE_SERVICES_PLIST` | preview (staging), production | `GoogleService-Info.plist` of `grouper-staging` / `grouper-prod` |
| `GOOGLE_SERVICES_JSON` | preview (staging), production | `google-services.json` of `grouper-staging` / `grouper-prod` |

```
eas env:create --environment production --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret
```

The root `.gitignore` ignores any file named exactly `GoogleService-Info.plist` or `google-services.json`;
the placeholders carry a `demo-grouper.` prefix so they can be committed.
