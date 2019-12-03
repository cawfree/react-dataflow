import React, { useState, useContext, useEffect } from 'react';
import { Map } from 'immutable';
import uuidv4 from 'uuid/v4';

const Signals = React.createContext(null);
const SignalsMutator = React.createContext(null);

const Dataflow = ({ children, ...extraProps }) => {
  const signalsMutator = useContext(SignalsMutator);
  useEffect(
    () => {
      if (signalsMutator) {
        throw new Error(
          'It is not possible to nest components wrapped withDataflow.',
        );
      }
    },
    [signalsMutator],
  );
  const [ arr, setArr ] = useState(
    () => [Map({})],
  );
  const [ mutateSignals ] = useState(
    () => fn => setArr(
      [
        arr[0] = fn(arr[0]),
      ],
    ),
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

export const withDataflow = Component => ({ ...extraProps }) => (
  <Dataflow
    children={<Component {...extraProps} />}
  />
);

const useSignals = () => useContext(Signals);
const useSignalsMutator = () => useContext(SignalsMutator);

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
  return (
    <React.Fragment
      children={children}
    />
  );
};

const WiredComponent = ({ Component, Export, outputKeys, ...extraProps }) => {
  const signals = useSignals();
  const [ Wired ] = useState(
    () => ({ ...extraProps }) => (
      <Component
        {...extraProps}
        {...Object.entries(extraProps)
          .reduce(
            (obj, [k, v]) => {
              if (outputKeys.indexOf(k) < 0 && signals[0].has(v)) {
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

export const withWires = Component => (props) => {
  const { exportPropTypes, exportDefaultProps } = Component;
  const [ outputKeys ] = useState(
    () => {
      if (exportPropTypes && typeof exportPropTypes === 'object') {
        return Object
          .keys(exportPropTypes);
      }
      return [];
    },
  );
  const [ Export ] = useState(
    () => {
      if (outputKeys.length) {
        const outputWires = outputKeys
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
        const WiredExporter = props => (
          <Exporter
            {...props}
            outputWires={outputWires}
          />
        );
        WiredExporter.propTypes = exportPropTypes;
        WiredExporter.defaultProps = exportDefaultProps;
        return React.memo(WiredExporter);
      }
      return () => {
        throw new Error(
          `You have attempted to use an <Export /> for a component withWires which has not defined any exportPropTypes. (Expected object, encountered ${JSON.stringify(exportPropTypes)}.)`,
        );
      };
    },
  );
  return (
    <WiredComponent
      {...props}
      Component={Component}
      Export={Export}
      outputKeys={outputKeys}
    />
  );
};
