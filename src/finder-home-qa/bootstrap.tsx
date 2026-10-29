import React from 'react';
import ReactDOM from 'react-dom/client';
import { FinderHomeQaApp } from './FinderHomeQaApp';
import '../styles/base.css';
import '../styles/components.css';
import '../styles/desktop-workspace.css';
import './finder-home-qa.css';

const root = document.getElementById('root');
if (root === null) throw new Error('Finder QA 화면을 시작하지 못했습니다.');
ReactDOM.createRoot(root).render(<React.StrictMode><FinderHomeQaApp /></React.StrictMode>);
