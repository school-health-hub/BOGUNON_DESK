import {access,mkdtemp,readFile,rm,symlink,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {describe,expect,it} from 'vitest'
import {NewsletterAiAssetStorage} from './newsletter-ai-asset-storage.js'

const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')
const SHA='431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460'
const baseline={projectId:'project-one',projectRevision:1,projectHash:'a'.repeat(64),designRevision:1,designHash:'b'.repeat(64)} as const

describe('NewsletterAiAssetStorage',()=>{
  it('restores project-scoped candidate bytes by SHA after a new store instance opens',async()=>{
    // Given
    const root=await mkdtemp(join(tmpdir(),'newsletter-ai-assets-'))
    const first=new NewsletterAiAssetStorage(root)

    // When
    await first.save({projectId:'project-one',sha256:SHA,mediaType:'image/png',bytesBase64:PNG.toString('base64')},baseline)
    const restored=await new NewsletterAiAssetStorage(root).load({projectId:'project-one',sha256:SHA,baseline})

    // Then
    expect(Buffer.from(restored,'base64')).toEqual(PNG)
    expect(await readFile(join(root,'project-one',`${SHA}.png`))).toEqual(PNG)
  })

  it('fails closed when the requested project does not own the bytes',async()=>{
    // Given
    const root=await mkdtemp(join(tmpdir(),'newsletter-ai-assets-'))
    await new NewsletterAiAssetStorage(root).save({projectId:'project-one',sha256:SHA,mediaType:'image/png',bytesBase64:PNG.toString('base64')},baseline)

    // When / Then
    await expect(new NewsletterAiAssetStorage(root).load({projectId:'project-two',sha256:SHA,baseline})).rejects.toThrow('authority')
  })

  it('does not publish the first item when a later batch item fails validation',async()=>{
    // Given
    const root=await mkdtemp(join(tmpdir(),'newsletter-ai-assets-'))
    const store=new NewsletterAiAssetStorage(root)

    // When
    const failed=store.saveBatch([
      {projectId:'project-one',sha256:SHA,mediaType:'image/png',bytesBase64:PNG.toString('base64')},
      {projectId:'project-one',sha256:'d'.repeat(64),mediaType:'image/png',bytesBase64:PNG.toString('base64')},
    ],baseline)

    // Then
    await expect(failed).rejects.toThrow('hash mismatch')
    await expect(readFile(join(root,'project-one',`${SHA}.png`))).rejects.toMatchObject({code:'ENOENT'})
  })

  it('rejects aggregate overflow before creating the storage root',async()=>{
    // Given
    const parent=await mkdtemp(join(tmpdir(),'newsletter-ai-assets-')),root=join(parent,'missing')
    const chunk='A'.repeat(Math.ceil((11*1024*1024)/3)*4)
    // When / Then
    let message=''
    try{await new NewsletterAiAssetStorage(root).saveBatch([1,2,3].map(()=>({projectId:'project-one',sha256:SHA,mediaType:'image/png' as const,bytesBase64:chunk})),baseline)}catch(error){if(error instanceof Error)message=error.message;else throw error}
    expect(message).toContain('aggregate limit')
    await expect(access(root)).rejects.toMatchObject({code:'ENOENT'})
  })

  it('rejects a project junction before reading or writing outside the root',async()=>{
    // Given
    const root=await mkdtemp(join(tmpdir(),'newsletter-ai-assets-')),outside=await mkdtemp(join(tmpdir(),'newsletter-ai-outside-'))
    await symlink(outside,join(root,'project-one'),process.platform==='win32'?'junction':'dir')
    // When / Then
    await expect(new NewsletterAiAssetStorage(root).save({projectId:'project-one',sha256:SHA,mediaType:'image/png',bytesBase64:PNG.toString('base64')},baseline)).rejects.toThrow('Unsafe')
  })

  it('restores a registered project asset after an unrelated design revision',async()=>{
    // Given
    const root=await mkdtemp(join(tmpdir(),'newsletter-ai-assets-')),store=new NewsletterAiAssetStorage(root)
    await store.save({projectId:'project-one',sha256:SHA,mediaType:'image/png',bytesBase64:PNG.toString('base64')},baseline)
    // When / Then
    await expect(store.load({projectId:'project-one',sha256:SHA,baseline:{...baseline,designRevision:2}})).resolves.toBe(PNG.toString('base64'))
  })

  it('rejects a file symlink before reading bytes outside the project',async()=>{
    // Given
    const root=await mkdtemp(join(tmpdir(),'newsletter-ai-assets-')),store=new NewsletterAiAssetStorage(root)
    await store.save({projectId:'project-one',sha256:SHA,mediaType:'image/png',bytesBase64:PNG.toString('base64')},baseline)
    const outside=join(await mkdtemp(join(tmpdir(),'newsletter-ai-outside-')),'outside.png')
    await writeFile(outside,PNG)
    const stored=join(root,'project-one',`${SHA}.png`)
    await rm(stored)
    await symlink(outside,stored,'file')
    // When / Then
    await expect(store.load({projectId:'project-one',sha256:SHA,baseline})).rejects.toThrow('Unsafe')
  })
})
