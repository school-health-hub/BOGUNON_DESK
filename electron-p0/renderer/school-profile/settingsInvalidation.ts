export interface SchoolSettingsInvalidationBridge {
  readonly subscribe:(listener:()=>void)=>()=>void;
}
declare global { interface Window { electronSchoolSettings?:SchoolSettingsInvalidationBridge; } }

export function subscribeSchoolSettingsInvalidation(listener:()=>void):()=>void {
  return window.electronSchoolSettings?.subscribe(listener)??(()=>undefined);
}
