import {useId} from 'react';
import {ArrowUpRight} from 'lucide-react';
export function ToolCard({label,description,onClick}:{label:string;description:string;onClick:()=>void}){
 const descriptionId=useId();
 return <button type="button" className="p0-tool-card" aria-label={label} aria-describedby={descriptionId} onClick={onClick}><span><strong>{label}</strong><small id={descriptionId}>{description}</small></span><ArrowUpRight size={20} aria-hidden="true"/></button>;
}
