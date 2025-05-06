export function forceCircleBoundary(
    radius: number,
    cx: number,
    cy: number,
    strength = 0.8
  ) {
    let nodes: any[];
    function force(alpha: number) {
      for (const n of nodes) {
        const dx = n.x - cx, dy = n.y - cy;
        const dist = Math.hypot(dx, dy) || 1e-6;
        const minD = radius + (n.r||0);
        if (dist < minD) {
          const k = ((minD - dist)/dist) * alpha * strength;
          n.vx += dx * k;
          n.vy += dy * k;
        }
      }
    }
    force.initialize = (nd: any[]) => (nodes = nd);
    return force;
  }
  