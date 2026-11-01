const {existsSync}=require('node:fs');
module.exports=async context=>{const name=context.electronPlatformName==='win32'?'purchase-excel-cli.exe':'purchase-excel-cli';if(!existsSync(`build/purchase-excel-cli/${name}`))throw Error('Build the fixed Purchase Excel CLI for the target platform before packaging');};
