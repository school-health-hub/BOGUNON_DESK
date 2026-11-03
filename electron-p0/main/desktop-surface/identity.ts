import {z} from 'zod';

// Internal model values, not a new wire protocol. S-3 uses nonzero u64 attempt IDs.
const U64_MAX=18446744073709551615n;
const positive=z.bigint().positive().max(U64_MAX);
const generation=positive.brand('SurfaceGeneration');
const nonce=positive.brand('AttemptNonce');
const sequence=z.bigint().positive().max(U64_MAX-1n).brand('SurfaceSequence');
export const resourceIdentity=positive.brand('ResourceIdentity');
export const processIdentity=z.strictObject({
  pid:z.number().int().positive().max(4294967295),creationTime:positive,
  imageSha256:z.string().regex(/^[a-f0-9]{64}$/),sessionId:z.bigint().nonnegative().max(U64_MAX),
}).readonly();
const attempt=z.strictObject({generation,nonce}).readonly();
export const explorerIdentity=z.strictObject({generation,process:processIdentity}).readonly();
const context={attempt,owner:processIdentity,explorer:explorerIdentity};
export const bindingSchema=z.strictObject(context).refine(v=>v.owner.sessionId===v.explorer.process.sessionId).readonly();
const envelope={...context,sequence};
export const mainRequest=z.discriminatedUnion('kind',[
  z.strictObject({...envelope,kind:z.literal('Attach')}),
  z.strictObject({...envelope,kind:z.literal('Cancel')}),
  z.strictObject({...envelope,kind:z.literal('ReturnToNormal')}),
]);
export const resources=['Host','Window','Environment','Controller','WebView','ComReference','EventToken','BackendRegistration'] as const;
const resource=z.enum(resources);
export const runtimeIdentity=z.strictObject({
  environment:resourceIdentity,browser:processIdentity,
  udf:z.strictObject({volume:positive,file:positive}).readonly(),
}).readonly();
export const browserExit=z.strictObject({environment:resourceIdentity,browser:processIdentity,normalExit:z.boolean()}).readonly();
export const hostObservation=z.discriminatedUnion('kind',[
  z.strictObject({...envelope,kind:z.literal('HostStarted')}),
  z.strictObject({...envelope,kind:z.literal('ResourceAcquired'),resource,identity:resourceIdentity}),
  z.strictObject({...envelope,kind:z.literal('ResourceReleased'),resource,identity:resourceIdentity}),
  z.strictObject({...envelope,kind:z.literal('ResourceUnknown'),resource}),
  z.strictObject({...envelope,kind:z.literal('RuntimeBound'),runtime:runtimeIdentity}),
  z.strictObject({...envelope,kind:z.literal('BrowserExited'),exit:browserExit}),
  z.strictObject({...envelope,kind:z.literal('CleanupStarted')}),
  z.strictObject({...envelope,kind:z.literal('CleanupFinished')}),
  z.strictObject({...envelope,kind:z.literal('HostFailed')}),
  z.strictObject({...envelope,kind:z.literal('HostExited')}),
]);
export type Binding=z.infer<typeof bindingSchema>;
export type ExplorerIdentity=z.infer<typeof explorerIdentity>;
export type ProcessIdentity=z.infer<typeof processIdentity>;
export type MainRequest=z.infer<typeof mainRequest>;
export type HostObservation=z.infer<typeof hostObservation>;
export type Resource=typeof resources[number];
export type ResourceIdentity=z.infer<typeof resourceIdentity>;
export type RuntimeIdentity=z.infer<typeof runtimeIdentity>;
export type BrowserExit=z.infer<typeof browserExit>;
export function sameProcess(a:ProcessIdentity,b:ProcessIdentity):boolean {
  return a.pid===b.pid&&a.creationTime===b.creationTime&&a.imageSha256===b.imageSha256&&a.sessionId===b.sessionId;
}
export function sameExplorer(a:ExplorerIdentity,b:ExplorerIdentity):boolean {
  return a.generation===b.generation&&sameProcess(a.process,b.process);
}
