import type { Locale } from "./strings";

// Shown as a fallback reading (Psalm 23) when no BibleQL API key is set.
export const SAMPLE: Record<Locale, string[]> = {
  en: [
    "Yahweh is my shepherd; I shall lack nothing.",
    "He makes me lie down in green pastures. He leads me beside still waters.",
    "He restores my soul. He guides me in the paths of righteousness for his name's sake.",
    "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.",
    "You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup runs over.",
    "Surely goodness and loving kindness shall follow me all the days of my life, and I will dwell in Yahweh's house forever."
  ],
  es: [
    "Jehová es mi pastor; nada me faltará.",
    "En lugares de delicados pastos me hará yacer: junto a aguas de reposo me pastoreará.",
    "Confortará mi alma; guiaráme por sendas de justicia por amor de su nombre.",
    "Aunque ande en valle de sombra de muerte, no temeré mal alguno; porque tú estarás conmigo: tu vara y tu cayado me infundirán aliento.",
    "Aderezarás mesa delante de mí, en presencia de mis angustiadores: ungiste mi cabeza con aceite: mi copa está rebosando.",
    "Ciertamente el bien y la misericordia me seguirán todos los días de mi vida: y en la casa de Jehová moraré por largos días."
  ]
};
