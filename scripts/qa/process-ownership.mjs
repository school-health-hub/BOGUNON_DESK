/** PID links alone can adopt old unrelated processes after Windows PID reuse. */
export function ownedProcessIdentities(rows,root){
 const byId=new Map(rows.map(r=>[Number(r.ProcessId),r])),owned=new Map();const first=byId.get(Number(root));
 if(!first||!Number.isFinite(Date.parse(first.CreationDate)))return [];
 owned.set(Number(root),first);
 for(let changed=true;changed;){changed=false;for(const row of rows){const parent=owned.get(Number(row.ParentProcessId));if(owned.has(Number(row.ProcessId))||!parent)continue;
  const born=Date.parse(row.CreationDate),parentBorn=Date.parse(parent.CreationDate);if(!Number.isFinite(born)||born<parentBorn)continue;
  owned.set(Number(row.ProcessId),row);changed=true;
 }}return [...owned.values()].map(({ProcessId,CreationDate})=>({ProcessId,CreationDate}));
}
