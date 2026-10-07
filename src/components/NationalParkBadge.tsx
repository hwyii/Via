import type { NationalPark } from "../constants/nationalParks";
import { getParkBadgeUrl } from "../lib/parkBadge";

type NationalParkBadgeProps = {
  park: NationalPark;
  visited?: boolean;
  compact?: boolean;
};

export function NationalParkBadge({ park, visited = true, compact = false }: NationalParkBadgeProps) {
  return (
    <span className={`park-badge${visited ? " is-visited" : ""}${compact ? " is-compact" : ""}`}>
      <img src={getParkBadgeUrl(park.name)} alt="" loading={compact ? "eager" : "lazy"} />
    </span>
  );
}
