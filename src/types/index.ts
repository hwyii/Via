// src/types/index.ts

export type TagId = string;
export type VisitType = "visited" | "transit";

export type Trip = {
  id: string;
  date: string; // YYYY-MM-DD
  tag: TagId;
  visitType?: VisitType;
  place: {
    name: string;
    lat: number;
    lon: number;
    countryIso2: string;
    admin1: string | null; // CN province, US state, or null
  };
};

export type Candidate = {
  displayName: string;
  lat: number;
  lon: number;
  countryIso2: string;
  admin1: string | null; // CN province, US state, or null
};
