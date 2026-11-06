/**
 * Credits for the open data, the font and the open-source software in the app (Me → Settings → Licences).
 * The font licence is the SIL Open Font License 1.1 as shipped with @expo-google-fonts/plus-jakarta-sans
 * (LICENSE_FONT); the OFL asks that its copyright notice and licence travel with the font, so it is shown in full.
 * Licence texts stay in English: translations are not the licence.
 */

/** The font family the app bundles (Plus Jakarta Sans 400–800). */
export const FONT_CREDIT = {
  name: 'Plus Jakarta Sans',
  copyright: 'Copyright 2020 The Plus Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans)',
  licence: 'SIL Open Font License 1.1',
} as const;

/** LICENSE_FONT of @expo-google-fonts/plus-jakarta-sans 0.4.2, verbatim. */
export const FONT_LICENCE_TEXT =
  'Copyright 2020 The Plus Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans)\n\nThis Font Software is licensed under the SIL Open Font License, Version 1.1.\nThis license is copied below, and is also available with a FAQ at:\nhttp://scripts.sil.org/OFL\n\n\n-----------------------------------------------------------\nSIL OPEN FONT LICENSE Version 1.1 - 26 February 2007\n-----------------------------------------------------------\n\nPREAMBLE\nThe goals of the Open Font License (OFL) are to stimulate worldwide\ndevelopment of collaborative font projects, to support the font creation\nefforts of academic and linguistic communities, and to provide a free and\nopen framework in which fonts may be shared and improved in partnership\nwith others.\n\nThe OFL allows the licensed fonts to be used, studied, modified and\nredistributed freely as long as they are not sold by themselves. The\nfonts, including any derivative works, can be bundled, embedded, \nredistributed and/or sold with any software provided that any reserved\nnames are not used by derivative works. The fonts and derivatives,\nhowever, cannot be released under any other type of license. The\nrequirement for fonts to remain under this license does not apply\nto any document created using the fonts or their derivatives.\n\nDEFINITIONS\n"Font Software" refers to the set of files released by the Copyright\nHolder(s) under this license and clearly marked as such. This may\ninclude source files, build scripts and documentation.\n\n"Reserved Font Name" refers to any names specified as such after the\ncopyright statement(s).\n\n"Original Version" refers to the collection of Font Software components as\ndistributed by the Copyright Holder(s).\n\n"Modified Version" refers to any derivative made by adding to, deleting,\nor substituting -- in part or in whole -- any of the components of the\nOriginal Version, by changing formats or by porting the Font Software to a\nnew environment.\n\n"Author" refers to any designer, engineer, programmer, technical\nwriter or other person who contributed to the Font Software.\n\nPERMISSION & CONDITIONS\nPermission is hereby granted, free of charge, to any person obtaining\na copy of the Font Software, to use, study, copy, merge, embed, modify,\nredistribute, and sell modified and unmodified copies of the Font\nSoftware, subject to the following conditions:\n\n1) Neither the Font Software nor any of its individual components,\nin Original or Modified Versions, may be sold by itself.\n\n2) Original or Modified Versions of the Font Software may be bundled,\nredistributed and/or sold with any software, provided that each copy\ncontains the above copyright notice and this license. These can be\nincluded either as stand-alone text files, human-readable headers or\nin the appropriate machine-readable metadata fields within text or\nbinary files as long as those fields can be easily viewed by the user.\n\n3) No Modified Version of the Font Software may use the Reserved Font\nName(s) unless explicit written permission is granted by the corresponding\nCopyright Holder. This restriction only applies to the primary font name as\npresented to the users.\n\n4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font\nSoftware shall not be used to promote, endorse or advertise any\nModified Version, except to acknowledge the contribution(s) of the\nCopyright Holder(s) and the Author(s) or with their explicit written\npermission.\n\n5) The Font Software, modified or unmodified, in part or in whole,\nmust be distributed entirely under this license, and must not be\ndistributed under any other license. The requirement for fonts to\nremain under this license does not apply to any document created\nusing the Font Software.\n\nTERMINATION\nThis license becomes null and void if any of the above conditions are\nnot met.\n\nDISCLAIMER\nTHE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,\nEXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF\nMERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT\nOF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE\nCOPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,\nINCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL\nDAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\nFROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM\nOTHER DEALINGS IN THE FONT SOFTWARE.';

/** The licence of the postcode table (core's dk-postcodes.json). */
export const CC_BY_4_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const GEONAMES_URL = 'https://www.geonames.org';

/**
 * The open-source software and model the app ships, with their licences (from each package's own package.json;
 * the model card for EmbeddingGemma 2). Every package's full licence text comes with its source code. Each entry is
 * the project names only, which stay as they are; the page joins them with the app language's "and" and adds what
 * the model is ("the on-device model"), so no English prose shows in the Danish app.
 */
export interface SoftwareCredit {
  /** Project names, joined as "A and B" / "A, B and C" ("og" in Danish). */
  readonly names: readonly string[];
  readonly licence: string;
  /** Said after the names in brackets, in the app language. */
  readonly what?: 'onDeviceModel';
}

export const SOFTWARE: readonly SoftwareCredit[] = [
  { names: ['React', 'React Native'], licence: 'MIT' },
  { names: ['Expo', 'Expo Router', 'Expo Modules'], licence: 'MIT' },
  { names: ['React Native Firebase'], licence: 'Apache-2.0' },
  { names: ['React Native Google Sign-In'], licence: 'MIT' },
  { names: ['TanStack Query'], licence: 'MIT' },
  { names: ['i18next', 'react-i18next'], licence: 'MIT' },
  { names: ['React Hook Form'], licence: 'MIT' },
  { names: ['Zod'], licence: 'MIT' },
  { names: ['react-native-svg'], licence: 'MIT' },
  { names: ['React Native Screens', 'Gesture Handler', 'Safe Area Context'], licence: 'MIT' },
  { names: ['ONNX Runtime'], licence: 'MIT' },
  { names: ['Hugging Face Tokenizers'], licence: 'Apache-2.0' },
  { names: ['EmbeddingGemma 2'], licence: 'Apache-2.0', what: 'onDeviceModel' },
];
