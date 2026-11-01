import {generateTrustedOutput} from './authority';
// This page is created only by main, has no preload/IPC, and is never navigable from the UI.
Object.defineProperty(window,'generateTrustedNewsletter',{value:generateTrustedOutput,writable:false,configurable:false});

import {validateStoredDocument} from './stored-document';
Object.defineProperty(window,'validateStoredNewsletter',{value:validateStoredDocument,writable:false,configurable:false});
