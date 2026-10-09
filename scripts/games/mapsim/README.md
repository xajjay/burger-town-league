# Minimap sim map data (public/scripts/dynasty/dyn-mapdata.js)

`python3 build_map.py` builds every map in `cfg_maps.py` from AJ's `COLD WAR MAPS` folder (copy the PNGs next to the scripts):

- Painted layout (RAID.png, CHECKMATE.png, GARRISOM.png): RED = wall / out of bounds, BLUE = hallway or door (passable), WHITE = short wall (vault, cover, see over). Everything else inside the red outline is floor.
- Hill outlines from the callout screenshots, spawns (filled blob = primary, drawn "2" = secondary) and setups (red = holding side, blue = breaking side) from the per-hill screenshots, Control zones and spawns from the control screenshots. Each screenshot is registered onto the painted layout automatically (`register`); coordinates in `cfg_maps.py` are pixels in each screenshot.
- Cell codes: 0 outside, 1 outdoor, 2 indoor, 4 wall, 5 hull (Checkmate plane: walk under it, blocks sight), 6 short wall.
- Raid keeps the older overhead frame (raidsnd.png) so its SnD data still lines up; `raid/` has the earlier footage-tracking pipeline.

To add a map: paint the layout, add an entry to `cfg_maps.py`, run the build, check `prev_<Map>.png`, copy dyn-mapdata.js into public/scripts/dynasty/.

Oct 9, 2026: added Moscow (HP + SnD), Apocalypse (HP), Miami (SnD) and Express (SnD). Their layouts aren't outlined in red, so `outline=True` takes the footprint from the light map outline, and `cyan_open=True` keeps blue drawn inside red buildings walkable. `python3 build_map.py Moscow Apocalypse Miami Express` rebuilds just those and keeps the other maps already in dyn-mapdata.js. Hill spawn tiers: filled blob = primary (2), drawn number = secondary (1).

Standoff (SnD) added the same night: its spawn corridors run off the screenshot, so `close` draws barrier lines across them, `seed` takes several background corners, and `off` masks the editor toolbar off the map.
