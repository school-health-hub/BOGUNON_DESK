import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {createServer} from 'vite';

test('production Vite wiring sends both weather and meal widgets to the Electron adapters and notice',async()=>{
  // Given: the actual production configuration, without binding a port.
  const server=await createServer({configFile:'electron-p0/vite.config.ts',server:{middlewareMode:true,watch:null},optimizeDeps:{noDiscovery:true,include:[]}});
  try{
    for(const [widget,context,adapter] of [
      ['WeatherWidget','weather/WeatherDataContext','weather'],
      ['MealWidget','meal/MealDataContext','meal'],
    ]){
      const importer=resolve(`src/widgets/${widget}.tsx`);
      // When: Vite resolves the real widget's imports.
      const notice=await server.environments.client.pluginContainer.resolveId('../workspace-data/WorkspaceDataNotice',importer);
      const data=await server.environments.client.pluginContainer.resolveId(`../${context}`,importer);
      // Then: tests exercise the same notice and data adapters as production.
      assert.equal(notice?.id.replaceAll('\\','/'),resolve('electron-p0/renderer/local-tasks/LocalNotices.tsx').replaceAll('\\','/'));
      assert.equal(data?.id.replaceAll('\\','/'),resolve(`electron-p0/renderer/adapters/${adapter}.ts`).replaceAll('\\','/'));
    }
  }finally{await server.close();}
});
