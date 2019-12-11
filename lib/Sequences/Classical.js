export default class Classical {
  constructor(signals, elements) {
    // TODO: Should *not* rely on stringifying; should instead use immutable's builtin.
    this.signals = Object.freeze(JSON.parse(JSON.stringify(signals)));
    this.elements = Object.freeze(JSON.parse(JSON.stringify(elements)));
  }
  executeSequence(pendingWires, pendingNodes, completedWires = {}, completedNodes = [], phases = []) {
    if (Object.keys(pendingWires).length === 0 && pendingNodes.length === 0) {
      return phases;
    }
    const phase = this.getNextPhase(completedWires, completedNodes, pendingWires, pendingNodes);
    const { elements, wires } = phase;
    return this.executeSequence(
      Object.entries(pendingWires)
        .filter(([k, v]) => Object.keys(wires).indexOf(k) < 0)
        .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {}),
      pendingNodes
        .filter(k => elements.indexOf(k) < 0),
      {
        ...completedWires,
        ...wires,
      },
      [ ...completedNodes, ...elements ],
      [ ...phases, phase ],
    );
  };
  getNextPhase(completedWires, completedNodes, pendingWires, pendingNodes) {
    const nextNodes = pendingNodes
      .filter(
        (node) => {
          const wireDependencies = Object
            .entries(pendingWires)
            .filter(
              ([k, { signalOut }]) => Object
                .keys(signalOut)
                .indexOf(node) >= 0,
            );
          return wireDependencies.length <= 0;
        },
      );
    const nextCompletedNodes = [
      ...completedNodes,
      ...nextNodes,
    ];
    const nextWires = Object
      .entries(pendingWires)
      .filter(
        ([k, { signalIn }]) => {
          return Object
            .keys(signalIn)
            .filter(
              nodeId => nextCompletedNodes.indexOf(nodeId) < 0,
            ).length === 0;
        },
      )
      .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {});
    return {
      elements: nextNodes,
      wires: nextWires,
    };
  }
  getPhases() {
    return this.executeSequence(
      this.__getSignals(),
      this.__getElements(),
    );
  }
  __getSignals() {
    return this.signals;
  }
  __getElements() {
    return this.elements;
  }
}
