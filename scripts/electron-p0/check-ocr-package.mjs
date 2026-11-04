import {verifyOcrRuntime} from '../../build/electron-p0-app/main/purchase-image-ocr.js';
await verifyOcrRuntime('build/purchase-ocr');
console.log('Offline Korean/English OCR runtime integrity PASS');
