# PROGRESS

## Node Detail Panel Rendering Regression — Fixed

### Root Causes (4 bugs)

1. **Wrong state setter on close button** (`setSelectedNode` → `setSelectedNodeId`)
   - Caused a JS crash on close, leaving the panel stuck open and corrupting subsequent node selections.

2. **CSS specificity conflict — `.stat-label` / `.stat-value`**
   - The scenario simulator section defines `.stat-value { font-size: 2.5rem }` and `.stat-label { margin-bottom: 0.5rem }` globally.
   - The node detail panel's `.node-stat .stat-label/.stat-value` overrides were not specific enough to win, so some node types (distribution hubs) rendered with 2.5rem text — causing overflow, overlap, and cut-off values.
   - Fixed by adding `!important` guards on the node-stat scoped rules.

3. **`overflow: hidden` on `.network-map-container` clipping the panel**
   - The panel is `position: absolute` inside the container. `overflow: hidden` clipped it at the container boundary when it slid up near the bottom edge.
   - Fixed by changing to `overflow: visible`.

4. **Missing `key` prop on the panel div**
   - Without a stable `key={activeSelectedNode.id}`, React reused the same DOM node across node clicks, so the `slideUp` animation only fired on first open — subsequent clicks showed a partially-animated or stale panel.
   - Fixed by adding `key={activeSelectedNode.id}` so React fully remounts the panel for each new node.

### Verification
Tested by clicking through: Import Terminal (Mundra), Refinery (Jamnagar), Distribution Hub (Western), Distribution Hub (Southern), Refinery (Vizag) — all render fully opaque, correct font sizes, no overlap, no cut-off values.
