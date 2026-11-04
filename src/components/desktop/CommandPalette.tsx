import {CommandPaletteView,type CommandPaletteViewProps} from "./CommandPaletteView";
import {useBogunonSearch} from "../../workspace-search/useBogunonSearch";
import type {AuthStatus} from "../../auth/types";
type Props=Omit<CommandPaletteViewProps,'useSearchState'|'showServerSearch'|'commands'|'shortcutsEnabled'|'embedded'|'onError'>&{authStatus:AuthStatus;userId:string|null};
export function CommandPalette({authStatus,userId,...props}:Props){
 function useSearchState(query:string,isOpen:boolean){return useBogunonSearch({authStatus,userId,query,isOpen});}
 return <CommandPaletteView {...props} useSearchState={useSearchState}/>;
}
