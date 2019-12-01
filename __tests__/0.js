import '@babel/polyfill';
import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';

import { withDataflow, withWires, useWire } from '../';

it('must be possible to wrap a component withDataflow', () => {
  const App = withDataflow(React.Fragment);
  ReactDOM.render(<App />, document.createElement('div'));
});

it('it must be possible to useWire', () => {
  expect(
    () => useWire(
      ({ ...extraProps }) => (
        <React.Fragment />
      ),
    ),
  )
    .toThrow();
  expect(
    () => {
      const Component = ({ ...extraProps }) => (
        <React.Fragment
        />
      );
      Component.dataflowPropTypes = {};
      return useWire(Component);
    },
  ).toBeTruthy();
});

it('must be possible to wrap a component withWires', () => {
  expect(
    () => {
      const App = withWires(React.Fragment);
      ReactDOM.render(<App />, document.createElement('div'));
    },
  )
    .toThrow();
  expect(
    () => {
      const Component = withWires(React.Fragment);
      const App = withDataflow(Component);
      ReactDOM.render(<App />, document.createElement('div'));
    },
  )
    .toBeTruthy();
});
