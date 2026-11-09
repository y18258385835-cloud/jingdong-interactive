import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Website from './Website';
import WebsiteAdmin from './WebsiteAdmin';
import './website.css';

const path = window.location.pathname.replace(/\/$/, '') || '/';
createRoot(document.getElementById('root')!).render(
  <StrictMode>{path === '/admin' || path === '/website-admin' ? <WebsiteAdmin /> : <Website />}</StrictMode>,
);
