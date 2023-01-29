import { V3FaucetService } from "@aave/contract-helpers";
import { enableMapSet } from "immer";
import { CustomMarket } from "ui-config/marketsConfig";
import { ENABLE_TESTNET, STAGING_ENV } from "utils/marketsAndNetworksConfig";
import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";

import { createPoolSlice, PoolSlice } from "./poolSlice";
import {
  createProtocolDataSlice,
  ProtocolDataSlice,
} from "store/protocolDataSlice";
import { createSingletonSubscriber } from "./utils/createSingletonSubscriber";
import { getQueryParameter } from "./utils/queryParams";
// import {
//   createV3MigrationSlice,
//   V3MigrationSlice,
// } from "store/v3MigrationSlice";
import { createWalletSlice, WalletSlice } from "./walletSlice";
import { createIncentiveSlice, IncentiveSlice } from "./incentiveSlice";

enableMapSet();

export type RootStore = ProtocolDataSlice &
  WalletSlice &
  PoolSlice &
  IncentiveSlice;
// V3MigrationSlice;

export const useRootStore = create<RootStore>()(
  subscribeWithSelector(
    devtools((...args) => {
      return {
        // ...createStakeSlice(...args),
        ...createProtocolDataSlice(...args),
        ...createWalletSlice(...args),
        ...createPoolSlice(...args),
        ...createIncentiveSlice(...args),
        // ...createGovernanceSlice(...args),
        // ...createV3MigrationSlice(...args),
      };
    }),
  ),
);

// hydrate state from localeStorage to not break on ssr issues
if (typeof document !== "undefined") {
  document.onreadystatechange = function () {
    if (document.readyState == "complete") {
      const selectedMarket =
        getQueryParameter("marketName") ||
        localStorage.getItem("selectedMarket");

      if (selectedMarket) {
        const currentMarket = useRootStore.getState().currentMarket;
        const setCurrentMarket = useRootStore.getState().setCurrentMarket;
        if (selectedMarket !== currentMarket) {
          setCurrentMarket(selectedMarket as CustomMarket, true);
        }
      }
    }
  };
}

// export const useStakeDataSubscription = createSingletonSubscriber(() => {
//   return useRootStore.getState().refetchStakeData();
// }, 60000);

export const useWalletBalancesSubscription = createSingletonSubscriber(() => {
  return useRootStore.getState().refetchWalletBalances();
}, 60000);

export const usePoolDataSubscription = createSingletonSubscriber(() => {
  return useRootStore.getState().refreshPoolData();
}, 60000);

export const usePoolDataV3Subscription = createSingletonSubscriber(() => {
  console.log("usePoolDataV3Subscription");
  return useRootStore.getState().refreshPoolV3Data();
}, 60000);

// export const useIncentiveDataSubscription = createSingletonSubscriber(() => {
//   return useRootStore.getState().refreshIncentiveData();
// }, 60000);

// export const useGovernanceDataSubscription = createSingletonSubscriber(() => {
//   return useRootStore.getState().refreshGovernanceData();
// }, 60000);

let latest: V3FaucetService;
useRootStore.subscribe(
  (state) => state.currentMarketData,
  async (selected) => {
    const { setIsFaucetPermissioned: setFaucetPermissioned, jsonRpcProvider } =
      useRootStore.getState();
    if (ENABLE_TESTNET || STAGING_ENV) {
      if (!selected.v3) {
        setFaucetPermissioned(false);
        return;
      }

      // If there are multiple calls in flight, we only want to use the result from the latest one.
      // Use the instance of the service to check if it's the latest one since it is recreated
      // everytime this subscription fires.
      const service = new V3FaucetService(
        jsonRpcProvider(),
        selected.addresses.FAUCET,
      );
      latest = service;
      service
        .isPermissioned()
        .then((isPermissioned) => {
          if (latest === service) {
            setFaucetPermissioned(isPermissioned);
          }
        })
        .catch((e) => {
          console.error("error checking faucet permission", e);
          setFaucetPermissioned(false);
        });
    } else {
      setFaucetPermissioned(false);
    }
  },
  { fireImmediately: true },
);