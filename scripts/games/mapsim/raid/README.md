# Raid map pipeline (dyn-mapdata.js)

Inputs live in AJ's `COLD WAR MAPS/Raid` folder (overhead screenshots with hills/spawns/setups, walkthrough and match clips).

1. `base.py` — classify the clean overhead (raidsnd.png) into outside / outdoor / indoor.
2. `reg.py` + `track.py <clip>` — register each rotating in-game minimap frame (scale 0.245, any rotation) onto the overhead to get the walkthrough paths (`tracks_*.json`).
3. `gpdet.py` — player arrows from caster minimap footage (heat only).
4. `build.py` — grid (190x152 cells, 6 ref px each; map px = (ref - (200,40)) * 0.25), walls where indoor meets outdoor, doors from `doors.json` (cell rectangles placed from the tracked crossings), route points `via.json`, AJ's hills/spawns/setups, SnD sites, Control zones. Writes `dyn-mapdata.js`.
5. `check.py` — annotated check image (walls, cover, numbered doors). `viz.py run.json t0 t1 out.png` draws sim trails.
