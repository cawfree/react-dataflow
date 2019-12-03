import React, { useState, useContext } from 'react';
import { Map } from 'immutable';
import uuidv4 from 'uuid/v4';

const Signals = React.createContext(null);
const SignalsMutator = React.createContext(null);

const Dataflow = ({ children, ...extraProps }) => {
  const [ arr, setArr ] = useState(
    () => [Map({})],
  );
  const [ mutateSignals ] = useState(
    () => (fn) => {
      arr[0] = fn(arr[0]);
      return setArr([...arr]);
    },
  );
  return (
    <SignalsMutator.Provider
      value={mutateSignals}
    >
      <Signals.Provider
        value={arr}
        children={children}
      />
    </SignalsMutator.Provider>
  );
};

const useSignals = () => useContext(Signals);
const useSignalsMutator = () => useContext(SignalsMutator);

const Exporter = ({ outputWires, children, ...extraProps }) => {
  const mutateSignals = useSignalsMutator(); 
  mutateSignals(
    signals => Object.entries(extraProps)
      .filter(([ k ]) => outputWires.hasOwnProperty(k))
      .reduce(
        (map, [k, v]) => map.set(outputWires[k], v),
        signals,
      ),
  );
  return null;
};

const WiredComponent = ({ Component, Export, wirePropTypes, ...extraProps }) => {
  const signals = useSignals();
  const [ Wired ] = useState(
    () => ({ ...extraProps }) => (
      <Component
        {...extraProps}
        {...Object.entries(extraProps)
          .reduce(
            (obj, [k, v]) => {
              if (!wirePropTypes.hasOwnProperty(k) && signals[0].has(v)) {
                return {
                  ...obj,
                  [k]: signals[0].get(v),
                };
              }
              return obj;
            },
            {},
          )}
        Export={Export}
      />
    ),
  );
  return (
    <Wired
      {...extraProps}
    />
  );
};

export const withDataflow = Component => ({ ...extraProps }) => (
  <Dataflow
    children={<Component {...extraProps} />}
  />
);

export const withWires = (Component, wirePropTypes = {}) => (props) => {
  const [ Export ] = useState(
    () => {
      const outputWires = Object.keys(wirePropTypes)
        .reduce(
          (obj, k) => {
            if (props[k]) {
              return {
                ...obj,
                [k]: props[k],
              };
            }
            return obj;
          },
          {},
        );
      return React.memo(
        (props) => (
          <Exporter
            {...props}
            outputWires={outputWires}
          />
        ),
      );
    },
  );
  return (
    <WiredComponent
      {...props}
      Component={Component}
      Export={Export}
      wirePropTypes={wirePropTypes}
    />
  );
};

export const useWire = () => {
  const mutateSignals = useSignalsMutator();
  const [ wireId ] = useState(
    () => {
      const wireId = uuidv4();
      mutateSignals(signals => signals.set(wireId, null));
      return wireId;
    },
  );
  return wireId;
};
