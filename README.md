# react-dataflow
A dataflow execution format for [React](https://reactjs.org/).

<p align="center">
  <img src="./assets/squiggly.png" width="275" height="240">
</p>

It helps you build applications where components _are_ business logic, and the behaviour of the application arises from the way the components have been connected, not too disimilar to a digital circuit.

Instead of propagating data values directly via props, `react-dataflow` enables you to distribute data indirectly using _wires_. These permit conventional React components to share data independently of scope, and enables deeply-nested nested updates in self-managing child components to drive changes towards components anywhere in the hierarchy, without explicit handling.

`react-dataflow` is a _"data-first"_ perspective of React; we utilise the React DOM to drive efficient updates using the powerful top-level parent API, meanwhile the ability to render an equivalent frontend comes as a happy biproduct.

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

To use `react-dataflow`, your top-level application needs to be wrapped with the `withDataflow` HOC. This injects all of the required dependencies for dataflow-driven execution:

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

Well, dataflow isn't very useful without having sources of data, so let's make one! A great example of a data source is a [clock signal](https://en.wikipedia.org/wiki/Clock_signal), like the ones we find in digital logic circuits. These emit a bistable signal which oscillates between a high and low voltage at a fixed interval, and are useful for enforcing synchronization between distributed tasks.

First, let's see how we'd create one of these signals using conventional React:

```javascript
import React from 'react';
import { useRaf } from 'react-use';

const DigitalClock = ({ ...extraProps }) => {
  useRaf(1000);
  const [ signalBuffer, setSignalOut ] = useState([true]);
  return (
    signalBuffer[0] = !signalBuffer[0]
  );
};
```

Here, we use the [`useRaf`](https://github.com/streamich/react-use) hook to repeatedly request 1000 render frames for our component. On each frame, the component is re-rendered, and we continuously invert the contents of our `signalBuffer` and return them as a child. This generates the output `true`, `false`, `true`, `false` over and over again. This helps establish the "form" of data we're interested in using pure React, but let's turn our attention over to some of the restrictions.

Firstly, this is a pretty boring application! All we do is render a constantly flickering boolean string on the DOM when we render a `<DigitalClock />`. Of course, we could dress this up, but there's a much bigger problem at play; what happens when we want actually want to _use_ the output value to drive a change somewhere else in our DOM? In traditional React, we would have to nest some child components which should be sensitive to these changes, but then our `DigitalClock` starts to be responsible for a lot more; it stops _being_ just a `DigitalClock`, and more like a `DigitalClockProvider`.

Alternatively, we _could_ use a callback function which manipulates the state of our parent, but this causes the parent component to re-render and requires the parent to manage propagation of the signal itself, when it doesn't necessarily require an informed interest in the value of the signal.

Additionally, this style only permits us to render one item, and it is required to be compatible with the DOM! Therefore, you can't render any objects to propgate complex values, or render an underfined value.

To demonstrate these shortcomings, imagine that we wish to connect our `<DigitalClock />` compnent to a separate [`<LED />`](https://en.wikipedia.org/wiki/Light-emitting_diode) component, which will light up when the clock becomes `active`:

```javascript
const LED = ({ style, active }) => (
  <div
    style={[
      style,
      {
        backgroundColor: active ? 'green' : 'grey',
      },
    ]}
  />
);
```
How would it be possible to connect the LED's input `active` prop to the output of the `DigitalClock`? Well... we could use a _wire_:

```javascript
import React from 'react';
import { LED, DigitalClock } from './components';
import { withDataflow, useWire } from 'react-dataflow';

const App = () => {
  const [ Clock, { clk } ] = useWire(DigitalClock);
  return (
    <>
      <Clock />
      <LED active={clk} />
    </>
  );
};

export default withDataflow(App);
```

Making a call to the `useWire` hook provides us with two things; a new Component which we've named "`Clock`" which is capable of returning our results via a wire, and a `wire` object which we've destructured to fetch the `clk` signal, which we can route into whichever components we want; in this case, we use it to activate the LED.

This approach scales arbitrarily. For example, we could use a [`<Not />`](https://en.wikipedia.org/wiki/Inverter_(logic_gate)) component to render the inverted result:

```javascript
const [Clock, { clk }] = useWire(DigitalClock);
const [Not, { output: notOut }] = useWire(NotGate);

return (
  <>
    <Clock>
      <Not input={clk} />
      <LED active={notOut} />
    </Clock>
  </>
);
```

This is fundamentally what `react-dataflow` buys us; we're permitted to use the output of components and connect them abitrarily to the inputs of other components. In addition, React very helpfully optimizes these updates; whenever the value of `clk` oscillates, only the wired components are re-rendered; the `<App />` itself is not!

### 🔮 Smoke and Mirrors

So, what's going on? Calling `useWire` seems to magically provide us with a wire which we can destructure to get a corresponding `clk` signal; so what changed?

Well, whenever we use the `useWire` hook, the `Component` returned to us has been injected an `<Export />` component, which can be used to propagate signals along the wire whenever the component is updated. So, our `DigitalClock` had to be updated to look like the following:

```javascript
import React from 'react';
import PropTypes from 'prop-types';
import { useRaf } from 'react-use';

const DigitalClock = ({ Export, ...extraProps }) => {
  useRaf(1000);
  const [ signalBuffer, setSignalOut ] = useState([true]);
  return (
    <Export
      clk={signalBuffer[0] = !signalBuffer[0]}
      {...extraProps}
    />
  );
};

// XXX: wirePropTypes define which props that we pass to the Export
//      are permitted to propagate along the wire. (Required)
DigitalClock.wirePropTypes = {
  clk: PropTypes.bool,
};
```

Using `wirePropTypes`, we've informed `react-dataflow` that our component is capable of passing a boolean `clk` signal along the wire.

For our, `LED` component, we've only had to make sure that it is sensitive to data passed using wire references. This is easily achieved using a call to the `withWires` HOC:

```javascript
import React from 'react';
import { withWires } from 'react-dataflow';

const LED = ({ style, active }) => (
  <div
    style={[
      style,
      {
        backgroundColor: active ? 'green' : 'grey',
      },
    ]}
  />
);

export default withWires(LED);
```

This permits values passed using wires, such as the `clk` signal into the `active` prop, to resolve to the driving wire's signalling value. All other input props behave exactly the way we'd traditionally expect them to.

## ✌️ License
[MIT](https://opensource.org/licenses/MIT)
