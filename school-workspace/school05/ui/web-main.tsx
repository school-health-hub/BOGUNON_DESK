import{useState}from'react';import{createRoot}from'react-dom/client';import{ProductWorkspace}from'./ProductWorkspace.js';import{webProductApi}from'./web-api.js';
function App(){const[api]=useState(webProductApi),[open,setOpen]=useState(true);return open?<ProductWorkspace api={api} client="web" onClose={()=>setOpen(false)}/>:<main><h1>우리 보건실</h1><button style={{minHeight:48}} onClick={()=>setOpen(true)}>학교 공유 공간 열기</button></main>;}
createRoot(document.getElementById('root')!).render(<App/>);
