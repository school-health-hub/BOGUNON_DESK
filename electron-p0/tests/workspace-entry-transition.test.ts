import { describe, expect, it } from 'vitest';
import { WorkspaceEntryTransition } from '../renderer/workspaceEntryTransition';

describe('Workspace entry transitions',()=>{
  it('keeps Finance open and clears destination when dirty leave is cancelled',()=>{
    const transition=new WorkspaceEntryTransition<string>();
    transition.request('newsletter','finance');
    transition.resolve('finance',false);
    expect(transition.takeWhenClosed('finance')).toBeNull();
    expect(transition.pending).toBe(false);
  });
  it('does not route when Newsletter refuses a busy close',()=>{
    const transition=new WorkspaceEntryTransition<string>();
    transition.request('finance','newsletter');
    transition.resolve('newsletter',false);
    expect(transition.takeWhenClosed(null)).toBeNull();
  });
  it('waits for accepted owner closure before routing once',()=>{
    const transition=new WorkspaceEntryTransition<string>();
    transition.request('newsletter','finance');
    transition.resolve('finance',true);
    expect(transition.takeWhenClosed('finance')).toBeNull();
    expect(transition.takeWhenClosed(null)).toBe('newsletter');
    expect(transition.takeWhenClosed(null)).toBeNull();
  });
  it('keeps the first pending request and requests no duplicate owner close',()=>{
    const transition=new WorkspaceEntryTransition<string>();
    expect(transition.request('newsletter','finance')).toBe(true);
    expect(transition.request('official','finance')).toBe(false);
    transition.resolve('finance',true);
    expect(transition.takeWhenClosed(null)).toBe('newsletter');
  });
  it('ignores another owner resolution',()=>{
    const transition=new WorkspaceEntryTransition<string>();
    transition.request('newsletter','finance');
    transition.resolve('newsletter',false);
    transition.resolve('finance',true);
    expect(transition.takeWhenClosed(null)).toBe('newsletter');
  });
});
