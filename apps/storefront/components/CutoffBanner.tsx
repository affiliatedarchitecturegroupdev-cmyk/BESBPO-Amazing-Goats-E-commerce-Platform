'use client';
import { useEffect, useState } from 'react';

/** Shows time left to the weekly cut-off. TODO(T-017): load the cycle from the commerce service. */
export function CutoffBanner({ cutoffAt }: { cutoffAt: string }) {
  const [left, setLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const ms = new Date(cutoffAt).getTime() - Date.now();
      setLeft(ms <= 0 ? 'Closed for this cycle' : `${Math.floor(ms / 3600000)} h ${Math.floor((ms % 3600000) / 60000)} min left to order`);
    };
    tick(); const id = setInterval(tick, 60000); return () => clearInterval(id);
  }, [cutoffAt]);
  return <div className="card" role="status">Order by Sunday 17:00 for Wednesday delivery. {left}</div>;
}
