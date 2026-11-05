import type {ButtonHTMLAttributes} from 'react';
export function Button({variant,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:string}){return <button {...props} className={variant?'secondary':props.className}/>;}
