import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';
import { setupInstall } from './install.tsx';

setupInstall();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
