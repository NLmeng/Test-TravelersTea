import { useSnackbar } from 'notistack'
import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import App from './App'
import { Loader } from './components/common'
import { SideBar } from './components/sideBar'
import { AppView } from './constants/enums'
import { resetMap } from './redux/reducers/mapSlice'
import { resetModalsDisplayed } from './redux/reducers/modalsSlice'
import {
  resetPreferences,
  setLightMode,
} from './redux/reducers/preferencesSlice'
import {
  clearStagesError,
  resetStages,
} from './redux/reducers/stage/stageSlice'
import { fetchStagesByTripIdAsync } from './redux/reducers/stage/thunks'
import { fetchTripsAsync } from './redux/reducers/trips/thunks'
import {
  clearTripsError,
  flagAsFulfilled,
  resetTrips,
} from './redux/reducers/trips/tripsSlice'
import {
  fetchEFLimitLeftAsync,
  fetchLimitLeftAsync,
} from './redux/reducers/users/thunks'
import {
  clearUserError,
  updateAsLoggedIn,
  updateAsLoggedOut,
} from './redux/reducers/users/usersSlice'
import { openSidebar, resetView, setAppView } from './redux/reducers/viewSlice'
import { REQUEST_STATE } from './redux/states'
import { shouldUseLightMode } from './util/lightMode'

SessionController.propTypes = {
  children: PropTypes.node,
}

export function SessionController() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const activeTripId = useSelector((state) => state.view.activeTripId)
  const modalStates = useSelector((state) => state.modals)
  const tripsStates = useSelector((state) => state.trips)
  const stagesStates = useSelector((state) => state.stages)
  const userStates = useSelector((state) => state.users)
  const [isLoading, setIsLoading] = useState(false)
  const { enqueueSnackbar } = useSnackbar()
  const storedTokenExists = localStorage.getItem('travelersTea_accessToken')
  const delaySetLoadingFalse = (ms, callback = () => {}) => {
    setTimeout(() => {
      setIsLoading(false)
      callback()
    }, ms)
  }
  const [isLimitAlertOpen, setIsLimitAlertOpen] = useState(false)
  const delaySetLimitAlertFalse = (ms, callback = () => {}) => {
    setTimeout(() => {
      setIsLimitAlertOpen(false)
      callback()
    }, ms)
  }
  const delaySetLimitAlertTrue = (ms, callback = () => {}) => {
    setTimeout(() => {
      setIsLimitAlertOpen(true)
      callback()
    }, ms)
  }

  // when creating trip (or changing tripEntry), it is enough to rely on the changes of tripId (if id changed then the trip is created)
  useEffect(() => {
    if (tripsStates.status === REQUEST_STATE.FULFILLED && activeTripId)
      dispatch(fetchStagesByTripIdAsync(activeTripId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTripId, dispatch])
  // when updating trip, the id does not change (+ the status does), so we need to use an extra flag (that is not FULFILLED to avoid double dispatch)
  useEffect(() => {
    if (tripsStates.status === REQUEST_STATE.UPDATED) {
      dispatch(flagAsFulfilled())
      dispatch(fetchStagesByTripIdAsync(activeTripId))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripsStates.status, dispatch])

  useEffect(() => {
    if (userStates.status === REQUEST_STATE.LOGGINGOUT) {
      dispatch(resetTrips())
      dispatch(resetPreferences())
      dispatch(resetView())
      dispatch(resetMap())
      dispatch(resetModalsDisplayed())
      dispatch(resetStages())
      dispatch(updateAsLoggedOut())
    }
  }, [dispatch, userStates])

  useEffect(() => {
    if (userStates.status === REQUEST_STATE.LOGGEDIN) {
      navigate('/home')
      if (userStates.isNewAccount) dispatch(setAppView(AppView.NEW_TRIP))
    }
  }, [dispatch, navigate, userStates])

  useEffect(() => {
    if (
      ((tripsStates.status === REQUEST_STATE.WRITING ||
        stagesStates.status === REQUEST_STATE.WRITING) &&
        userStates.status === REQUEST_STATE.LOGGEDIN) ||
      userStates.status === REQUEST_STATE.READING
    ) {
      setIsLoading(true)
    }
  }, [tripsStates, userStates, stagesStates])

  useEffect(() => {
    if (
      userStates.status === REQUEST_STATE.IDLE ||
      userStates.status === REQUEST_STATE.REJECTED ||
      userStates.status === REQUEST_STATE.LOGGEDOUT
    ) {
      localStorage.removeItem('travelersTea_accessToken')
    }
  }, [userStates])

  useEffect(() => {
    if (
      tripsStates.status === REQUEST_STATE.IDLE &&
      userStates.status === REQUEST_STATE.LOGGEDIN &&
      storedTokenExists
    ) {
      dispatch(fetchTripsAsync())
    }
  }, [dispatch, tripsStates.status, userStates, storedTokenExists])

  useEffect(() => {
    if (
      (tripsStates.status === REQUEST_STATE.FULFILLED ||
        tripsStates.status === REQUEST_STATE.REJECTED ||
        tripsStates.status === REQUEST_STATE.IDLE) &&
      (stagesStates.status === REQUEST_STATE.FULFILLED ||
        stagesStates.status === REQUEST_STATE.REJECTED ||
        stagesStates.status === REQUEST_STATE.IDLE)
    ) {
      delaySetLoadingFalse(1000, () => dispatch(fetchEFLimitLeftAsync()))
    }
  }, [tripsStates.status, stagesStates.status, dispatch])

  useEffect(() => {
    if (userStates.status === REQUEST_STATE.LOGGINGIN) {
      dispatch(fetchLimitLeftAsync())
      dispatch(fetchEFLimitLeftAsync())
      delaySetLoadingFalse(2500, () => {
        dispatch(updateAsLoggedIn())
        dispatch(setLightMode(shouldUseLightMode()))
        // fix for empty space caused by IOS toolbar
        window.scrollTo(0, 0)
      })
    } else if (userStates.status === REQUEST_STATE.REJECTED) {
      delaySetLoadingFalse(2500, () => dispatch(updateAsLoggedOut()))
    }
  }, [userStates.status, dispatch])

  useEffect(() => {
    if (tripsStates.error) {
      enqueueSnackbar(tripsStates.error, { variant: 'error' })
      dispatch(clearTripsError())
      dispatch(openSidebar())
    }
  }, [dispatch, enqueueSnackbar, tripsStates.error])

  useEffect(() => {
    if (stagesStates.error) {
      enqueueSnackbar(stagesStates.error, { variant: 'error' })
      dispatch(clearStagesError())
      dispatch(openSidebar())
    }
  }, [dispatch, enqueueSnackbar, stagesStates.error])

  useEffect(() => {
    if (userStates.error) {
      setTimeout(() => {
        enqueueSnackbar('Error: Invalid Credentials', { variant: 'error' })
        dispatch(clearUserError())
      }, 2500)
    }
  }, [dispatch, enqueueSnackbar, userStates.error])

  useEffect(() => {
    if (
      !isLimitAlertOpen &&
      userStates.status === REQUEST_STATE.LOGGEDIN &&
      (modalStates.newTripModalIsOpen ||
        modalStates.editStageModalIsOpen ||
        modalStates.editTripModalIsOpen)
    ) {
      dispatch(fetchLimitLeftAsync())
      delaySetLimitAlertTrue(500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalStates, userStates.status])

  useEffect(() => {
    if (userStates.status === REQUEST_STATE.LOGGEDIN && isLimitAlertOpen) {
      enqueueSnackbar(
        `You have ${userStates.attemptLeft} trip creation/update requests left today`,
        { variant: userStates.attemptLeft > 3 ? 'info' : 'warning' },
      )
      delaySetLimitAlertFalse(5000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLimitAlertOpen, enqueueSnackbar])

  useEffect(() => {
    let timer
    if (isLoading) {
      timer = setTimeout(() => {
        enqueueSnackbar('This may take a minute', { variant: 'info' })
      }, 3000)
    }
    return () => clearTimeout(timer)
  }, [enqueueSnackbar, isLoading])

  // credits: https://stackoverflow.com/a/57795518 & ChatGPT
  useEffect(() => {
    const lightModeWatcher = window.matchMedia('(prefers-color-scheme: light)')
    const handleChange = (e) => {
      dispatch(setLightMode(e.matches))
    }

    lightModeWatcher.addEventListener('change', handleChange)

    return () => {
      lightModeWatcher.removeEventListener('change', handleChange)
    }
  }, [dispatch])

  return (
    <>
      {isLoading && <Loader />}
      <SideBar
        shouldHide={userStates.status !== REQUEST_STATE.LOGGEDIN}
        isLoading={isLoading}
      />
      <App />
    </>
  )
}
