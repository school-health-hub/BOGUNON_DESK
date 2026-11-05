// @vitest-environment jsdom
import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {createRef} from 'react';
import {GridLayout} from '../renderer/adapters/GridLayout';
vi.mock('react-grid-layout',()=>({GridLayout:(props:any)=><div ref={props.innerRef} data-testid="grid" data-width={props.width} data-cancel={props.dragConfig.cancel}/> }));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('uses actual grid content width rather than padded/scrollbar parent width and follows resizing without rewriting layout',()=>{
 let report!:ResizeObserverCallback;const disconnect=vi.fn();vi.stubGlobal('ResizeObserver',class{constructor(callback:ResizeObserverCallback){report=callback;}observe(){}disconnect=disconnect;});
 const ref=createRef<HTMLDivElement>(),layout=[{i:'clock',x:0,y:0,w:2,h:2}],change=vi.fn();
 const view=render(<GridLayout width={964} children={<div key="clock"/>} layout={layout} innerRef={ref} onLayoutChange={change} dragConfig={{cancel:'button, input'}}/>);
 expect(ref.current).toBe(screen.getByTestId('grid'));
 act(()=>report([{target:ref.current!,contentRect:new DOMRectReadOnly(0,0,921,100),borderBoxSize:[],contentBoxSize:[],devicePixelContentBoxSize:[]}],{} as ResizeObserver));
 expect(screen.getByTestId('grid').dataset.width).toBe('921');
 view.rerender(<GridLayout width={884} children={<div key="clock"/>} layout={layout} innerRef={ref} onLayoutChange={change} dragConfig={{cancel:'button, input'}}/>);
 act(()=>report([{target:ref.current!,contentRect:new DOMRectReadOnly(0,0,841,100),borderBoxSize:[],contentBoxSize:[],devicePixelContentBoxSize:[]}],{} as ResizeObserver));
 expect(screen.getByTestId('grid').dataset.width).toBe('841');
 expect(screen.getByTestId('grid').dataset.cancel).toBe('button:not(.widget-frame__drag), input');expect(change).not.toHaveBeenCalled();
 act(()=>report([{target:ref.current!,contentRect:new DOMRectReadOnly(0,0,0,100),borderBoxSize:[],contentBoxSize:[],devicePixelContentBoxSize:[]}],{} as ResizeObserver));expect(screen.getByTestId('grid').dataset.width).toBe('841');
 view.unmount();expect(disconnect).toHaveBeenCalledOnce();expect(ref.current).toBeNull();
});
