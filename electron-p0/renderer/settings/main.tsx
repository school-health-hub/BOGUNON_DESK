import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/styles/base.css';
import '../../../src/styles/dashboard.css';
import '../../../src/styles/components.css';
import '../../../src/styles/release-ui.css';
import '../../../src/styles/desktop-workspace.css';
import '../p0.css';
import '../soft-rose.css';
import '../unified-settings.css';
import './settings.css';
import { SettingsApp } from './SettingsApp';

document.body.classList.add('electron-soft-rose');
const root=document.getElementById('root');
if(root)createRoot(root).render(<React.StrictMode><SettingsApp/></React.StrictMode>);
