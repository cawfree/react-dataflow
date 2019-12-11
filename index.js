import React, { useState, useContext, useEffect } from 'react';
import { Map, Set } from 'immutable';
import EventEmitter from 'events';
import uuidv4 from 'uuid/v4';
import { useMutator } from 'react-use-mutator';

const EVENT_SIGNALS_CHANGED = 'dataflowSignalsChanged';

const Signals = React.createContext(null);
const SignalsMutator = React.createContext(null);
const Elements = React.createContext(null);
const ElementsMutator = React.createContext(null);

const Dataflow = ({ Component, ...extraProps }) => {
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
  const [ useSignals, mutateSignals ] = useMutator(Map({}));
  const [ useElements, mutateElements ] = useMutator(Set([]));
  const [ Emitter ] = useState(
    () => new EventEmitter(),
  );
  // XXX: Allow the parent to listen to changes in signals.
  const [ subscribe ] = useState(
    () => fn => Emitter.on(EVENT_SIGNALS_CHANGED, fn),
  );
  const [ children ] = useState(
    () => (
      <Component
        {...extraProps}
        subscribe={subscribe}
      />
    ),
  ); 
  Emitter.emit(EVENT_SIGNALS_CHANGED, useSignals(), useElements());
  return (
    <ElementsMutator.Provider
      value={mutateElements}
    >
      <SignalsMutator.Provider
        value={mutateSignals}
      >
        <Elements.Provider
          value={useElements}
        >
          <Signals.Provider
            value={useSignals}
            children={children}
          />
        </Elements.Provider>
      </SignalsMutator.Provider>
    </ElementsMutator.Provider>
  );
};

export const withDataflow = Component => ({ ...extraProps }) => (
  <Dataflow
    Component={Component}
    {...extraProps}
  />
);

const useSignals = () => useContext(Signals);
const useSignalsMutator = () => useContext(SignalsMutator);
const useElementsMutator = () => useContext(ElementsMutator);

// XXX: This is a convenience method, which permits callers to
//      passively inspect wire states *without* registering 
//      for updates.
export const useWires = () => useSignalsMutator()();

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
                signalIn: Map({}),
                signalOut: Map({}),
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
          .setIn(
            [outputWires[k], 'signalIn', dataflowId],
            (map.get([outputWires[k], 'signalIn', dataflowId]) || (Set([])))
              .add(k),
          ),
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
  const getState = useSignals();
  const mutateSignals = useSignalsMutator();
  const [ Wired ] = useState(
    () => ({ ...extraProps }) => (
      <Component
        {...extraProps}
        {...Object.entries(extraProps)
          .filter(([k]) => outputKeys.indexOf(k) < 0)
          .reduce(
            (obj, [k, v]) => {
              if (getState().has(v)) {
                // XXX: Mark this element as a consumer.
                mutateSignals(
                  signals => signals
                    .setIn(
                      [v, 'signalOut', dataflowId],
                      (signals.get([v, 'signalOut', dataflowId]) || Set([]))
                        .add(k),
                    ),
                );
                return {
                  ...obj,
                  [k]: getState()
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
  const mutateElements = useElementsMutator();
  // XXX: Register this dataflowId as an element on the graph.
  useEffect(() => mutateElements(elements => elements.add(dataflowId)) && undefined, [ mutateElements, dataflowId]); 
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
