import '@babel/polyfill';
import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';

import { withDataflow, withWires, useWire } from '../';

it('should expose a withDataflow hoc', () => {
  const App = withDataflow(React.Fragment);
  ReactDOM.render(<App />, document.createElement('div'));
});


it('should be possible to useWire inside a withDataflow component', () => {
  expect(
    () => useWire(),
  )
    .toThrow();
  expect(
    () => {
      const App = () => {
        const wire = useWire();
        return (
          <React.Fragment
          />
        );
      };
      ReactDOM.render(<App />, document.createElement('div'));
    },
  )
    .toThrow();
  const App = withDataflow(
    () => {
      const wire = useWire();
      return (
        <React.Fragment
        />
      );
    },
  );
  ReactDOM.render(<App />, document.createElement('div'));
});

it('should connect components to the dataflow context with wrapped withWires', () => {
  const X = withWires(React.Fragment);
  ReactDOM.render(<X />, document.createElement('div'));
});

it('should throw if we attempt to export from a component withWires if exportPropTypes have not been defined', () => {
  const BadComponent = withWires(
    ({ Export }) => (
      <Export
        output
      />
    ),
  );
  expect(
    () => {
      const App = withDataflow(
        () => (
          <BadComponent
          />
        ),
      );
      ReactDOM.render(<App />, document.createElement('div'));
    },
  )
    .toThrow();
  const Component = ({ Export }) => (
    <Export
      output
    />
  );
  Component.exportPropTypes = {
    output: PropTypes.bool,
  };
  const GoodComponent = withWires(Component);
  const App = withDataflow(
    () => (
      <GoodComponent
      />
    ),
  );
  ReactDOM.render(<App />, document.createElement('div'));
});

// TODO: This *is* implemented, but I've been unable to write a test
//       for it.
test.todo('must not be possible to nest multiple dataflow diagrams');

test.todo('must not be possible to have multiple drivers for a single wire');
