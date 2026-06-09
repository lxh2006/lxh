// src/components/ErudaLoader.js
'use client';

import { useEffect } from 'react';

export default function ErudaLoader() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (document.getElementById('eruda-script')) return;

    const script = document.createElement('script');
    script.id = 'eruda-script';
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    script.onload = () => {
      if (window.eruda) window.eruda.init();
    };
    document.body.appendChild(script);
  }, []);

  return null;
}