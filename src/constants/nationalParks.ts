export type NationalPark = {
  name: string;
  state: string;
  icon: string;
  matchString?: string; // Override default "{name} national park" matching
};

export const NATIONAL_PARKS: NationalPark[] = [
  { name: "Acadia",                        state: "Maine",              icon: "🌊" },
  { name: "National Park of American Samoa", state: "American Samoa",   icon: "🌴", matchString: "national park of american samoa" },
  { name: "Arches",                        state: "Utah",               icon: "🪨" },
  { name: "Badlands",                      state: "South Dakota",       icon: "🏜️" },
  { name: "Big Bend",                      state: "Texas",              icon: "🏜️" },
  { name: "Biscayne",                      state: "Florida",            icon: "🐠" },
  { name: "Black Canyon of the Gunnison",  state: "Colorado",           icon: "🏞️" },
  { name: "Bryce Canyon",                  state: "Utah",               icon: "🪨" },
  { name: "Canyonlands",                   state: "Utah",               icon: "🏞️" },
  { name: "Capitol Reef",                  state: "Utah",               icon: "🪨" },
  { name: "Carlsbad Caverns",              state: "New Mexico",         icon: "🦇" },
  { name: "Channel Islands",               state: "California",         icon: "🏝️" },
  { name: "Congaree",                      state: "South Carolina",     icon: "🌿" },
  { name: "Crater Lake",                   state: "Oregon",             icon: "🌋" },
  { name: "Cuyahoga Valley",               state: "Ohio",               icon: "🌿" },
  { name: "Death Valley",                  state: "California",         icon: "☀️" },
  { name: "Denali",                        state: "Alaska",             icon: "🏔️" },
  { name: "Dry Tortugas",                  state: "Florida",            icon: "🏝️" },
  { name: "Everglades",                    state: "Florida",            icon: "🐊" },
  { name: "Gates of the Arctic",           state: "Alaska",             icon: "🌨️" },
  { name: "Gateway Arch",                  state: "Missouri",           icon: "🌉" },
  { name: "Glacier",                       state: "Montana",            icon: "🧊" },
  { name: "Glacier Bay",                   state: "Alaska",             icon: "🧊" },
  { name: "Grand Canyon",                  state: "Arizona",            icon: "🏞️" },
  { name: "Grand Teton",                   state: "Wyoming",            icon: "🏔️" },
  { name: "Great Basin",                   state: "Nevada",             icon: "🌲" },
  { name: "Great Sand Dunes",              state: "Colorado",           icon: "🏜️" },
  { name: "Great Smoky Mountains",         state: "Tennessee",          icon: "🌫️" },
  { name: "Guadalupe Mountains",           state: "Texas",              icon: "⛰️" },
  { name: "Haleakalā",                     state: "Hawaii",             icon: "🌋" },
  { name: "Hawaiʻi Volcanoes",             state: "Hawaii",             icon: "🌋" },
  { name: "Hot Springs",                   state: "Arkansas",           icon: "♨️" },
  { name: "Indiana Dunes",                 state: "Indiana",            icon: "🏖️" },
  { name: "Isle Royale",                   state: "Michigan",           icon: "🦌" },
  { name: "Joshua Tree",                   state: "California",         icon: "🌵" },
  { name: "Katmai",                        state: "Alaska",             icon: "🐻" },
  { name: "Kenai Fjords",                  state: "Alaska",             icon: "🌊" },
  { name: "Kings Canyon",                  state: "California",         icon: "🌲" },
  { name: "Kobuk Valley",                  state: "Alaska",             icon: "🏔️" },
  { name: "Lake Clark",                    state: "Alaska",             icon: "🏔️" },
  { name: "Lassen Volcanic",               state: "California",         icon: "🌋" },
  { name: "Mammoth Cave",                  state: "Kentucky",           icon: "🦇" },
  { name: "Mesa Verde",                    state: "Colorado",           icon: "🏛️" },
  { name: "Mount Rainier",                 state: "Washington",         icon: "🏔️" },
  { name: "New River Gorge",               state: "West Virginia",      icon: "🌉" },
  { name: "North Cascades",                state: "Washington",         icon: "🏔️" },
  { name: "Olympic",                       state: "Washington",         icon: "🌲" },
  { name: "Petrified Forest",              state: "Arizona",            icon: "🌈" },
  { name: "Pinnacles",                     state: "California",         icon: "🦅" },
  { name: "Redwood",                       state: "California",         icon: "🌲" },
  { name: "Rocky Mountain",                state: "Colorado",           icon: "🏔️" },
  { name: "Saguaro",                       state: "Arizona",            icon: "🌵" },
  { name: "Sequoia",                       state: "California",         icon: "🌲" },
  { name: "Shenandoah",                    state: "Virginia",           icon: "⛰️" },
  { name: "Theodore Roosevelt",            state: "North Dakota",       icon: "🦬" },
  { name: "Virgin Islands",                state: "U.S. Virgin Islands", icon: "🏝️" },
  { name: "Voyageurs",                     state: "Minnesota",          icon: "🛶" },
  { name: "White Sands",                   state: "New Mexico",         icon: "🏜️" },
  { name: "Wind Cave",                     state: "South Dakota",       icon: "🦇" },
  { name: "Wrangell-St. Elias",            state: "Alaska",             icon: "🏔️" },
  { name: "Yellowstone",                   state: "Wyoming",            icon: "♨️" },
  { name: "Yosemite",                      state: "California",         icon: "🏔️" },
  { name: "Zion",                          state: "Utah",               icon: "🏞️" },
];

function normalizeStr(s: string): string {
  return s.normalize("NFD")
    .replace(/\p{M}/gu, "")  // Remove combining marks (macrons, accents, etc.)
    .split("").filter(c => {
      const code = c.charCodeAt(0);
      // Remove modifier letters block (U+02B0-U+02FF) which includes Hawaiian okina (U+02BB)
      // and curly quotes / smart apostrophes (U+2018-U+201F)
      return !((code >= 0x02B0 && code <= 0x02FF) || (code >= 0x2018 && code <= 0x201F));
    }).join("")
    .toLowerCase();
}

export function parkMatchString(park: NationalPark): string {
  return park.matchString ?? (normalizeStr(park.name) + " national park");
}

export function normalizeTripName(name: string): string {
  return normalizeStr(name);
}

export const PARKS_BY_STATE: Record<string, NationalPark[]> = {};
NATIONAL_PARKS.forEach(park => {
  if (!PARKS_BY_STATE[park.state]) PARKS_BY_STATE[park.state] = [];
  PARKS_BY_STATE[park.state].push(park);
});
Object.values(PARKS_BY_STATE).forEach(parks =>
  parks.sort((a, b) => a.name.localeCompare(b.name))
);

export const PARK_COORDS: Record<string, [number, number]> = {
  "Acadia": [-68.2733, 44.3386],
  "National Park of American Samoa": [-170.68, -14.25],
  "Arches": [-109.5925, 38.7331],
  "Badlands": [-102.3397, 43.8554],
  "Big Bend": [-103.2425, 29.1275],
  "Biscayne": [-80.2106, 25.4824],
  "Black Canyon of the Gunnison": [-107.7416, 38.5754],
  "Bryce Canyon": [-112.1871, 37.593],
  "Canyonlands": [-109.9025, 38.3269],
  "Capitol Reef": [-111.1355, 38.367],
  "Carlsbad Caverns": [-104.5529, 32.1479],
  "Channel Islands": [-119.5383, 34.0069],
  "Congaree": [-80.7821, 33.7919],
  "Crater Lake": [-122.1685, 42.9446],
  "Cuyahoga Valley": [-81.5656, 41.2808],
  "Death Valley": [-116.8258, 36.5054],
  "Denali": [-151.1926, 63.1148],
  "Dry Tortugas": [-82.8732, 24.6285],
  "Everglades": [-80.8987, 25.2866],
  "Gates of the Arctic": [-153.2918, 67.8563],
  "Gateway Arch": [-90.1848, 38.6247],
  "Glacier": [-113.7187, 48.7596],
  "Glacier Bay": [-136.9002, 58.6658],
  "Grand Canyon": [-112.1401, 36.0544],
  "Grand Teton": [-110.6818, 43.7904],
  "Great Basin": [-114.2579, 38.9833],
  "Great Sand Dunes": [-105.5943, 37.7916],
  "Great Smoky Mountains": [-83.507, 35.6532],
  "Guadalupe Mountains": [-104.8725, 31.923],
  "Haleakalā": [-156.1596, 20.7204],
  "Hawaiʻi Volcanoes": [-155.2, 19.383],
  "Hot Springs": [-93.0631, 34.5217],
  "Indiana Dunes": [-87.0524, 41.6533],
  "Isle Royale": [-88.8278, 48.0114],
  "Joshua Tree": [-115.9009, 33.8734],
  "Katmai": [-155, 58.5],
  "Kenai Fjords": [-149.65, 59.9167],
  "Kings Canyon": [-118.587, 36.8879],
  "Kobuk Valley": [-159.2804, 67.3352],
  "Lake Clark": [-153.4167, 60.9667],
  "Lassen Volcanic": [-121.5179, 40.4977],
  "Mammoth Cave": [-86.1005, 37.1862],
  "Mesa Verde": [-108.4618, 37.2309],
  "Mount Rainier": [-121.7604, 46.8523],
  "New River Gorge": [-81.0525, 38.07],
  "North Cascades": [-121.2985, 48.7718],
  "Olympic": [-123.6044, 47.8021],
  "Petrified Forest": [-109.8068, 35.065],
  "Pinnacles": [-121.1465, 36.4906],
  "Redwood": [-124.0046, 41.2132],
  "Rocky Mountain": [-105.6836, 40.3428],
  "Saguaro": [-110.7579, 32.2967],
  "Sequoia": [-118.7005, 36.4864],
  "Shenandoah": [-78.4691, 38.491],
  "Theodore Roosevelt": [-103.4505, 46.9789],
  "Virgin Islands": [-64.7438, 18.3424],
  "Voyageurs": [-92.95, 48.5],
  "White Sands": [-106.1717, 32.7872],
  "Wind Cave": [-103.484, 43.5801],
  "Wrangell-St. Elias": [-142.9857, 61.7104],
  "Yellowstone": [-110.5885, 44.428],
  "Yosemite": [-119.5383, 37.8651],
  "Zion": [-112.9874, 37.2982],
};
