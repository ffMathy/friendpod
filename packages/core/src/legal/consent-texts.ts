/**
 * Versioned legal copy, verbatim from PRIVACY.md §3.2, §3.3, §3.5 and §3.6 (drafts awaiting [LAWYER]).
 * Its SHA-256 (hashes.ts) identifies the text. Once shipped, any wording change needs a new version id: a test
 * compares this file with PRIVACY.md and locks the hashes.
 */
import type { ConsentScope, Locale } from '../types/domain';

/**
 * The blanket Art. 9 consent (D3), on its own onboarding screen and in Settings → Privacy. Given once, for every
 * interest of the user's that may be sensitive or that they mark private; refusing it keeps the app usable.
 */
export interface Art9BlanketConsent {
  readonly title: string;
  readonly intro: string;
  readonly listIntro: string;
  readonly bullets: readonly string[];
  readonly note: { readonly label: string; readonly text: string };
  /** The user's own downgrade, "This isn't sensitive for me" (D2). */
  readonly override: string;
  readonly withdrawal: string;
  readonly checkbox: string;
  readonly agreeButton: string;
  readonly notNowButton: string;
  readonly readMore: string;
}

export interface GenderConsentSheet {
  readonly body: string;
  readonly checkbox: string;
  /** Shown to users who pick non-binary (PRIVACY.md §3.6 Options). */
  readonly nonbinaryAddendum: string | null;
}

export type LegalText =
  | { readonly id: string; readonly kind: 'art9Blanket'; readonly scope: 'art9'; readonly locale: Locale; readonly content: Art9BlanketConsent }
  | { readonly id: string; readonly kind: 'genderConsent'; readonly scope: 'gender'; readonly locale: Locale; readonly content: GenderConsentSheet }
  | { readonly id: string; readonly kind: 'interestNotice' | 'withdrawConfirmation'; readonly scope: null; readonly locale: Locale; readonly content: { readonly text: string } };

export type LegalTextKind = LegalText['kind'];

const GENDER_EN = {
  body: "To give you same-gender pods we need to know your gender. We use it only to form same-gender pods, never show it on any profile or use it for statistics, and delete it when you turn the setting off. Note: if you are placed in a same-gender pod, its members will know that everyone in it shares your gender and chose same-gender pods.",
  checkbox: "I consent to Friendpod using my gender to form same-gender pods.",
};

const GENDER_DA = {
  body: "For at kunne give dig pods med samme køn skal vi kende dit køn. Vi bruger det kun til at danne pods med samme køn, viser det aldrig på nogen profil, bruger det ikke til statistik og sletter det, når du slår indstillingen fra. Bemærk: Hvis du kommer i en pod med samme køn, ved medlemmerne, at alle i poden har samme køn som dig og har valgt pods med samme køn.",
  checkbox: "Jeg giver samtykke til, at Friendpod bruger mit køn til at danne pods med samme køn.",
};

export const LEGAL_TEXTS = [
  {
    id: 'art9-blanket-en-v2',
    kind: 'art9Blanket',
    scope: 'art9',
    locale: 'en',
    content: {
      title: "Sensitive interests",
      intro: "Some interests can reveal your health, religion or beliefs, sexual orientation or sex life, political opinions, ethnic origin or trade union membership, for example \"pregnant\", \"Ramadan\" or \"queer book club\". The law calls this special category data, so we need your explicit consent before we use interests like these. You can say no and still use Friendpod with your other interests. We then just won't save interests like these.",
      listIntro: "If you agree, Friendpod does the following with your interests that may be sensitive, and with any you mark \"Keep this private\":",
      bullets: [
        "checks automatically, on your phone and before anything is sent, whether an interest may be sensitive;",
        "saves it privately on your account, apart from your other interests. It is never shown on any profile, and we never show it as a label, suggestion or explanation;",
        "uses it in automated matching to propose pods of 4–6 people near you who added the same interest and also consented;",
        "shows it as the pod's theme only to the people invited to those pods, who all added it too. Some of them may decline. Once a pod is confirmed, its members see your first name. They see your photo only if you choose to show it in that pod;",
        "lets members of such a pod write to each other in a short meetup chat, open from 24 hours before until 24 hours after each meetup. What you write there may reveal the theme. Messages are deleted about 3 days after the meetup;",
        "checks accounts automatically for signs that someone is not genuine, for example an account that adds many unrelated sensitive interests, and then pauses that account's sensitive pods for a while.",
      ],
      note: { label: "Please note:", text: "we cannot verify who people are. Someone could create an account and pretend to share an interest in order to find out who has it. We make that harder (new accounts wait, accounts are limited in how many such pods they join, and you can report \"not a genuine member\"), but we cannot rule it out. Only share in a pod what you are comfortable with." },
      override: "If we treat an interest as sensitive and it isn't for you, choose \"This isn't sensitive for me\" on it. We then treat it as an ordinary interest, for you only, and the protections above no longer apply to it.",
      withdrawal: "You can withdraw your consent at any time in Settings → Privacy. We then delete all your sensitive interests at once and take you out of pods built around them. Your other interests are not affected.",
      checkbox: "I explicitly consent to Friendpod processing interests that may reveal sensitive information about me, for the purposes above.",
      agreeButton: "I agree",
      notNowButton: "Not now",
      readMore: "Read more about sensitive interests",
    },
  },
  {
    id: 'art9-blanket-da-v2',
    kind: 'art9Blanket',
    scope: 'art9',
    locale: 'da',
    content: {
      title: "Følsomme interesser",
      intro: "Nogle interesser kan afsløre noget om dit helbred, din religion eller overbevisning, din seksuelle orientering eller dit seksualliv, dine politiske holdninger, din etniske oprindelse eller dit fagforeningsmedlemskab, fx »gravid«, »ramadan« eller »queer læseklub«. Det er særlige kategorier af personoplysninger, så vi skal have dit udtrykkelige samtykke, før vi bruger den slags interesser. Du kan sagtens sige nej og stadig bruge Friendpod med dine andre interesser. Så gemmer vi bare ikke interesser som dem.",
      listIntro: "Hvis du siger ja, gør Friendpod følgende med dine interesser, der kan være følsomme, og med dem, du markerer med »Hold den privat«:",
      bullets: [
        "tjekker automatisk på din telefon, før noget bliver sendt, om en interesse kan være følsom;",
        "gemmer den privat på din konto, adskilt fra dine andre interesser. Den vises aldrig på nogen profil, og vi viser den aldrig som etiket, forslag eller forklaring;",
        "bruger den til automatisk matchning, så vi kan foreslå pods med 4–6 personer i nærheden, som har tilføjet samme interesse og også har givet samtykke;",
        "viser den kun som podens tema for de personer, der bliver inviteret til de pods, og som alle selv har tilføjet den. Nogle af dem siger måske nej. Når poden er bekræftet, ser medlemmerne dit fornavn. Dit billede ser de kun, hvis du selv vælger at vise det i den pod;",
        "lader medlemmerne af sådan en pod skrive sammen i en kort mødechat, der er åben fra 24 timer før til 24 timer efter hvert møde. Det, du skriver dér, kan afsløre temaet. Beskederne slettes ca. 3 dage efter mødet;",
        "tjekker automatisk konti for tegn på, at nogen ikke er ægte, fx en konto, der tilføjer mange forskellige følsomme interesser, og sætter i så fald kontoens følsomme pods på pause i en periode.",
      ],
      note: { label: "Vær opmærksom på:", text: "Vi kan ikke kontrollere, hvem folk er. Nogen kan oprette en konto og lade som om, de deler en interesse, for at finde ud af, hvem der har den. Vi gør det sværere (nye konti skal vente, en konto kan kun være med i et begrænset antal af den slags pods, og du kan anmelde »ikke et ægte medlem«), men vi kan ikke udelukke det. Del kun det i en pod, som du er tryg ved." },
      override: "Hvis vi behandler en interesse som følsom, og den ikke er det for dig, så vælg »Den er ikke følsom for mig« på interessen. Så behandler vi den som en almindelig interesse, kun for dig, og beskyttelsen ovenfor gælder ikke længere for den.",
      withdrawal: "Du kan til enhver tid trække dit samtykke tilbage under Indstillinger → Privatliv. Så sletter vi straks alle dine følsomme interesser og tager dig ud af pods, der er bygget op om dem. Dine andre interesser påvirkes ikke.",
      checkbox: "Jeg giver udtrykkeligt samtykke til, at Friendpod behandler interesser, der kan afsløre følsomme oplysninger om mig, til de formål, der er beskrevet ovenfor.",
      agreeButton: "Jeg siger ja",
      notNowButton: "Ikke nu",
      readMore: "Læs mere om følsomme interesser",
    },
  },
  { id: 'gender-en-v2', kind: 'genderConsent', scope: 'gender', locale: 'en', content: { ...GENDER_EN, nonbinaryAddendum: null } },
  {
    id: 'gender-nonbinary-en-v2',
    kind: 'genderConsent',
    scope: 'gender',
    locale: 'en',
    content: {
      ...GENDER_EN,
      nonbinaryAddendum: "Same-gender pods for non-binary people may be rare in your area, and their members will know that everyone in the pod is non-binary.",
    },
  },
  { id: 'gender-da-v2', kind: 'genderConsent', scope: 'gender', locale: 'da', content: { ...GENDER_DA, nonbinaryAddendum: null } },
  // DESIGN-DEVIATION: PRIVACY.md §3.6 has no Danish copy of the non-binary addendum, so there is no
  // 'gender-nonbinary-da-v2'. genderConsentText() returns null for that case and the app must not offer it.
  {
    id: 'interest-notice-en-v2',
    kind: 'interestNotice',
    scope: null,
    locale: 'en',
    content: {
      text: "Tip: interests that say something about your health, beliefs, sexuality, politics, ethnic origin or union membership are only saved if you have agreed to sensitive interests (Settings → Privacy). We then keep them private and use them only as a pod's theme. Only add things about yourself.",
    },
  },
  {
    id: 'interest-notice-da-v2',
    kind: 'interestNotice',
    scope: null,
    locale: 'da',
    content: {
      text: "Tip: Interesser, der siger noget om dit helbred, din tro, din seksualitet, politik, etniske oprindelse eller fagforening, gemmer vi kun, hvis du har sagt ja til følsomme interesser (Indstillinger → Privatliv). Så holder vi dem private og bruger dem kun som tema for en pod. Tilføj kun noget om dig selv.",
    },
  },
  {
    id: 'art9-withdraw-all-en-v2',
    kind: 'withdrawConfirmation',
    scope: null,
    locale: 'en',
    content: {
      text: "Withdraw your consent for sensitive interests? We'll delete all your sensitive interests now and take you out of pods built around them. Other members will only see that a member left. You can keep using Friendpod with your other interests.",
    },
  },
  {
    id: 'art9-withdraw-all-da-v2',
    kind: 'withdrawConfirmation',
    scope: null,
    locale: 'da',
    content: {
      text: "Vil du trække dit samtykke til følsomme interesser tilbage? Vi sletter alle dine følsomme interesser nu og tager dig ud af pods, der er bygget op om dem. De andre medlemmer ser kun, at et medlem er gået. Du kan fortsat bruge Friendpod med dine andre interesser.",
    },
  },
] as const satisfies readonly LegalText[];

export type LegalTextId = (typeof LEGAL_TEXTS)[number]['id'];

const BY_ID = new Map<string, LegalText>(LEGAL_TEXTS.map((t) => [t.id, t]));

export function getLegalText(id: string): LegalText | null {
  return BY_ID.get(id) ?? null;
}

/** The current text of a kind and locale (the highest version wins). */
export function currentLegalText(kind: Exclude<LegalTextKind, 'genderConsent'>, locale: Locale): LegalText {
  const candidates = LEGAL_TEXTS.filter((t) => t.kind === kind && t.locale === locale);
  const latest = candidates.at(-1);
  if (!latest) throw new Error(`no ${kind} text for ${locale}`);
  return latest;
}

export function genderConsentText(locale: Locale, nonbinary: boolean): LegalText | null {
  const id = nonbinary ? `gender-nonbinary-${locale}-v2` : `gender-${locale}-v2`;
  return getLegalText(id);
}

export function consentScopeOf(id: string): ConsentScope | null {
  return getLegalText(id)?.scope ?? null;
}

/**
 * Canonical text of a template: what is hashed into `textSha256`. Markdown-like, mirroring the layout
 * in PRIVACY.md; UI annotations such as "(disabled until ticked)" are not part of the copy.
 */
export function canonicalLegalText(text: LegalText): string {
  switch (text.kind) {
    case 'art9Blanket': {
      const c = text.content;
      return [
        `**${c.title}**`,
        c.intro,
        [c.listIntro, ...c.bullets.map((b) => `- ${b}`)].join('\n'),
        `**${c.note.label}** ${c.note.text}`,
        c.override,
        c.withdrawal,
        `☐ **${c.checkbox}**`,
        `[${c.agreeButton}] [${c.notNowButton}] · ${c.readMore}`,
      ].join('\n\n');
    }
    case 'genderConsent': {
      const c = text.content;
      return [c.body, `☐ ${c.checkbox}`, ...(c.nonbinaryAddendum ? [c.nonbinaryAddendum] : [])].join('\n\n');
    }
    case 'interestNotice':
    case 'withdrawConfirmation':
      return text.content.text;
  }
}
