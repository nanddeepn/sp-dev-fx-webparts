/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
import * as React from 'react';

import {
  addHours,
  getHours,
  getMinutes,
  set,
} from 'date-fns';
import { MessageBarType } from 'office-ui-fabric-react';
import { useRecoilState } from 'recoil';

import { isEmpty } from '@microsoft/sp-lodash-subset';

import { useAirlines } from '../../hooks/useAirlines';
import { useFlightSchedule } from '../../hooks/useFlightSchedules';
import {
  useMappingFlightSchedules,
} from '../../hooks/useMappingFlightShedules';
import {
  IFlights,
  IFlightTrackerListItem,
  IGlobalState,
} from '../../models';
import { globalState } from '../../recoil/atoms';
import { airlineState } from '../../recoil/atoms/airlineState';
import { ShowList } from '../ShowList';
import { ShowMessage } from '../ShowMessage/ShowMessage';
import { ShowSpinner } from '../ShowSpinner';

const DEFAULT_ITEMS_TO_LOAD = 7;

export interface IFlightTrackerListProps {}

export const FlightTrackerList: React.FunctionComponent<IFlightTrackerListProps> = () => {
  const [appState, setGlobalState] = useRecoilState(globalState);
  const [airlineList, setAirlineList] = useRecoilState(airlineState);
  const { mapFlightSchedules } = useMappingFlightSchedules();
  const { selectedAirPort, selectedInformationType, selectedDate, numberItemsPerPage, selectedTime } = appState;
  const [isLoadingItems, setIsLoadingItems] = React.useState<boolean>(true);
  const [errorMessage, setErrorMessage] = React.useState<string>("");
  const [listItems, setListItems] = React.useState<IFlightTrackerListItem[]>([]);
  const [flights, setFlights] = React.useState<IFlights>(undefined);
  const [errorFlightSchedules, setErrorFlightSchedules] = React.useState<Error>();
  const [isLoadingFlightSchedules, setIsLoadingFlightSchedules] = React.useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const { getFlightSchedule } = useFlightSchedule();
  const { airlines, errorLoadingAirlines, loadingAirlines } = useAirlines();
  const [hasMore, setHasMore] = React.useState<boolean>(true);
  const pageIndex = React.useRef<number>(0);
  const currentInformationType = React.useRef(selectedInformationType);

  const checkTypeInformationToScroll = React.useCallback(() => {
    if (selectedInformationType !== currentInformationType.current) {
      pageIndex.current = 0;
      currentInformationType.current = selectedInformationType;
    }
  }, [selectedInformationType]);

  React.useEffect(() => {
    if (!isEmpty(airlines)) {
      setAirlineList(airlines);
    }
  }, [airlines]);

  React.useEffect(() => {
    (async () => {
      if (airlineList) {
        try {
          setIsLoadingFlightSchedules(true);
          const searchDate: Date = set(selectedDate, {
            hours: getHours(selectedTime),
            minutes: getMinutes(selectedTime),
            seconds: 0,
            milliseconds: 0,
          });
          const flightSchedule = await getFlightSchedule({
            fromDate: searchDate.toISOString(),
            toDate: addHours(searchDate, 12).toISOString(), // maximuum 12 hours interval is supported by the API
            airportCode: selectedAirPort?.gps_code,
          });
          setFlights(flightSchedule);
          setIsLoadingFlightSchedules(false);
        } catch (error) {
          setErrorFlightSchedules(error);
          setIsLoadingFlightSchedules(false);
        }
      }
    })();
  }, [airlineList, selectedAirPort, selectedDate, selectedTime, selectedInformationType, isRefreshing]);

  const loadItems = React.useCallback(
    async (pageIndex: number): Promise<IFlightTrackerListItem[]> => {
      const numberItemsToLoad = numberItemsPerPage ? numberItemsPerPage + 1 : DEFAULT_ITEMS_TO_LOAD;
      const mappedFlightSchedules = await mapFlightSchedules(
        selectedInformationType,
        flights,
        pageIndex,
        numberItemsToLoad
      );
      return mappedFlightSchedules;
    },
    [flights, numberItemsPerPage, selectedInformationType]
  );

  React.useEffect(() => {
    (async () => {
      if (flights) {
        setIsLoadingItems(true);

        const mappedFlightSchedules = await loadItems(0);
        setListItems(mappedFlightSchedules);
        setIsLoadingItems(false);
        setHasMore((prevHasMore) => (mappedFlightSchedules?.length > 0 ? true : false));
      }
      setIsRefreshing((prevState) => (prevState === true ? false : prevState));
    })();
  }, [flights]);

  const onScroll = React.useCallback(async () => {
    if (hasMore) {
      checkTypeInformationToScroll();
      pageIndex.current = pageIndex.current + 1;
      const mappedFlightSchedules = (await loadItems(pageIndex.current)) ?? [];
      setListItems((prevListItems) => [...prevListItems, ...mappedFlightSchedules]);
      setHasMore((prevHasMore) => (mappedFlightSchedules?.length > 0 ? true : false));
    }
  }, [hasMore, loadItems]);

  const showMessage = React.useMemo((): boolean => {
    setIsLoadingItems(false);
    setErrorMessage(errorFlightSchedules?.message);
    return !!errorFlightSchedules;
  }, [errorFlightSchedules, setErrorMessage]);

  const showSpinner = React.useMemo((): boolean => {
    return (isLoadingFlightSchedules || loadingAirlines || isLoadingItems) && !showMessage;
  }, [isLoadingFlightSchedules, loadingAirlines, isLoadingItems, errorFlightSchedules]);

  const onRefresh = React.useCallback(async () => {
    pageIndex.current = 0;
    const currentDateTime = new Date();
    setGlobalState((prevState) => ({
      ...prevState,
      selectedDate: currentDateTime,
      selectedTime: currentDateTime,
    } as IGlobalState));
    setIsRefreshing(true);
  }, [appState]);

  if (!selectedAirPort || !selectedInformationType) {
    return null;
  }

  return (
    <>
      <ShowMessage isShow={showMessage} message={errorMessage} messageBarType={MessageBarType.error} />
      <ShowSpinner isShow={showSpinner} />
      <ShowList
        showList={!showSpinner && !showMessage}
        listItems={listItems}
        onScroll={onScroll}
        onRefresh={onRefresh}
      />
    </>
  );
};
