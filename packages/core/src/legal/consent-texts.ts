/**
 * Versioned legal copy, verbatim from PRIVACY.md §3.2, §3.3, §3.5 and §3.6 (drafts awaiting [LAWYER]).
 * `{tag}` stays unfilled in the template; its SHA-256 (hashes.ts) identifies the text, not the tag.
 * Once shipped, any wording change needs a new version id: a test compares this file with PRIVACY.md and locks the hashes.
 */
import type { ConsentScope, Locale } from '../types/domain';

export const TAG_PLACEHOLDER = '{tag}';

export interface Art9ConsentSheet {
  readonly title: string;
  readonly intro: string;
  readonly listIntro: string;
  readonly bullets: readonly string[];
  readonly note: { readonly label: string; readonly text: string };
  readonly withdrawal: string;
  readonly checkbox: string;
  readonly addButton: string;
  readonly dontAddButton: string;
  readonly readMore: string;
}

export interface GenderConsentSheet {
  readonly body: string;
  readonly checkbox: string;
  /** Shown to users who pick non-binary (PRIVACY.md §3.6 Options). */
  readonly nonbinaryAddendum: string | null;
}

export type LegalText =
  | { readonly id: string; readonly kind: 'art9Consent'; readonly scope: 'art9'; readonly locale: Locale; readonly content: Art9ConsentSheet }
  | { readonly id: string; readonly kind: 'genderConsent'; readonly scope: 'gender'; readonly locale: Locale; readonly content: GenderConsentSheet }
  | { readonly id: string; readonly kind: 'interestNotice' | 'withdrawConfirmation'; readonly scope: null; readonly locale: Locale; readonly content: { readonly text: string } };

export type LegalTextKind = LegalText['kind'];

const GENDER_EN = {
  body: "To give you same-gender pods we need to know your gender. We use it only to form same-gender pods, never show it on any profile or use it for statistics, and delete it when you turn the setting off. Note: if you are placed in a same-gender pod, its members will know that everyone in it shares your gender and chose same-gender pods.",
  checkbox: "I consent to Grouper using my gender to form same-gender pods.",
};

const GENDER_DA = {
  body: "For at kunne give dig pods med samme køn skal vi kende dit køn. Vi bruger det kun til at danne pods med samme køn, viser det aldrig på nogen profil, bruger det ikke til statistik og sletter det, når du slår indstillingen fra. Bemærk: Hvis du kommer i en pod med samme køn, ved medlemmerne, at alle i poden har samme køn som dig og har valgt pods med samme køn.",
  checkbox: "Jeg giver samtykke til, at Grouper bruger mit køn til at danne pods med samme køn.",
};

export const LEGAL_TEXTS = [
  {
    id: 'art9-tag-en-v1',
    kind: 'art9Consent',
    scope: 'art9',
    locale: 'en',
    content: {
      title: "This interest may be sensitive",
      intro: "\"{tag}\" may reveal information about your health, religion or beliefs, sexual orientation or sex life, political opinions, ethnic origin or trade union membership. The law calls this special category data, so we need your explicit consent before we save it.",
      listIntro: "If you agree, Grouper will:",
      bullets: [
        "save \"{tag}\" privately on your account. It is never shown on any profile.",
        "use it in automated matching to propose pods of 4–6 people near you who added the same interest and also consented;",
        "show it as the pod's theme only to the people invited to those pods, who all added it too. Some of them may decline. Once a pod is confirmed, its members see your first name. They see your photo only if you choose to show it in that pod;",
        "let members of a confirmed pod write to each other in a short meetup chat, open from 24 hours before until 24 hours after each meetup. Messages are deleted 3 days after the meetup;",
        "let a Grouper team member see the wording of the interest, without your name, to check how it is classified;",
        "check accounts for signs that someone is not genuine, for example an account that adds many unrelated sensitive interests.",
      ],
      note: { label: "Please note:", text: "we cannot verify who people are. Someone could create an account and pretend to share this interest in order to find out who has it. We make that harder (new accounts wait, accounts are limited in how many such pods they join, and you can report \"not a genuine member\"), but we cannot rule it out. Only share in a pod what you are comfortable with." },
      withdrawal: "You can withdraw at any time: Interests → \"{tag}\" → Remove & withdraw. We then delete it and take you out of pods built around it. Your other interests are not affected.",
      checkbox: "I explicitly consent to Grouper processing \"{tag}\", which may reveal sensitive information about me, for the purposes above.",
      addButton: "Add interest",
      dontAddButton: "Don't add",
      readMore: "Read more about sensitive interests",
    },
  },
  {
    id: 'art9-tag-da-v1',
    kind: 'art9Consent',
    scope: 'art9',
    locale: 'da',
    content: {
      title: "Denne interesse kan være følsom",
      intro: "»{tag}« kan afsløre oplysninger om dit helbred, din religion eller overbevisning, din seksuelle orientering eller dit seksualliv, dine politiske holdninger, din etniske oprindelse eller dit fagforeningsmedlemskab. Det er særlige kategorier af personoplysninger, så vi skal have dit udtrykkelige samtykke, før vi gemmer den.",
      listIntro: "Hvis du siger ja, vil Grouper:",
      bullets: [
        "gemme »{tag}« privat på din konto. Den vises aldrig på nogen profil.",
        "bruge den til automatisk matchning, så vi kan foreslå pods med 4–6 personer i nærheden, som har tilføjet samme interesse og også har givet samtykke;",
        "kun vise den som podens tema for de personer, der bliver inviteret til de pods, og som alle selv har tilføjet den. Nogle af dem siger måske nej. Når poden er bekræftet, ser medlemmerne dit fornavn. Dit billede ser de kun, hvis du selv vælger at vise det i den pod;",
        "lade medlemmerne af en bekræftet pod skrive sammen i en kort mødechat, der er åben fra 24 timer før til 24 timer efter hvert møde. Beskederne slettes 3 dage efter mødet;",
        "lade en medarbejder hos Grouper se ordlyden af interessen, uden dit navn, for at kontrollere, hvordan den er klassificeret;",
        "holde øje med tegn på, at en konto ikke er ægte, fx en konto, der tilføjer mange forskellige følsomme interesser.",
      ],
      note: { label: "Vær opmærksom på:", text: "Vi kan ikke kontrollere, hvem folk er. Nogen kan oprette en konto og lade som om, de deler interessen, for at finde ud af, hvem der har den. Vi gør det sværere (nye konti skal vente, en konto kan kun være med i et begrænset antal af den slags pods, og du kan anmelde »ikke et ægte medlem«), men vi kan ikke udelukke det. Del kun det i en pod, som du er tryg ved." },
      withdrawal: "Du kan til enhver tid trække dit samtykke tilbage: Interesser → »{tag}« → Fjern og træk samtykke tilbage. Så sletter vi interessen og tager dig ud af pods, der er bygget op om den. Dine andre interesser påvirkes ikke.",
      checkbox: "Jeg giver udtrykkeligt samtykke til, at Grouper behandler »{tag}«, som kan afsløre følsomme oplysninger om mig, til de formål, der er beskrevet ovenfor.",
      addButton: "Tilføj interesse",
      dontAddButton: "Tilføj ikke",
      readMore: "Læs mere om følsomme interesser",
    },
  },
  { id: 'gender-en-v1', kind: 'genderConsent', scope: 'gender', locale: 'en', content: { ...GENDER_EN, nonbinaryAddendum: null } },
  {
    id: 'gender-nonbinary-en-v1',
    kind: 'genderConsent',
    scope: 'gender',
    locale: 'en',
    content: {
      ...GENDER_EN,
      nonbinaryAddendum: "Same-gender pods for non-binary people may be rare in your area, and their members will know that everyone in the pod is non-binary.",
    },
  },
  { id: 'gender-da-v1', kind: 'genderConsent', scope: 'gender', locale: 'da', content: { ...GENDER_DA, nonbinaryAddendum: null } },
  // DESIGN-DEVIATION: PRIVACY.md §3.6 has no Danish copy of the non-binary addendum, so there is no
  // 'gender-nonbinary-da-v1'. genderConsentText() returns null for that case and the app must not offer it.
  {
    id: 'interest-notice-en-v1',
    kind: 'interestNotice',
    scope: null,
    locale: 'en',
    content: {
      text: "Tip: if an interest says something about your health, beliefs, sexuality, politics, ethnic origin or union membership, we'll ask for your explicit consent before saving it. Only add things about yourself.",
    },
  },
  {
    id: 'interest-notice-da-v1',
    kind: 'interestNotice',
    scope: null,
    locale: 'da',
    content: {
      text: "Tip: Hvis en interesse siger noget om dit helbred, din tro, din seksualitet, politik, etniske oprindelse eller fagforening, beder vi om dit udtrykkelige samtykke, før vi gemmer den. Tilføj kun noget om dig selv.",
    },
  },
  {
    id: 'art9-withdraw-en-v1',
    kind: 'withdrawConfirmation',
    scope: null,
    locale: 'en',
    content: {
      text: "Remove ‘{tag}’ and withdraw consent? We'll delete it now and take you out of pods built around it. Other members will only see that a member left.",
    },
  },
  {
    id: 'art9-withdraw-da-v1',
    kind: 'withdrawConfirmation',
    scope: null,
    locale: 'da',
    content: {
      text: "Fjern »{tag}« og træk samtykket tilbage? Vi sletter den nu og tager dig ud af pods, der er bygget op om den. De andre medlemmer ser kun, at et medlem er gået.",
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
  const id = nonbinary ? `gender-nonbinary-${locale}-v1` : `gender-${locale}-v1`;
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
    case 'art9Consent': {
      const c = text.content;
      return [
        `**${c.title}**`,
        c.intro,
        [c.listIntro, ...c.bullets.map((b) => `- ${b}`)].join('\n'),
        `**${c.note.label}** ${c.note.text}`,
        c.withdrawal,
        `☐ **${c.checkbox}**`,
        `[${c.addButton}] [${c.dontAddButton}] · ${c.readMore}`,
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

/** Fills `{tag}` for display. Never use the filled text for hashing. */
export function fillTag(template: string, tag: string): string {
  return template.split(TAG_PLACEHOLDER).join(tag);
}
