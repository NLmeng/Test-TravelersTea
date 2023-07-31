import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Button } from '../common'
import { setAppView } from '../../redux/reducers/viewSlice'
import { AppView } from '../../constants/enums'
import MugRating from './MugRating'

export function DayViewContent() {
  const activeDayNumber = useSelector((state) => state.view.activeDayNumber)
  const stagesByDay = useSelector((state) => state.stages.stages)
  const dispatch = useDispatch()

  const [stages, setStages] = useState([])

  useEffect(() => {
    setStages(stagesByDay[activeDayNumber - 1])
  }, [activeDayNumber, stagesByDay])

  const generateStage = useCallback((stageInfo, index) => {
    return (
      <div className='grid grid-cols-5 py-2' key={`stage-${index}`}>
        <div className='z-[5] w-10 text-center text-3xl md:w-20 md:text-5xl'>
          {stageInfo['emoji']}
        </div>
        <div className='col-span-4 box-border rounded-md border-2 border-slate-100 bg-slate-200/90 p-2 shadow-xl'>
          <p className='text-lg font-bold'>{stageInfo['stageLocation']}</p>
          <MugRating rating={stageInfo['stageRating']} />
          <p className='text-base font-normal'>{stageInfo['description']}</p>
        </div>
      </div>
    )
  }, [])

  const renderStages = useMemo(() => {
    const stagesContent = stages?.map((stageInfo, index) => {
      return generateStage(stageInfo, index)
    })

    return (
      <div className='h-full overflow-y-auto p-4 pt-2 mac-scrollbar'>
        {stagesContent}
      </div>
    )
  }, [stages, generateStage])

  const openTripView = useCallback(() => {
    dispatch(setAppView(AppView.TRIP_VIEW))
  }, [dispatch])

  const renderTimelineLine = useMemo(() => {
    return (
      <div
        className={`absolute left-0 top-0 h-full w-10 border-r-4 border-slate-300 md:w-14`}
      />
    )
  }, [])

  return (
    <>
      <Button
        className='absolute left-4 top-4 flex border-2 border-slate-950 bg-slate-800 px-3 text-slate-100 shadow-xl hover:bg-slate-700 md:px-4'
        onClick={openTripView}
      >
        <p className='inline-block hidden pr-1 md:block'>←</p>
        <p className='inline-block'>Back</p>
      </Button>
      <div className='pointer-events-auto absolute right-0 box-border h-full w-4/5 overflow-y-hidden lg:w-1/3'>
        {stages && renderStages}
        {renderTimelineLine}
      </div>
    </>
  )
}
