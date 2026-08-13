export interface HeaderScrollState {
  solid: boolean;
  hidden: boolean;
}

export const HEADER_SOLID_THRESHOLD = 60;

export function computeHeaderState(
  previousScrollY: number,
  currentScrollY: number
): HeaderScrollState {
  if (currentScrollY <= HEADER_SOLID_THRESHOLD) {
    return { solid: false, hidden: false };
  }

  return {
    solid: true,
    hidden: currentScrollY > previousScrollY,
  };
}
