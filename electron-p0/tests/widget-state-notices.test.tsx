// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import {WeatherWidget} from '../../src/widgets/WeatherWidget'
import {MealWidget} from '../../src/widgets/MealWidget'
import {useWeatherData} from '../renderer/adapters/weather'
import {useMealData} from '../renderer/adapters/meal'
import {WorkspaceDataNotice} from '../renderer/local-tasks/LocalNotices'
import {LocalWorkspaceProvider,useLocalWorkspace} from '../renderer/local-tasks/LocalWorkspaceProvider'
import {WidgetSessionProvider} from '../../src/dashboard/WidgetSessionContext'
import {emptyLocalTasks} from '../local-tasks'
import type {WeatherState} from '../../src/weather/types'
import type {MealState} from '../../src/meal/types'

vi.mock('../../src/workspace-data/WorkspaceDataNotice',async()=>await import('../renderer/local-tasks/LocalNotices'))
vi.mock('../../src/weather/WeatherDataContext',async()=>await import('../renderer/adapters/weather'))
vi.mock('../../src/meal/MealDataContext',async()=>await import('../renderer/adapters/meal'))
vi.mock('../renderer/adapters/weather',async importOriginal=>{
 const original=await importOriginal<typeof import('../renderer/adapters/weather')>()
 return {...original,useWeatherData:vi.fn(original.useWeatherData)}
})
vi.mock('../renderer/adapters/meal',async importOriginal=>{
 const original=await importOriginal<typeof import('../renderer/adapters/meal')>()
 return {...original,useMealData:vi.fn(original.useMealData)}
})
afterEach(()=>{cleanup();vi.mocked(useWeatherData).mockReset();vi.mocked(useMealData).mockReset();vi.unstubAllGlobals()})

it('shows a disconnected notice in both real widgets when the unchanged adapters return signedOut',async()=>{
 // Given: the production adapters, without a fabricated ready state.
 const weather=await vi.importActual<typeof import('../renderer/adapters/weather')>('../renderer/adapters/weather')
 const meal=await vi.importActual<typeof import('../renderer/adapters/meal')>('../renderer/adapters/meal')
 vi.mocked(useWeatherData).mockReturnValue(weather.useWeatherData())
 vi.mocked(useMealData).mockReturnValue(meal.useMealData())
 // When: both widgets use the Electron replacement notice.
 render(<><WeatherWidget/><MealWidget/></>)
 // Then: connection state is visible, without a local-storage error.
 expect(screen.getAllByText('날씨·급식이 연결되어 있지 않습니다.')).toHaveLength(2)
 expect(screen.queryByText(/로컬 업무를 불러오지 못했습니다/)).toBeNull()
 expect(document.querySelectorAll('.is-signedOut')).toHaveLength(2)
})

const weatherCases:readonly {readonly state:WeatherState;readonly text:string}[]=[
 {state:{status:'loading'},text:'날씨를 불러오는 중입니다.'},
 {state:{status:'error',code:'SYNTHETIC',message:'합성 오류'},text:'날씨 정보를 불러오지 못했습니다.'},
 {state:{status:'ready',schoolName:'합성 학교',observedAt:'2026-11-04',temperatureC:10,apparentTemperatureC:9,weatherCode:0,conditionLabel:'맑음',highC:12,lowC:4},text:'맑음'},
]
it.each(weatherCases)('shows weather-specific content when weather is $state.status',({state,text})=>{
 // Given / When: one weather state reaches the actual widget.
 vi.mocked(useWeatherData).mockReturnValue({state,refresh:()=>{}})
 render(<WeatherWidget/>)
 // Then: the correct feature renders; no unrelated task warning appears.
 expect(screen.getByText(text)).toBeTruthy()
 expect(screen.queryByText(/로컬 업무를 불러오지 못했습니다/)).toBeNull()
})
const mealCases:readonly {readonly state:MealState;readonly text:string}[]=[
 {state:{status:'loading'},text:'급식 정보를 불러오는 중입니다.'},
 {state:{status:'error',code:'SYNTHETIC',message:'합성 오류'},text:'급식 정보를 불러오지 못했습니다.'},
 {state:{status:'ready',date:'2026-11-04',schoolName:'합성 학교',menu:['합성 메뉴'],calories:null},text:'합성 메뉴'},
 {state:{status:'empty',date:'2026-11-04',schoolName:'합성 학교'},text:'오늘은 급식 정보가 없습니다.'},
]
it.each(mealCases)('shows meal-specific content when meals are $state.status',({state,text})=>{
 // Given / When: one meal state reaches the actual widget.
 vi.mocked(useMealData).mockReturnValue({state,refresh:()=>{}})
 render(<MealWidget/>)
 // Then: the correct feature renders; no unrelated task warning appears.
 expect(screen.getByText(text)).toBeTruthy()
 expect(screen.queryByText(/로컬 업무를 불러오지 못했습니다/)).toBeNull()
})
it.each([
 {status:'loading' as const,text:'로컬 업무를 불러오는 중입니다.'},
 {status:'error' as const,text:'로컬 업무를 불러오지 못했습니다. 업무 도구에서 다시 불러와 주세요. 기존 파일은 유지됩니다.'},
])('keeps the task notice when local tasks are $status',({status,text})=>{
 // Given / When: a real local-task notice state.
 render(<WorkspaceDataNotice state={{status}}/>)
 // Then: task feedback remains visible and correctly classified.
 expect(screen.getByRole('status').textContent).toBe(text)
 expect(document.querySelector(`.is-${status}`)).toBeTruthy()
})

function EmptyTasksProbe(){
 const {state,document}=useLocalWorkspace()
 return state.status==='ready'?<p>정상 업무 {document?.tasks.length}개</p>:<WorkspaceDataNotice state={state}/>
}
it('shows an empty task list as ready without writing when a new profile has no saved tasks',async()=>{
 // Given: the missing-file contract returns the real empty document.
 const save=vi.fn()
 vi.stubGlobal('electronWork',{tasks:{load:async()=>({ok:true,data:{document:emptyLocalTasks(),recovered:false}}),save}})
 // When: the actual provider loads it.
 render(<WidgetSessionProvider><LocalWorkspaceProvider><EmptyTasksProbe/></LocalWorkspaceProvider></WidgetSessionProvider>)
 // Then: empty is ready, not an error or an automatic write.
 expect(await screen.findByText('정상 업무 0개')).toBeTruthy()
 expect(screen.queryByText(/로컬 업무를 불러오지 못했습니다/)).toBeNull()
 expect(save).not.toHaveBeenCalled()
})
