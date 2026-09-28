const STEP = 1 / 240;
const MAX_DT = 0.064;

export function springCoefficients(response, damping) {
  const safeResponse = Math.max(0.01, response);
  const omega = (2 * Math.PI) / safeResponse;
  return { stiffness: omega * omega, friction: 2 * Math.max(0, damping) * omega };
}

export function createSpring(options = {}) {
  let value = options.value ?? 0;
  let target = options.target ?? value;
  let velocity = options.velocity ?? 0;
  let response = options.response ?? 0.4;
  let damping = options.damping ?? 1;
  let coefficients = springCoefficients(response, damping);
  const restDelta = options.restDelta ?? 0.001;
  const restSpeed = options.restSpeed ?? 0.01;
  let settled = value === target && velocity === 0;

  function integrate(dt) {
    const force = -coefficients.stiffness * (value - target) - coefficients.friction * velocity;
    velocity += force * dt;
    value += velocity * dt;
  }

  function step(dt) {
    if (settled) return true;
    let remaining = Math.min(Math.max(dt, 0), MAX_DT);
    while (remaining > 0) {
      const h = Math.min(STEP, remaining);
      integrate(h);
      remaining -= h;
    }
    if (Math.abs(value - target) < restDelta && Math.abs(velocity) < restSpeed) {
      value = target;
      velocity = 0;
      settled = true;
    }
    return settled;
  }

  return {
    get value() { return value; },
    get velocity() { return velocity; },
    get target() { return target; },
    get settled() { return settled; },
    get response() { return response; },
    get damping() { return damping; },
    step,
    setTarget(next, nextVelocity) {
      target = next;
      if (nextVelocity !== undefined) velocity = nextVelocity;
      settled = value === target && velocity === 0;
    },
    setVelocity(next) {
      velocity = next;
      settled = value === target && velocity === 0;
    },
    setParams(next = {}) {
      if (next.response !== undefined) response = next.response;
      if (next.damping !== undefined) damping = next.damping;
      coefficients = springCoefficients(response, damping);
    },
    snap(next = target) {
      value = next;
      target = next;
      velocity = 0;
      settled = true;
    },
    finish() {
      value = target;
      velocity = 0;
      settled = true;
    },
  };
}
