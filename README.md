# react-dataflow
A dataflow execution library for [React](https://reactjs.org/).

<p align="center">
  <img src="./assets/squiggly.png" width="275" height="240">
</p>

It helps you build applications where your components _are_ the business logic; the behaviour of the application arises from the way the components have been connected, like a circuit. This is in stark contrast to conventional React, where well-architected applications usually emphasise a clear separation between presentation and computation elements.

By contrast, `react-dataflow` is a _"data-first"_ perspective of React; where we directly utilise the React DOM to drive efficient updates using the powerful [Top Level API](https://reactjs.org/docs/react-api.html), meanwhile the ability to render an equivalent frontend comes as a happy biproduct.

Instead of propagating data values directly via props, `react-dataflow` enables you to distribute data indirectly using _wires_. These permit conventional React components to share data independently of scope, and enables deeply-nested updates in self-managing child components to drive changes towards components anywhere in the hierarchy, without explicit handling. This makes `react-dataflow` more conducive to describing flow-based computation in React.

## 🚀 Getting Started

Using [`npm`]():

```bash
npm install --save react-dataflow
```

Using [`yarn`]():

```bash
yarn add react-dataflow
```

## ✍️ Tutorial

To use `react-dataflow`, your top-level application needs to be wrapped with the `withDataflow` HOC. This injects all of the required dependencies for dataflow-driven execution into your `<App />`:

```javascript
import React from 'react';
import { withDataflow } from 'react-dataflow';

const App = ({ ...extraProps }) => (
  <React.Fragment
  />
);

export default withDataflow(App);
```

Nothing special, right?

Well, dataflow isn't very useful without having sources of data, so let's create one! A great example of a data source is a [clock signal](https://en.wikipedia.org/wiki/Clock_signal), like the ones we find in digital logic circuits. These emit a bistable signal which oscillates between a high and low voltage at a fixed interval, and are useful for enforcing synchronization between distributed tasks.

First, let's see how we'd create one of these signals using conventional React:

```javascript
import React from 'react';
import { useRaf } from 'react-use';

const DigitalClock = React.memo(
  () => {
    const [ arr ] = useState([false]);
    useRaf(1000);
    return  arr[0] = !arr[0];
  },
  // XXX: Assert that this component
  //      doesn't care about external
  //      props.
  () => true,
);
```

Here, we use the [`useRaf`](https://github.com/streamich/react-use) hook to repeatedly request smooth animated render frames for our component. On each frame, the component is re-rendered, and we continuously invert the contents of our `signalBuffer`, which is returned as a child. This generates the output `true`, `false`, `true`, `false` over and over again.

This helps establish the square wave "form" of data we're interested in using pure React, but let's turn our attention over to some of the restrictions.

Firstly, this is a pretty boring application! All we do is render a constantly flickering boolean string on the DOM when we render a `<DigitalClock />`. Of course, we could dress this up, but there's a much bigger problem at play; what happens when we want actually want to _use_ the output value to drive a change somewhere else in our DOM? In traditional React, we would have to nest some child components which should be sensitive to these changes, but then our `DigitalClock` starts to be responsible for a lot more; it stops _being_ just a `DigitalClock`, and more like a `DigitalClockProvider`.

Alternatively, we _could_ use a callback function which manipulates the state of our parent, but this causes the parent component to re-render and requires the parent to manage propagation of the signal itself, when it doesn't necessarily require an informed interest in the value of the signal. By contrast, when using dataflow, it's trivial to re-route data between consumers, and allow passed messages to execute asynchronously, independent of the parent state.

To demonstrate these shortcomings, imagine that we wish to connect our `<DigitalClock />` compnent to a separate [`<LightEmittingDiode />`](https://en.wikipedia.org/wiki/Light-emitting_diode) component, which will light up when the clock becomes `active`:

```javascript
const LightEmittingDiode = ({ style, active }) => (
  <div
    style={[
      // XXX: Leave this part to your imagination!
      style,
      {
        backgroundColor: active ? 'green' : 'grey',
      },
    ]}
  />
);
```
How would it be possible to connect the LightEmittingDiode's input `active` prop to the output of the `DigitalClock`? Well... we could use a _wire_:

```javascript
import React from 'react';
import { LightEmittingDiode, DigitalClock } from './components';
import { withDataflow, useWire } from 'react-dataflow';

// XXX: Here, data is passed along a wire!
const App = () => {
  const wire = useWire();
  return (
    <>
      <DigitalClock
        cout={wire}
      />
      <LightEmittingDiode
        active={wire}
      />
    </>
  );
};

export default withDataflow(App);
```

Here, the `DigitalClock`'s `cout` prop is connected to the wire we've created by making a call to the `useWire` [hook](https://reactjs.org/docs/hooks-intro.html). Conversely, the `LightEmittingDiode`'s `active` prop has also been connected _to the same wire_. Meaning, that whenever the `DigitalClock`'s `cout` prop is changed, our `LightEmittingDiode` is automatically re-rendered using the new value that is sourced by the `wire`.

An additional benefit to this is that because a `wire` reference itself is effectively a constant, our top-level `<App />` instance is only rendered _once_, even though our `DigitalClock` and `LightEmittingDiode` are constantly re-rendering with each cycle.

### Complete Example

In this example, we render a `DigitalClock`, an [`Inverter`](https://en.wikipedia.org/wiki/Inverter_(logic_gate))  and a `LightEmittingDiode`. Here, whenever the `clk` signal goes high, the `LightEmittingDiode` will become inactive, and vice-versa. This allows our `LightEmittingDiode` to behave like an ["active low"](https://www.quora.com/What-is-the-meaning-of-active-low-and-active-high-in-digital-circuits-and-logic-design) component.

Notice that in order to render an `<Export />` component to manage the propagation of your component output props along a connected wire, you are **required** to specify an `exportPropTypes` attribute. This enables `react-dataflow` to efficiently manage, and validate, signal propagation using wires:

```javascript
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useRaf } from 'react-use';

import { useWire, withWires, withDataflow } from 'react-dataflow';

const Clock = React.memo(
  ({ Export }) => {
    const [ arr ] = useState([false]);
    useRaf(1000);
    return (
      <Export
        cout={arr[0] = !arr[0]}
      />
    );
  },
  () => true,
);

Clock.exportPropTypes = {
  cout: PropTypes.bool,
};
const Inverter = ({ Export, input }) => (
  <Export
    output={!input}
  />
);

Inverter.exportPropTypes = {
  output: PropTypes.bool,
};

const LightEmittingDiode = ({ style, active }) => (
  <div
    style={{
      width: 100,
      height: 100,
      backgroundColor: active ? 'green' : 'grey',
    }}
  />
);

const WiredClock = withWires(Clock);
const WiredInverter = withWires(Inverter);
const WiredLightEmittingDiode = withWires(LightEmittingDiode);

function App() {
  const clk = useWire();
  const nClk = useWire();
  return (
    <div className="App">
      <WiredClock
        cout={clk}
      />
      <WiredInverter
        input={clk}
        output={nClk}
      />
      <WiredLightEmittingDiode
        someOtherPropThatWillBeHandledLikeUsual
        active={nClk}
      />
    </div>
  );
}

export default withDataflow(App);
```

## ✌️ License
[MIT](https://opensource.org/licenses/MIT)
