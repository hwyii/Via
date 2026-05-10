export const COUNTRY_CONTINENT: Record<string, string> = {
  // Africa
  DZ:"Africa", AO:"Africa", BJ:"Africa", BW:"Africa", BF:"Africa", BI:"Africa",
  CM:"Africa", CV:"Africa", CF:"Africa", TD:"Africa", KM:"Africa", CG:"Africa",
  CD:"Africa", CI:"Africa", DJ:"Africa", EG:"Africa", GQ:"Africa", ER:"Africa",
  ET:"Africa", GA:"Africa", GM:"Africa", GH:"Africa", GN:"Africa", GW:"Africa",
  KE:"Africa", LS:"Africa", LR:"Africa", LY:"Africa", MG:"Africa", MW:"Africa",
  ML:"Africa", MR:"Africa", MU:"Africa", MA:"Africa", MZ:"Africa", NA:"Africa",
  NE:"Africa", NG:"Africa", RW:"Africa", ST:"Africa", SN:"Africa", SC:"Africa",
  SL:"Africa", SO:"Africa", ZA:"Africa", SS:"Africa", SD:"Africa", SZ:"Africa",
  TZ:"Africa", TG:"Africa", TN:"Africa", UG:"Africa", ZM:"Africa", ZW:"Africa",

  // Asia
  AF:"Asia", AM:"Asia", AZ:"Asia", BH:"Asia", BD:"Asia", BT:"Asia", BN:"Asia",
  KH:"Asia", CN:"Asia", CY:"Asia", GE:"Asia", IN:"Asia", ID:"Asia", IR:"Asia",
  IQ:"Asia", IL:"Asia", JP:"Asia", JO:"Asia", KZ:"Asia", KW:"Asia", KG:"Asia",
  LA:"Asia", LB:"Asia", MY:"Asia", MV:"Asia", MN:"Asia", MM:"Asia", NP:"Asia",
  KP:"Asia", OM:"Asia", PK:"Asia", PS:"Asia", PH:"Asia", QA:"Asia", SA:"Asia",
  SG:"Asia", KR:"Asia", LK:"Asia", SY:"Asia", TW:"Asia", TJ:"Asia", TH:"Asia",
  TL:"Asia", TR:"Asia", TM:"Asia", AE:"Asia", UZ:"Asia", VN:"Asia", YE:"Asia",
  HK:"Asia", MO:"Asia", "CN-TW":"Asia",

  // Europe
  AL:"Europe", AD:"Europe", AT:"Europe", BY:"Europe", BE:"Europe", BA:"Europe",
  BG:"Europe", HR:"Europe", CZ:"Europe", DK:"Europe", EE:"Europe", FI:"Europe",
  FR:"Europe", DE:"Europe", GR:"Europe", HU:"Europe", IS:"Europe", IE:"Europe",
  IT:"Europe", XK:"Europe", LV:"Europe", LI:"Europe", LT:"Europe", LU:"Europe",
  MT:"Europe", MD:"Europe", MC:"Europe", ME:"Europe", NL:"Europe", MK:"Europe",
  NO:"Europe", PL:"Europe", PT:"Europe", RO:"Europe", RU:"Europe", SM:"Europe",
  RS:"Europe", SK:"Europe", SI:"Europe", ES:"Europe", SE:"Europe", CH:"Europe",
  UA:"Europe", GB:"Europe", VA:"Europe",

  // North America
  AG:"North America", BS:"North America", BB:"North America", BZ:"North America",
  CA:"North America", CR:"North America", CU:"North America", DM:"North America",
  DO:"North America", SV:"North America", GD:"North America", GT:"North America",
  HT:"North America", HN:"North America", JM:"North America", MX:"North America",
  NI:"North America", PA:"North America", KN:"North America", LC:"North America",
  VC:"North America", TT:"North America", US:"North America",

  // South America
  AR:"South America", BO:"South America", BR:"South America", CL:"South America",
  CO:"South America", EC:"South America", GY:"South America", PY:"South America",
  PE:"South America", SR:"South America", UY:"South America", VE:"South America",

  // Oceania
  AU:"Oceania", FJ:"Oceania", KI:"Oceania", MH:"Oceania", FM:"Oceania",
  NR:"Oceania", NZ:"Oceania", PW:"Oceania", PG:"Oceania", WS:"Oceania",
  SB:"Oceania", TO:"Oceania", TV:"Oceania", VU:"Oceania",
};

export const CONTINENT_ORDER = [
  "Asia", "Europe", "North America", "South America", "Africa", "Oceania",
] as const;

export const CONTINENT_META: Record<string, { emoji: string; short: string; total: number }> = {
  "Asia":          { emoji: "🌏", short: "Asia",    total: 48 },
  "Europe":        { emoji: "🌍", short: "Europe",  total: 44 },
  "North America": { emoji: "🌎", short: "N.Am.",   total: 23 },
  "South America": { emoji: "🌎", short: "S.Am.",   total: 12 },
  "Africa":        { emoji: "🌍", short: "Africa",  total: 54 },
  "Oceania":       { emoji: "🌏", short: "Oceania", total: 14 },
};
