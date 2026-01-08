// src/types/index.ts

export type TagId = string;

export type Trip = {
  id: string;
  date: string; // YYYY-MM-DD
  tag: TagId;
  place: {
    name: string;
    lat: number;
    lon: number;
    countryIso2: string;
    admin1: string | null; // CN省/US州缩写/其他null
  };
};

export type Candidate = {
  displayName: string;
  lat: number;
  lon: number;
  countryIso2: string;
  admin1: string | null; // CN 省 / US 州缩写 / 其他 null
};