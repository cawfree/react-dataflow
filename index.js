import React, { useState, useContext, useEffect } from 'react';
import { Map } from 'immutable';
import { isEqual } from 'lodash';
import uuidv4 from 'uuid/v4';

const Signals = React.createContext(null);
const SignalsMutator = React.createContext(null);

const Dataflow = ({ children, ...extraProps }) => {
  const signalsMutator = useContext(SignalsMutator);
  useEffect(
    () => {
      if (signalsMutator) {
        throw new Error(
          'Dataflow: It is not possible to nest components wrapped withDataflow.',
        );
      }
    },
    [signalsMutator],
  );
  const [ arr, setArr ] = useState(
    () => [Map({})],
  );
  const [ mutateSignals ] = useState(
    () => (fn) => {
      const v = fn(arr[0]);
      if (!isEqual(v, arr[0])) {
        setArr([arr[0] = v]);
      }
      return v;
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
      mutateSignals(
        signals => signals
          .set(
            wireId,
            Map(
              {
                value: null,
                writers: Map({}),
                readers: Map({}),
              },
            ),
          ),
        );
      return wireId;
    },
  );
  return wireId;
};

const Exporter = ({ outputWires, children, dataflowId, ...extraProps }) => {
  const mutateSignals = useSignalsMutator(); 
  mutateSignals(
    signals => Object
      .entries(extraProps)
      .filter(([ k ]) => outputWires.hasOwnProperty(k))
      .reduce(
        (map, [k, v]) => map
          .setIn([outputWires[k], 'value'], v)
          .setIn([outputWires[k], 'writers', dataflowId], true),
        signals,
      ),
  );
  return (
    <React.Fragment
      children={children}
    />
  );
};

const WiredComponent = ({ Component, Export, outputKeys, dataflowId, ...extraProps }) => {
  const signals = useSignals();
  const mutateSignals = useSignalsMutator();
  const [ Wired ] = useState(
    () => ({ ...extraProps }) => (
      <Component
        {...extraProps}
        {...Object.entries(extraProps)
          .filter(([k]) => outputKeys.indexOf(k) < 0)
          .reduce(
            (obj, [k, v]) => {
              if (signals[0].has(v)) {
                // XXX: Mark this element as a consumer.
                mutateSignals(
                  signals => signals
                    .setIn([v, 'readers', dataflowId], true),
                );
                return {
                  ...obj,
                  [k]: signals[0]
                    .getIn([v, 'value']),
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

export const withWires = (Component, options = {}) => (props) => {
  if (!options || typeof options !== 'object') {
    throw new Error(
      `Dataflow: When wrapping a <Component /> withWires, you must pass either a valid configuration object, or undefined. Encountered: ${options}.`,
    );
  }
  const [ dataflowId ] = useState(
    // TODO: Validate that the supplied key is an appropriate unique type.
    () => options.key || uuidv4(),
  );
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
            dataflowId={dataflowId}
            outputWires={outputWires}
          />
        );
        WiredExporter.propTypes = exportPropTypes;
        WiredExporter.defaultProps = exportDefaultProps;
        return React.memo(WiredExporter);
      }
      return () => {
        throw new Error(
          `Dataflow: You have attempted to use an <Export /> for a component withWires which has not defined any exportPropTypes. (Expected object, encountered ${JSON.stringify(exportPropTypes)}.)`,
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
      dataflowId={dataflowId}
    />
  );
};
