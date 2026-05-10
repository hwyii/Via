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
