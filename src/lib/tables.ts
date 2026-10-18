// Anexo A — tabelas de dados (valores exatos da especificação).

export interface ToneDef {
  key: string;
  label: string;
  category: string;
  modifiers: string[];
}

const T = (category: string, key: string, label: string, mods: string): ToneDef => ({
  key,
  label,
  category,
  modifiers: mods.split(",").map((s) => s.trim()),
});

export const DEFAULT_TONE = "cinematic";

export const TONES: ToneDef[] = [
  T("Padrão", "cinematic", "Cinematográfico", "cinematic, professional"),
  T("Sombrio / terror / suspense", "dark", "Sombrio", "dark, shadows, fog, abandoned, night"),
  T("Sombrio / terror / suspense", "horror", "Terror", "dark, eerie, fog, ruins, storm"),
  T("Sombrio / terror / suspense", "suspens", "Suspense", "dark, mysterious, shadows, moody, night"),
  T("Sombrio / terror / suspense", "thriller", "Thriller", "dark, urban night, tension, shadows"),
  T("Infantil / fantasia", "child", "Infantil", "colorful, nature, animals, playful, bright"),
  T("Infantil / fantasia", "kid", "Criança", "colorful, cartoon, cute, garden, sunshine"),
  T("Infantil / fantasia", "fairy", "Conto de fadas", "magical, forest, sparkle, flowers, rainbow"),
  T("Crime", "crime", "Crime", "urban, noir, police, city night, documentary"),
  T("Crime", "serious", "Sério", "urban, black white, formal, documentary"),
  T("Educativo / explicativo", "education", "Educativo", "clean, office, whiteboard, modern, minimal"),
  T("Educativo / explicativo", "explanat", "Explicativo", "clean, diagram, studio, bright, professional"),
  T("Educativo / explicativo", "clear", "Claro e direto", "minimal, bright, modern, organized"),
  T("Educativo / explicativo", "wendover", "Infraestrutura (estilo Wendover)", "aerial, infrastructure, map, transport, logistics"),
  T("Educativo / explicativo", "explainer", "Explainer", "clean, diagram, studio, modern"),
  T("Documentário / formal", "documentary", "Documentário", "landscape, nature, journalism, formal, aerial"),
  T("Documentário / formal", "formal", "Formal", "corporate, city, professional, clean"),
  T("Rápido / viral", "fast", "Rápido", "dynamic, colorful, impact, speed, energy"),
  T("Rápido / viral", "viral", "Viral", "trending, colorful, fast, energy, bold"),
  T("Rápido / viral", "shorts", "Shorts", "vertical, dynamic, bold, colorful"),
  T("Vlog / pessoal", "vlog", "Vlog", "people, everyday, street, energy, casual"),
  T("Vlog / pessoal", "personal", "Pessoal", "people, lifestyle, casual, warm"),
  T("Vlog / pessoal", "enthusiast", "Entusiasta", "energy, people, action, outdoors"),
  T("Calmo / ASMR / relax", "calm", "Calmo", "nature, soft light, cozy, interior, peaceful"),
  T("Calmo / ASMR / relax", "asmr", "ASMR", "close up, texture, soft, warm light, detail"),
  T("Calmo / ASMR / relax", "relax", "Relaxante", "nature, water, sunset, peaceful, slow"),
  T("Calmo / ASMR / relax", "cozy", "Aconchegante", "interior, warm, candle, book, rain window"),
  T("Motivacional", "motivat", "Motivacional", "sunset, running, mountain, success, sunrise"),
  T("Motivacional", "energetic", "Energético", "workout, action, sunrise, determination"),
  T("Motivacional", "coach", "Coach", "sunrise, road, athlete, overcome, sky"),
  T("Tecnologia / ciência", "tech", "Tecnologia", "technology, gadget, studio, clean, circuit"),
  T("Tecnologia / ciência", "review", "Review", "product, studio, close up, modern, device"),
  T("Tecnologia / ciência", "science", "Ciência", "lab, futuristic, data, space, technology"),
  T("Gaming", "gaming", "Gaming", "neon, gaming setup, rgb lights, action, screen"),
  T("Gaming", "loud", "Intenso", "neon, explosion, fast, energy, vibrant"),
  T("Negócios / finanças", "business", "Negócios", "corporate, meeting, city, skyscraper, office"),
  T("Negócios / finanças", "corporate", "Corporativo", "boardroom, city, professional, finance"),
  T("Negócios / finanças", "finance", "Finanças", "stock market, city skyline, numbers, gold"),
  T("Lendas / folclore", "legend", "Lenda", "forest, mystery, night, old, fog"),
  T("Lendas / folclore", "folklore", "Folclore", "ancient, forest, campfire, night, ruin"),
  T("Lendas / folclore", "urban legend", "Lenda urbana", "dark alley, abandoned, night, mystery"),
];

export function toneModifiers(key: string): string[] {
  return (TONES.find((t) => t.key === key) ?? TONES[0]).modifiers;
}

const L = (s: string) => s.split(",").map((x) => x.trim());

export const EMOTION_VISUALS: Record<string, string[]> = {
  opportunity: L("city skyline, growth, sunrise, open road"),
  success: L("luxury, modern architecture, celebration, gold"),
  hope: L("sunrise, light tunnel, spring flowers, dawn"),
  joy: L("sunshine, festival, bright colors, laughter"),
  freedom: L("open sky, ocean, flying bird, highway"),
  growth: L("plant growing, city building, upward, green"),
  wealth: L("gold, luxury car, penthouse, diamond"),
  victory: L("trophy, summit mountain, fireworks, podium"),
  innovation: L("futuristic, technology, startup, creative"),
  beginning: L("dawn, first step, empty road, new day"),
  crisis: L("storm, broken, abandoned building, dark clouds"),
  failure: L("ruins, empty, rain, fallen, shattered"),
  danger: L("fire, cliff edge, warning, dark alley"),
  fear: L("dark forest, shadows, fog, abandoned"),
  loss: L("empty chair, autumn leaves, rain window, alone"),
  conflict: L("chess, storm clouds, waves crashing, war"),
  corruption: L("dark city, smoke, cage, shadows"),
  decline: L("ruins, rust, decay, dried desert"),
  change: L("crossroads, door opening, butterfly, seasons"),
  recovery: L("sunrise road, phoenix, spring bloom, healing"),
  mystery: L("fog, closed door, labyrinth, keyhole"),
  discovery: L("map, telescope, cave, exploration"),
  transformation: L("metamorphosis, before after, construction, evolution"),
  tension: L("tightrope, clock ticking, storm approaching, standoff"),
  revelation: L("light breaking, curtain opening, magnifying glass"),
  reflection: L("mirror, still water, contemplation, journal"),
  explanation: L("diagram, blueprint, library, classroom"),
  comparison: L("side by side, balance scale, contrast"),
  history: L("old photograph, museum, vintage, archive"),
  technology: L("circuit board, data center, hologram, code"),
  nature: L("forest, ocean, mountains, wildlife"),
};

// Ordem importa: desempate pela primeira da tabela.
export const EMOTION_KEYWORDS: [string, string[]][] = [
  ["opportunity", L("opportunity, invest, chance, potential, oportunidade, investir")],
  ["success", L("success, win, profit, achieve, sucesso, lucro, vitória, conquist")],
  ["hope", L("hope, dream, future, better, esperança, sonho, futuro, melhor")],
  ["joy", L("happy, joy, fun, celebrate, feliz, alegria, divert, celebr")],
  ["freedom", L("freedom, free, escape, liberdade, livre, escapar")],
  ["growth", L("grow, scale, expand, develop, cresci, escala, expandi, desenvolv")],
  ["wealth", L("money, rich, wealth, million, billion, dinheiro, rico, riqueza, milhão, bilhão")],
  ["victory", L("victory, champion, first place, medal, campeão, medalha, primeiro lugar")],
  ["innovation", L("innovate, invent, create, startup, inovar, inventar, criar")],
  ["beginning", L("begin, start, origin, birth, início, começo, origem, nasciment")],
  ["crisis", L("crisis, crash, collapse, disaster, crise, colapso, desastre, queda")],
  ["failure", L("fail, mistake, error, wrong, falha, erro, errado, fracass")],
  ["danger", L("danger, risk, threat, warning, perigo, risco, ameaça, alerta")],
  ["fear", L("fear, scared, terror, horror, afraid, medo, assust")],
  ["loss", L("loss, lost, gone, disappear, perda, perdeu, sumiu, desaparec")],
  ["conflict", L("war, fight, battle, conflict, guerra, luta, batalha, conflito")],
  ["corruption", L("corrupt, fraud, scandal, lie, corrupção, fraude, escândalo, mentira")],
  ["decline", L("decline, fall, decay, ruin, declínio, ruína, decadência")],
  ["change", L("change, transform, shift, turn, mudan, virada")],
  ["recovery", L("recover, rebuild, comeback, heal, recuper, reconstrui, volta por cima, curar")],
  ["mystery", L("mystery, secret, hidden, unknown, mistério, segredo, escondido, desconhecido")],
  ["discovery", L("discover, find, reveal, uncover, descobr, encontr, revela")],
  ["transformation", L("transform, evolve, metamorphos, evolu, metamorfos")],
  ["tension", L("tension, pressure, deadline, urgent, tensão, pressão, prazo")],
  ["revelation", L("reveal, truth, expose, uncover, verdade, expor, revelação")],
  ["reflection", L("reflect, think, ponder, review, reflet, pensar, revis")],
  ["explanation", L("explain, how, why, because, explic, como, por que, porque")],
  ["comparison", L("compare, versus, vs, differ, compar, diferenç")],
  ["history", L("history, ancient, century, era, história, antigo, século")],
  ["technology", L("technology, ai, computer, digital, tecnologia, computador, artificial")],
  ["nature", L("nature, animal, forest, ocean, natureza, floresta, oceano")],
];

export const GENERIC_QUERIES = ["cinematic atmosphere", "dramatic landscape", "abstract motion", "aerial city"];
