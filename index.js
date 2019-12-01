import React, { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { Map } from 'immutable';
import uuidv4 from 'uuid/v4';

const Signals = React.createContext(null);
const SignalsMutator = React.createContext(null);

const useSignals = () => useContext(Signals);
const useSignalsMutator = () => useContext(SignalsMutator);

const Dataflow = ({ children, ...extraProps }) => {
  const [ arr, setSignals ] = useState([Map({})]);
  const [ mutateSignals ] = useState(
    () => (fn) => {
      const signals = fn(arr[0]);
      arr[0] = signals;
      setSignals(
        [...arr],
      );
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

export const withWires = Component => (props) => {
  const [ signals ] = useSignals();
  return (
    <Component
      {...props}
      {...Object.entries(props)
        .reduce(
          (obj, [k, v]) => {
            return {
              ...obj,
              [k]: signals.get(v),
            };
          },
          {},
        )}
    />
  );
};

export const useWire = (TransferFunction) => {
  const { wirePropTypes, wireDefaultProps } = TransferFunction;
  if (!wirePropTypes || typeof wirePropTypes !== 'object') {
    throw new Error(
      'Dataflow: You have attempted to useWire on a component which has not defined a wirePropTypes object.',
    );
  }
  const mutateSignals = useSignalsMutator();
  const [ signalIds ] = useState(
    () => {
      const signalIds = Object.keys(wirePropTypes)
        .reduce(
          (obj, k) => (
            {
              ...obj,
              [k]: uuidv4(),
            }
          ),
          {},
        );
      mutateSignals(
        signals => signals.set(
          Object.entries(signalIds)
            .reduce(
              (map, [key, signalId]) => map.set(signalId, null),
              signals,
            ),
        ),
      );
      return signalIds;
    },
  );
  const [ Export ] = useState(
    () => {
      const Export = ({ children, ...extraProps }) => {
        mutateSignals(
          signals => Object.entries(signalIds)
            .reduce(
              (map, [key, signalId]) => map.set(signalId, extraProps[key]),
              signals,
            ),
        );
        return (
          <React.Fragment
            children={children}
          />
        );
      };
      Export.propTypes = wirePropTypes;
      Export.defaultProps = wireDefaultProps;
      return Export;
    },
  );
  const [ Component ] = useState(
    () => props => (
      <TransferFunction
        {...props}
        Export={Export}
      />
    ),
  );
  return [ Component, signalIds ];
};
