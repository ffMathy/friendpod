# Pod colours

Which of the six pod colours a pod or an interest gets. The colour is computed
from the word shown, so nothing is stored and every phone agrees. Today it is
`apps/mobile/src/lib/podColor.ts` (the hash) and
`apps/mobile/src/features/pods/color.ts` (a pod's own colour from its card).

```ail
node PodColors : fn   level: system
  why   A pod and an interest wear the same colour on every screen and every phone, read from the
        word shown, so the colour never needs storing and a private pod never gets one.   <- PodPage
  what
    type PodColor = "solsikke" | "blad" | "baer" | "tomat" | "fjord" | "blomme"
    type PodColorIndex = 0 | 1 | 2 | 3 | 4 | 5   ; the index into POD_COLORS, so the order never changes
    POD_COLORS: list of PodColor = ["solsikke", "blad", "baer", "tomat", "fjord", "blomme"]

    fnv1a32(key: text) -> integer
      FNV-1a, 32 bit, over the UTF-8 bytes of key (a character outside the basic plane is four bytes): start at
      2166136261; for each byte, exclusive-or it in, then multiply by 16777619 modulo 2^32. Never negative.
    bucketOf(hash: integer) -> PodColorIndex — the floor of hash × 6 / 2^32 (never hash modulo 6)
    colorKeyOfWord(word: text) -> text
      normalizeTag(word).norm (InterestRules) when it is ok; otherwise the word in NFKC, trimmed and in lower case.
    wordColorIndex(word: text) -> PodColorIndex — bucketOf(fnv1a32("grouper:3410:" + colorKeyOfWord(word)))
    podColorIndex(podId: text) -> PodColorIndex — bucketOf(fnv1a32("grouper:" + podId))
    podColorFor(input: { word?: text?, podId?: text?, sensitive?: boolean }) -> PodColor?
      nothing when sensitive is true; else POD_COLORS[wordColorIndex(word)] when word is something whose
      colorKeyOfWord is not empty; else POD_COLORS[podColorIndex(podId)] when podId is something and not empty;
      else nothing. A word wins over a pod id.
    interestColor(interest: { norm?: text?, display: text }) -> PodColor? — podColorFor({ word: norm when it is something, else display })
    colorOnPodScreen(interest: PodColor?, pod: PodColor?, isPodTheme: boolean = false) -> PodColor | "clash" | nothing
      nothing when interest is nothing; "clash" when the interest is not the pod's theme, pod is something and
      interest is pod; else interest.
    isOpenToAnyone(card: { themeLabel: text?, reasons: list of { code: text } }) -> boolean
      true when themeLabel is nothing or a reason has the code "OPEN_TO_ANYONE"
    podColorOf(podId: text, card: { themeLabel: text?, themeSensitive: boolean, reasons: list of { code: text } }?) -> PodColor?
      The colour of a pod on its own screens: nothing when card is nothing or themeSensitive is true; from the pod
      id when isOpenToAnyone(card); else from themeLabel.

    examples
      fnv1a32("") => 2166136261
      fnv1a32("grouper:3410:brætspil") => 2300715150
      bucketOf(0) => 0
      bucketOf(715827883) => 1
      bucketOf(4294967295) => 5
      colorKeyOfWord("  Brætspil! ") => "brætspil"
      colorKeyOfWord("SOURDOUGH 🍞") => "sourdough"
      podColorFor({ word: "brætspil" }) => "tomat"
      podColorFor({ word: "sourdough" }) => "solsikke"
      podColorFor({ word: "Far  på   barsel" }) => "fjord"
      podColorFor({ word: "trail running" }) => "blad"
      podColorFor({ word: "coffee" }) => "baer"
      podColorFor({ word: "board games" }) => "baer"
      podColorFor({ word: "surdej" }) => "fjord"
      podColorFor({ word: "sourdough", sensitive: true }) => nothing
      podColorFor({ podId: "openpodaarhusweek46a" }) => "blomme"
      podColorFor({ word: "brætspil", podId: "seed_coffee" }) => "tomat"
      podColorFor({ word: "   ", podId: "openpodaarhusweek46a" }) => "blomme"
      podColorFor({ podId: "" }) => nothing
      podColorFor({}) => nothing
      interestColor({ norm: "brætspil", display: "Brætspil 🎲" }) => "tomat"
      interestColor({ display: "Coffee" }) => "baer"
      colorOnPodScreen("tomat", "tomat") => "clash"
      colorOnPodScreen("tomat", "tomat", true) => "tomat"
      colorOnPodScreen("baer", "tomat") => "baer"
      colorOnPodScreen(nothing, "tomat") => nothing
      isOpenToAnyone({ themeLabel: "brætspil", reasons: [{ code: "THEME" }] }) => false
      podColorOf("braetspilpodaarhus46", { themeLabel: "brætspil", themeSensitive: false, reasons: [] }) => "tomat"
      podColorOf("braetspilpodaarhus46", { themeLabel: "board games", themeSensitive: false, reasons: [] }) => "baer"
      podColorOf("openpodaarhusweek46a", { themeLabel: nothing, themeSensitive: false, reasons: [] }) => "blomme"
      podColorOf("openpodaarhusweek46a", { themeLabel: "brætspil", themeSensitive: false, reasons: [{ code: "OPEN_TO_ANYONE" }] }) => "blomme"
      podColorOf("privatepodaarhusweek", { themeLabel: "gravid", themeSensitive: true, reasons: [] }) => nothing

  how
    decide the colour comes from the word shown, normalized, not from the concept behind it
      because the founder decided it in pull request 6 ("Colour interests and pods from the word shown"), so the same word has the same colour everywhere
      rejected the concept id (pull request 5), because the pod's shared interests are stored as words without concept ids
    decide members who see the theme in different words or languages may see different colours (brætspil Tomat, board games Bær)
      because pull request 6 accepts it as the trade-off of word colours
    decide the salt "grouper:3410:" for words and "grouper:" for pod ids, kept after the rename to Friendpod
      because it reproduces the storyboards' colours (brætspil Tomat, sourdough Solsikke, far på barsel Fjord, trail running Blad, coffee Bær, hiking Blomme); podColor.ts: "never change it"
    decide private (sensitive) themes and interests get no colour at all
      because a pod about a private interest stays quiet (decision 1 in "apps/mobile/src/features/pods/color.ts")
    decide on a pod's own screens another interest in the pod's colour is drawn plain
      because the pod's colour is reserved there (decision 9, podColor.ts "the clash rule")
  uses InterestRules
  free [ helper names ]
  sources
    Code: "apps/mobile/src/lib/podColor.ts", "apps/mobile/src/features/pods/color.ts", "apps/mobile/test/podColor.test.ts", "packages/core/src/interests/normalize.ts" (normalizeTag)
    Examples: run against the existing code with tsx on 27 November 2026
    Pull requests: "https://github.com/ffMathy/friendpod/pull/5" (six pod colours), "https://github.com/ffMathy/friendpod/pull/6" (colour from the word shown)
```
