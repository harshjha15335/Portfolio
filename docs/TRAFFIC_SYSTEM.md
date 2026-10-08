# CST–Fort traffic

RoadTraffic uses a closed centripetal lane curve with smooth U-turns inside the authored carriageway. Persistent vehicle agents maintain along-lane separation, accelerate at bounded rates and brake for a crossing stop line or a nearby player ahead. The shared 32-second signal gives pedestrians seconds 20–27; cars stop independently near the two approach lines. Tests cover curve clearance, acceleration, spacing, player yielding and phase boundaries.

MumbaiStreet updates three persistent vehicles; there is no per-frame vehicle creation. Geometry and wheel articulation remain the existing shaped taxi/three-wheel auto models. Parked stands are moved beside the station, with physical proxies, to keep the moving carriageway clear. The original hailing, boarding, passenger camera, destination picker, distance/fare meter, skip, arrival, exit/cancel and walking recovery are preserved. Passenger rides still use the established safe waypoint paths: the crowd and decorative traffic upgrade does not silently replace that tested flow.

Limitations: no city-wide road graph, no arbitrary intersections, no dynamic traffic physics, no collision response between ambient traffic and hailed transport. The curve is a deliberately bounded authored lane, not autonomous driving. A crossing phase and player yielding improve presentation but do not establish a complete safe traffic simulation. Vehicle interiors/drivers still need dedicated modeling polish before reference-level acceptance.

Traffic also yields to walkers currently in the road, including walkers still crossing after the pedestrian signal phase ends. Walking animation follows horizontal speed on either axis.
