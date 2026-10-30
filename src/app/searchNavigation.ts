import type { SearchHit } from "../types";

type SearchHitHandler = (hit: SearchHit) => void;

let handler: SearchHitHandler | null = null;

export function setSearchHitHandler(next: SearchHitHandler | null): void {
  handler = next;
}

export function openSearchHit(hit: SearchHit): void {
  handler?.(hit);
}
