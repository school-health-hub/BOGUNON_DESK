import type { PurchaseClipboardRequest } from '../../protocol';
export async function writePurchaseClipboard(content:PurchaseClipboardRequest):Promise<void> {
 const result=await window.electronWork.purchase.copy({text:content.text,html:content.html});
 if(!result.ok)throw Error(result.error.message);
}
