export type PickCountry = { iso2: string; name: string; continent: "Asia"|"Europe"|"North America"|"South America"|"Africa"|"Oceania" };

export const PICK_COUNTRIES: PickCountry[] = [
  { continent: "Asia", iso2: "CN", name: "China" },
  { continent: "Asia", iso2: "JP", name: "Japan" },
  { continent: "Asia", iso2: "KR", name: "South Korea" },
  { continent: "Asia", iso2: "SG", name: "Singapore" },
  { continent: "Asia", iso2: "TH", name: "Thailand" },
  { continent: "Asia", iso2: "VN", name: "Vietnam" },

  { continent: "Europe", iso2: "GB", name: "United Kingdom" },
  { continent: "Europe", iso2: "FR", name: "France" },
  { continent: "Europe", iso2: "DE", name: "Germany" },
  { continent: "Europe", iso2: "IT", name: "Italy" },
  { continent: "Europe", iso2: "ES", name: "Spain" },

  { continent: "North America", iso2: "US", name: "United States" },
  { continent: "North America", iso2: "CA", name: "Canada" },
  { continent: "North America", iso2: "MX", name: "Mexico" },

  { continent: "Oceania", iso2: "AU", name: "Australia" },
  { continent: "Oceania", iso2: "NZ", name: "New Zealand" },

  { continent: "Africa", iso2: "ZA", name: "South Africa" },
  { continent: "Africa", iso2: "EG", name: "Egypt" },
  { continent: "Africa", iso2: "MA", name: "Morocco" },

  { continent: "South America", iso2: "BR", name: "Brazil" },
  { continent: "South America", iso2: "AR", name: "Argentina" },
  { continent: "South America", iso2: "CL", name: "Chile" }
];
