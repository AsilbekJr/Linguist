import { useCallback, useEffect, useState } from 'react';
import { listEntries, DIARY_EVENT } from '../lib/voiceDiary';

/** Kundalik yozuvlari — boshqa sahifada yozilsa ham shu yerda yangilanadi */
export const useDiaryEntries = () => {
  const [entries, setEntries] = useState(null);
  const reload = useCallback(() => {
    listEntries().then(setEntries);
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener(DIARY_EVENT, reload);
    return () => window.removeEventListener(DIARY_EVENT, reload);
  }, [reload]);
  return { entries, loading: entries === null, reload };
};

export default useDiaryEntries;
