"""Builds a district-traffic GLB from a vehicle builder at three levels of detail.

Runs the builder once per level (VEHICLE_LOD=0 near, 1 far, 2 distant), each modelling the vehicle at its own
resolution, then bakes and joins every level into one GLB with meshes 'near', 'far' and 'distant'
(vehicle_kit.export_city). Admit the result with import-city-vehicles.mjs.

Usage: python3.11 scripts/vehicles/build_city.py <work-dir> <name> <builder.py> [builder args...]
Output: <work-dir>/<name>-city.glb and <name>-city.json (triangles per level).
"""
import json, os, pickle, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

work, name, builder, *args = sys.argv[1:]
work = os.path.abspath(work); os.makedirs(work, exist_ok=True)
levels = []
for lod in range(3):
    dump = os.path.join(work, f'{name}-lod{lod}.pickle')
    subprocess.run([sys.executable, builder, work, *args], check=True, env={**os.environ, 'VEHICLE_LOD': str(lod), 'VEHICLE_LOD_DUMP': dump})
    with open(dump, 'rb') as f: levels.append(pickle.load(f))
    os.remove(dump)
from vehicle_kit import export_city
counts = export_city(levels, os.path.join(work, f'{name}-city.glb'))
json.dump(counts, open(os.path.join(work, f'{name}-city.json'), 'w'))
print(name, counts)
os._exit(0)
