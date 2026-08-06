"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Hook that observes when an element enters the viewport
 * and adds an animation class. Returns a ref to attach to the element.
 */
export function useSectionObserver(
  threshold = 0.15,
  rootMargin = "0px 0px -40px 0px"
) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el); // Only animate once
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return { ref, isVisible };
}

/**
 * Hook for scroll progress (0-1) based on page scroll
 */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setProgress(scrollHeight > 0 ? scrollTop / scrollHeight : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return progress;
}

/**
 * Hook to track if this is the user's first visit
 */
let _firstVisitChecked = false;
let _isFirstVisit = false;

function checkFirstVisit() {
  if (_firstVisitChecked) return _isFirstVisit;
  _firstVisitChecked = true;
  if (typeof window === "undefined") return false;
  const visited = localStorage.getItem("manhwa-studio-visited");
  if (!visited) {
    _isFirstVisit = true;
    localStorage.setItem("manhwa-studio-visited", "true");
  }
  return _isFirstVisit;
}

export function useFirstVisit() {
  const [isFirst, setIsFirst] = useState(() => checkFirstVisit());

  const dismiss = useCallback(() => setIsFirst(false), []);

  return { isFirst, dismiss };
}
