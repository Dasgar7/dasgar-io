# Architecture

Authoritative server at 20 tick/s. Client interpolates and renders at 60 FPS.

- `GameWorld` owns players, food, viruses
- `Cell` has velocity, mass, merge timer
- WebSocket JSON protocol (`MsgType` in shared)
- For scale: add AOI, spatial hash, binary packets
