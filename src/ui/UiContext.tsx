/**
 * Things a dog's sheet (or any deep component) can ask the game shell to do:
 * jump to the Breed tab with this dog chosen, open the show ring for it, show
 * its family tree, open the More sheet. Provided by Game; null outside a game
 * (the Playground, the galleries), where those buttons simply do not appear.
 */

import { createContext, useContext } from 'react';

export interface UiActions {
  breedFrom: (dogId: string) => void;
  showDog: (dogId: string) => void;
  familyOf: (dogId: string) => void;
  openMore: () => void;
}

export const UiContext = createContext<UiActions | null>(null);

export function useUi(): UiActions | null {
  return useContext(UiContext);
}
