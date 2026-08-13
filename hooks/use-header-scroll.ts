"use client";

import { useEffect, useState } from "react";
import { computeHeaderState, type HeaderScrollState } from "@/lib/scroll";

const INITIAL_STATE: HeaderScrollState = { solid: false, hidden: false };

export function useHeaderScroll(): HeaderScrollState {
  const [state, setState] = useState<HeaderScrollState>(INITIAL_STATE);

  useEffect(() => {
    let previousScrollY = window.scrollY;

    function handleScroll() {
      const currentScrollY = window.scrollY;
      setState(computeHeaderState(previousScrollY, currentScrollY));
      previousScrollY = currentScrollY;
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return state;
}
