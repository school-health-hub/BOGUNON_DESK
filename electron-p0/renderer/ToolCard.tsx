import {useId} from 'react';
import {ArrowUpRight,Wrench,type LucideIcon} from 'lucide-react';
export function ToolCard({label,description,onClick,icon:Icon=Wrench}:{label:string;description:string;onClick:()=>void;icon?:LucideIcon}){
 const descriptionId=useId();
 return <button type="button" className="p0-tool-card" aria-label={label} aria-describedby={descriptionId} onClick={onClick}><Icon size={22} aria-hidden="true"/><span><strong>{label}</strong><small id={descriptionId}>{description}</small></span><ArrowUpRight size={20} aria-hidden="true"/></button>;
}
