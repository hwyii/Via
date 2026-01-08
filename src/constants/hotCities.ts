import type { Candidate } from "../types";

// 这里精选了一些热门城市，数据写死，点击秒加
export const HOT_CITIES: Candidate[] = [
  { displayName: "Beijing, China", lat: 39.904, lon: 116.407, countryIso2: "CN", admin1: "Beijing" },
  { displayName: "Shenzhen, China", lat: 22.5455, lon: 114.068, countryIso2: "CN", admin1: "Guangdong" },
  { displayName: "Hong Kong, China", lat: 22.319, lon: 114.169, countryIso2: "CN", admin1: "Hong Kong" },
  { displayName: "Tokyo, Japan", lat: 35.689, lon: 139.691, countryIso2: "JP", admin1: "Tokyo" },
  { displayName: "New York, USA", lat: 40.712, lon: -74.006, countryIso2: "US", admin1: "New York" },
  { displayName: "Los Angeles, USA", lat: 34.052, lon: -118.243, countryIso2: "US", admin1: "California" },
  { displayName: "London, UK", lat: 51.507, lon: -0.127, countryIso2: "GB", admin1: "England" },
  { displayName: "Paris, France", lat: 48.856, lon: 2.352, countryIso2: "FR", admin1: "Île-de-France" },
  { displayName: "Singapore", lat: 1.352, lon: 103.819, countryIso2: "SG", admin1: "Singapore" },
  { displayName: "Sydney, Australia", lat: -33.868, lon: 151.209, countryIso2: "AU", admin1: "New South Wales" },
];