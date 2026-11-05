import { normalize } from "./queryBuilder";

const CHRISTIAN_SIGNS = [
  "cristao", "crista", "cristianismo", "christian", "jesus", "cristo", "christ", "evangel", "gospel", "biblia", "bible",
  "igreja", "church", "louvor", "worship", "adoracao", "pastor", "senhor deus", "espirito santo", "holy spirit", "salvacao", "salvation",
];

/** Termos de outras religiões, ocultismo e símbolos que não podem aparecer em conteúdo cristão. */
export const CHRISTIAN_BLOCKLIST = [
  "witch", "witchcraft", "wicca", "occult", "pagan", "tarot", "pentagram", "satan", "satanic", "demon", "devil", "halloween",
  "spell", "magic", "magician", "voodoo", "crystal ball", "ouija", "skull", "zodiac", "horoscope", "astrology", "fortune teller",
  "buddha", "buddhist", "buddhism", "monk", "temple", "pagoda", "zen", "lotus", "dharma", "tibet",
  "mosque", "islam", "islamic", "muslim", "quran", "koran", "hijab", "ramadan", "allah", "mecca",
  "hindu", "hinduism", "ganesha", "shiva", "krishna", "diwali", "mandala", "om", "yoga", "chakra",
  "catholic", "catholicism", "rosary", "pope", "vatican", "saint", "virgin mary", "madonna", "our lady", "nun", "nuns", "novena",
  "statue", "idol", "shrine", "incense", "altar candles", "torii", "shinto", "taoism", "yin yang", "synagogue", "menorah", "kabbalah",
  "umbanda", "candomble", "orixa", "macumba", "shaman", "ritual", "sage smudging", "dreamcatcher",
];

export function isChristianContext(text: string): boolean {
  const n = normalize(text);
  return CHRISTIAN_SIGNS.some((s) => n.includes(s));
}

/** Lista de termos proibidos para o tema (vazia quando não se aplica). */
export function blockedTermsFor(...texts: (string | string[] | undefined)[]): string[] {
  const all = texts.flat().filter(Boolean).join(" ");
  return isChristianContext(all) ? CHRISTIAN_BLOCKLIST : [];
}

function words(s: string): string {
  return ` ${normalize(s).replace(/[^a-z0-9]+/g, " ").trim()} `;
}

/** True quando o texto (consulta ou endereço/descrição da mídia) contém algum termo proibido. */
export function hasBlockedTerm(text: string, blocked: string[]): boolean {
  if (!blocked.length) return false;
  const w = words(text);
  return blocked.some((t) => w.includes(` ${words(t).trim()} `) || w.includes(` ${words(t).trim()}s `));
}
