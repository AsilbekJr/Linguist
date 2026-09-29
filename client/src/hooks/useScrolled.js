import { useEffect, useState } from 'react';

/** Sahifa aylantirilganmi — yopishqoq sarlavhaga soya/chegara berish uchun */
export const useScrolled = (threshold = 4) => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
};

export default useScrolled;
