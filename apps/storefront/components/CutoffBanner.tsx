'use client';
import { useEffect, useState } from 'react';

/**
 * Shows time left to the weekly cut-off. The cut-off string comes from the
 * commerce cycle service; the banner copy is the standing rule until it loads.
 */
export function CutoffBanner({ cutoffAt, message = 'Order by Sunday 17:00 for Wednesday delivery.' }: { cutoffAt?: string; message?: string }) {
  const [left, setLeft] = useState('');
  useEffect(() => {
    if (!cutoffAt) { setLeft(''); return; }
    const tick = () => {
      const ms = new Date(cutoffAt).getTime() - Date.now();
      setLeft(ms <= 0 ? 'Closed for this cycle' : `${Math.floor(ms / 3600000)} h ${Math.floor((ms % 3600000) / 60000)} min left to order`);
    };
    tick(); const id = setInterval(tick, 60000); return () => clearInterval(id);
  }, [cutoffAt]);
  return <div className="card ban" role="status">{message}{left ? ` ${left}` : ''}</div>;
}
