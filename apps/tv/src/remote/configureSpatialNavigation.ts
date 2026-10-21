import { Directions, SpatialNavigation } from 'react-tv-space-navigation';
import { remote, type Key } from './remote';

const DIR: Partial<Record<Key, Directions>> = {
  left: Directions.LEFT,
  right: Directions.RIGHT,
  up: Directions.UP,
  down: Directions.DOWN,
  select: Directions.ENTER,
};

SpatialNavigation.configureRemoteControl({
  remoteControlSubscriber: (callback) => remote.subscribeDirections((k) => callback(DIR[k] ?? null)),
  remoteControlUnsubscriber: (unsubscribe: () => void) => unsubscribe(),
});
